// Census (design 2.8, R5). Counts only: no percentages. Pure.
// Each grouping is built in one pass over the same list, so its counts add up to that list's length.
import type { Census, ObjectKind, SatRecord, VerdictCounts, VerdictName } from './types.ts';

export const VERDICT_NAMES: readonly VerdictName[] = ['fallen', 'unquiet', 'shallow grave', 'restless', 'uncertain', 'buried'];
export const OBJECT_KINDS: readonly ObjectKind[] = [
  'retired payload',
  'living payload',
  'unknown payload',
  'rocket body',
  'debris',
  'unknown',
];

/** The owner key for a record with no owner. */
export const UNKNOWN_OWNER = 'unknown';

const zeroVerdicts = (): VerdictCounts => ({ fallen: 0, unquiet: 0, 'shallow grave': 0, restless: 0, uncertain: 0, buried: 0 });

export interface CensusExtras {
  snapshotDate: string;
  /** SATCAT rows that are not in the population. */
  outsidePopulation: number;
  rejectedRows: number;
  noOrbitData: number;
}

/** The key of one (SATCAT, GPZ table) disagreement pair, for example "living payload | retired payload". */
export const pairKey = (satcat: ObjectKind, gpzTable: ObjectKind): string => `${satcat} | ${gpzTable}`;

export function buildCensus(records: readonly SatRecord[], extras: CensusExtras): Census {
  const byType = Object.fromEntries(OBJECT_KINDS.map((k) => [k, 0])) as Record<ObjectKind, number>;
  const byVerdict = zeroVerdicts();
  const borderline = { yes: 0, no: 0 };
  const era = { beforeRule: 0, onOrAfterRule: 0, unknown: 0 };
  const orbitSource = { GP: 0, SATCAT: 0 };
  const owners = new Map<string, VerdictCounts>();
  const pairs = new Map<string, number>();
  let retiredTotal = 0;
  let disagreementTotal = 0;

  for (const r of records) {
    byType[r.status]++;
    if (r.disagreement !== null) {
      disagreementTotal++;
      const key = pairKey(r.disagreement.satcat, r.disagreement.gpzTable);
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    const v = r.verdict;
    if (v.kind !== 'verdict') continue;
    retiredTotal++;
    byVerdict[v.verdict]++;
    if (v.borderline) borderline.yes++;
    else borderline.no++;
    if (v.era === 'before FCC rule') era.beforeRule++;
    else if (v.era === 'unknown') era.unknown++;
    else era.onOrAfterRule++;
    if (r.orbitSource.kind === 'GP') orbitSource.GP++;
    else orbitSource.SATCAT++;
    const owner = r.owner ?? UNKNOWN_OWNER;
    let counts = owners.get(owner);
    if (counts === undefined) {
      counts = zeroVerdicts();
      owners.set(owner, counts);
    }
    counts[v.verdict]++;
  }

  // Map and Object.fromEntries keep owner codes such as "__proto__" as plain keys.
  const sorted = <T>(m: Map<string, T>): Record<string, T> =>
    Object.fromEntries([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

  return {
    snapshotDate: extras.snapshotDate,
    population: {
      total: records.length,
      outsidePopulation: extras.outsidePopulation,
      rejectedRows: extras.rejectedRows,
      noOrbitData: extras.noOrbitData,
    },
    byType,
    retired: { total: retiredTotal, byVerdict, borderline, era, orbitSource, byOwner: sorted(owners) },
    disagreements: { total: disagreementTotal, pairs: sorted(pairs) },
  };
}
