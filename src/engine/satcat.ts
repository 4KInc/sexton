// SATCAT CSV to rows or rejections (design 2.4, R1.1, R1.10, R1.11). Pure. Never throws.
import { CONFIG } from './config.ts';
import type { Config } from './config.ts';
import { findColumns, missingHeaderRejection, parseCsv, resolveDuplicates, sortRejections, unexpectedError } from './csv.ts';
import type { CsvRow } from './csv.ts';
import { eccentricityFromAltitudes } from './orbit.ts';
import type { Rejection } from './types.ts';
import { isIsoDate, parseNumber, parsePositiveInteger } from './values.ts';

export const SATCAT_SOURCE = 'satcat.csv';

const REQUIRED = [
  'OBJECT_NAME',
  'OBJECT_ID',
  'NORAD_CAT_ID',
  'OBJECT_TYPE',
  'OPS_STATUS_CODE',
  'OWNER',
  'LAUNCH_DATE',
  'DECAY_DATE',
  'INCLINATION',
  'APOGEE',
  'PERIGEE',
  'ORBIT_CENTER',
] as const;

export interface SatcatRow {
  norad: number;
  line: number;
  raw: string;
  name: string;
  intlDes: string;
  objectType: string;
  opsStatusCode: string;
  owner: string;
  launchDate: string | null;
  decayDate: string | null;
  inclinationDeg: number | null;
  /** Altitude, km. */
  apogeeKm: number;
  /** Altitude, km. */
  perigeeKm: number;
  orbitCenter: string;
}

export interface SatcatParse {
  rows: SatcatRow[];
  rejections: Rejection[];
  /** Rows with a blank APOGEE or PERIGEE. Not rejections (R1.11). */
  noOrbitDataCount: number;
}

function readRow(row: CsvRow, col: Record<string, number>, config: Config): SatcatRow | Rejection | 'no orbit data' {
  const reject = (reason: string): Rejection => ({ source: SATCAT_SOURCE, line: row.line, reason });
  const f = (name: string): string => (row.fields[col[name]!] ?? '').trim();

  const norad = parsePositiveInteger(f('NORAD_CAT_ID'));
  if (norad === null) return reject('NORAD_CAT_ID is missing or not a positive whole number');

  if (f('APOGEE') === '' || f('PERIGEE') === '') return 'no orbit data';

  const apogeeKm = parseNumber(f('APOGEE'));
  if (apogeeKm === null) return reject('APOGEE is not a number');
  const perigeeKm = parseNumber(f('PERIGEE'));
  if (perigeeKm === null) return reject('PERIGEE is not a number');
  if (apogeeKm < perigeeKm) return reject('APOGEE is below PERIGEE');

  const launchDate = f('LAUNCH_DATE');
  if (launchDate !== '' && !isIsoDate(launchDate)) return reject('LAUNCH_DATE is not YYYY-MM-DD');
  const decayDate = f('DECAY_DATE');
  if (decayDate !== '' && !isIsoDate(decayDate)) return reject('DECAY_DATE is not YYYY-MM-DD');

  let inclinationDeg: number | null = null;
  if (f('INCLINATION') !== '') {
    inclinationDeg = parseNumber(f('INCLINATION'));
    if (inclinationDeg === null) return reject('INCLINATION is not a number');
  }

  const e = eccentricityFromAltitudes(apogeeKm, perigeeKm, config);
  if (!(e >= 0 && e < 1)) return reject('eccentricity from APOGEE and PERIGEE is outside [0, 1)');

  return {
    norad,
    line: row.line,
    raw: row.raw,
    name: f('OBJECT_NAME'),
    intlDes: f('OBJECT_ID'),
    objectType: f('OBJECT_TYPE'),
    opsStatusCode: f('OPS_STATUS_CODE'),
    owner: f('OWNER'),
    launchDate: launchDate === '' ? null : launchDate,
    decayDate: decayDate === '' ? null : decayDate,
    inclinationDeg,
    apogeeKm,
    perigeeKm,
    orbitCenter: f('ORBIT_CENTER'),
  };
}

export function parseSatcat(text: string, config: Config = CONFIG): SatcatParse {
  const rejections: Rejection[] = [];
  try {
    const csv = parseCsv(text);
    const header = csv[0];
    if (header === undefined) {
      return { rows: [], rejections: [{ source: SATCAT_SOURCE, line: 0, reason: 'file is empty' }], noOrbitDataCount: 0 };
    }
    const cols = findColumns(header.fields, REQUIRED);
    if (!cols.ok) {
      return { rows: [], rejections: [missingHeaderRejection(SATCAT_SOURCE, header.line, cols.missing)], noOrbitDataCount: 0 };
    }
    const good: SatcatRow[] = [];
    let noOrbitDataCount = 0;
    for (const row of csv.slice(1)) {
      try {
        if (row.fields.length !== header.fields.length) {
          rejections.push({
            source: SATCAT_SOURCE,
            line: row.line,
            reason: `wrong field count: ${row.fields.length}, header has ${header.fields.length}`,
          });
          continue;
        }
        const result = readRow(row, cols.index, config);
        if (result === 'no orbit data') noOrbitDataCount++;
        else if ('reason' in result) rejections.push(result);
        else good.push(result);
      } catch (error) {
        rejections.push({ ...unexpectedError(SATCAT_SOURCE, error), line: row.line });
      }
    }
    // Duplicates: the smaller raw line wins, whatever the row order.
    const rows = resolveDuplicates(good, SATCAT_SOURCE, (a, b) => a.raw < b.raw, rejections);
    return { rows, rejections: sortRejections(rejections), noOrbitDataCount };
  } catch (error) {
    return { rows: [], rejections: [unexpectedError(SATCAT_SOURCE, error)], noOrbitDataCount: 0 };
  }
}
