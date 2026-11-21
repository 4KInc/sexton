// Merge (design 2.5, R1.4–R1.9, R1.13): the near-GEO filter, the join by NORAD id,
// source selection and status disagreements. Pure. No DOM, network or clock.
import { CONFIG } from './config.ts';
import type { Config } from './config.ts';
import type { GpRow } from './gp.ts';
import type { GpzTableRow } from './gpz-table.ts';
import { orbitFromAltitudes, orbitFromMeanMotion } from './orbit.ts';
import type { SatcatRow } from './satcat.ts';
import type { Disagreement, MergedRecord, ObjectKind, Orbit, OrbitSource } from './types.ts';

export interface MergeInput {
  /** null when SATCAT is absent. */
  satcat: SatcatRow[] | null;
  gp: GpRow[];
  table: GpzTableRow[];
}

export interface MergeResult {
  records: MergedRecord[];
  /** SATCAT rows that are not in the population. */
  outsidePopulation: number;
}

const has = (list: readonly string[], code: string): boolean => list.includes(code);

/** Type and status from a SATCAT row (R1.7). */
export function kindFromSatcat(row: SatcatRow, config: Config = CONFIG): ObjectKind {
  const t = config.satcatTypes;
  if (row.objectType === t.rocketBody) return 'rocket body';
  if (row.objectType === t.debris) return 'debris';
  if (row.objectType !== t.payload) return 'unknown';
  if (has(config.status.retired, row.opsStatusCode)) return 'retired payload';
  if (has(config.status.living, row.opsStatusCode)) return 'living payload';
  return 'unknown payload';
}

/** Type and status from a GPZ table code (R1.8). A code that is not in the config is "unknown". */
export function kindFromTableStatus(status: string, config: Config = CONFIG): ObjectKind {
  const map: Record<string, string> = config.gpzTableStatus;
  switch (Object.hasOwn(map, status) ? map[status] : undefined) {
    case 'retired':
      return 'retired payload';
    case 'living':
      return 'living payload';
    case 'rocket body':
      return 'rocket body';
    case 'debris':
      return 'debris';
    default:
      return 'unknown';
  }
}

function objectTypeOfKind(kind: ObjectKind, config: Config): string | null {
  const t = config.satcatTypes;
  if (kind === 'retired payload' || kind === 'living payload') return t.payload;
  if (kind === 'rocket body') return t.rocketBody;
  if (kind === 'debris') return t.debris;
  return null;
}

/** The five-way set used to compare SATCAT with the GPZ table (design 2.5 step 4). */
const comparable = (kind: ObjectKind): ObjectKind => (kind === 'unknown payload' ? 'unknown' : kind);

/** SATCAT row passes the near-GEO filter (R1.4). Both limits are inclusive. */
export function inNearGeo(row: SatcatRow, config: Config = CONFIG): boolean {
  const low = config.geoAltitudeKm + config.nearGeo.lowerKm;
  const high = config.geoAltitudeKm + config.nearGeo.upperKm;
  return (
    row.decayDate === null &&
    row.orbitCenter === config.nearGeo.orbitCenter &&
    row.apogeeKm >= low &&
    row.apogeeKm <= high &&
    row.perigeeKm >= low &&
    row.perigeeKm <= high
  );
}

const DESIGNATOR = /^(\d{4})-\d{3}[A-Z]*$/;

/**
 * The year used to place an object on the x axis (design 2.7). It is the year of the
 * launch date, or else the year in the international designator when that is a year from
 * firstLaunchYear to the snapshot year. It is never used for the era badge or moss.
 */
export function launchYearOf(
  launchDate: string | null,
  intlDes: string | null,
  snapshotDate: string,
  config: Config = CONFIG,
): { year: number | null; source: 'launch date' | 'designator' | null } {
  if (launchDate !== null) return { year: Number(launchDate.slice(0, 4)), source: 'launch date' };
  const m = intlDes === null ? null : DESIGNATOR.exec(intlDes);
  if (m !== null) {
    const year = Number(m[1]);
    if (year >= config.firstLaunchYear && year <= Number(snapshotDate.slice(0, 4))) {
      return { year, source: 'designator' };
    }
  }
  return { year: null, source: null };
}

export function mergeSources(input: MergeInput, snapshotDate: string, config: Config = CONFIG): MergeResult {
  const satcat = new Map<number, SatcatRow>();
  for (const row of input.satcat ?? []) satcat.set(row.norad, row);
  const gp = new Map<number, GpRow>();
  for (const row of input.gp) gp.set(row.norad, row);
  const table = new Map<number, GpzTableRow>();
  for (const row of input.table) table.set(row.norad, row);

  // Population: SATCAT rows that pass the filter, plus every GP id.
  const population = new Set<number>(gp.keys());
  let outsidePopulation = 0;
  for (const row of satcat.values()) {
    if (inNearGeo(row, config)) population.add(row.norad);
    else if (!gp.has(row.norad)) outsidePopulation++;
  }

  const records: MergedRecord[] = [];
  for (const norad of [...population].sort((a, b) => a - b)) {
    const s = satcat.get(norad);
    const g = gp.get(norad);
    const t = table.get(norad);

    // Orbit: GP wins.
    let orbit: Orbit;
    let orbitSource: OrbitSource;
    let inclinationDeg: number | null;
    if (g !== undefined) {
      orbit = orbitFromMeanMotion(g.meanMotion, g.e, config);
      orbitSource = { kind: 'GP', epoch: g.epoch };
      inclinationDeg = g.inclinationDeg;
    } else {
      // The population rule guarantees a SATCAT row here.
      const row = s!;
      orbit = orbitFromAltitudes(row.apogeeKm, row.perigeeKm, config);
      orbitSource = { kind: 'SATCAT' };
      inclinationDeg = row.inclinationDeg;
    }

    // Type and status: SATCAT decides, else the GPZ table, else unknown.
    let status: ObjectKind = 'unknown';
    let statusSource: MergedRecord['statusSource'] = null;
    let objectType: string | null = null;
    let disagreement: Disagreement | null = null;
    if (s !== undefined) {
      status = kindFromSatcat(s, config);
      statusSource = 'SATCAT';
      objectType = s.objectType;
      if (t !== undefined) {
        const a = comparable(status);
        const b = comparable(kindFromTableStatus(t.status, config));
        if (a !== b) disagreement = { satcat: a, gpzTable: b };
      }
    } else if (t !== undefined) {
      status = kindFromTableStatus(t.status, config);
      statusSource = 'GPZ table';
      objectType = objectTypeOfKind(status, config);
    }

    const intlDes = (s?.intlDes ?? g?.intlDes ?? '') || null;
    const launchDate = s?.launchDate ?? null;
    const launch = launchYearOf(launchDate, intlDes, snapshotDate, config);

    records.push({
      norad,
      name: s?.name ?? g?.name ?? '',
      intlDes,
      objectType,
      status,
      statusSource,
      owner: s === undefined || s.owner === '' ? null : s.owner,
      launchDate,
      launchYear: launch.year,
      launchYearSource: launch.source,
      decayDate: s?.decayDate ?? null,
      perigeeKm: orbit.perigeeKm,
      apogeeKm: orbit.apogeeKm,
      pKm: orbit.pKm,
      qKm: orbit.qKm,
      e: orbit.e,
      inclinationDeg,
      orbitSource,
      disagreement,
    });
  }
  return { records, outsidePopulation };
}
