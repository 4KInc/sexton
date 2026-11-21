// GPZ OMM CSV to rows or rejections (design 2.4, R1.2, R1.10). Pure. Never throws.
import { findColumns, missingHeaderRejection, parseCsv, resolveDuplicates, sortRejections, unexpectedError } from './csv.ts';
import type { CsvRow } from './csv.ts';
import type { Rejection } from './types.ts';
import { isIsoDateTime, parseNumber, parsePositiveInteger } from './values.ts';

export const GP_SOURCE = 'gpz.csv';

const REQUIRED = [
  'NORAD_CAT_ID',
  'OBJECT_NAME',
  'OBJECT_ID',
  'EPOCH',
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
] as const;

export interface GpRow {
  norad: number;
  line: number;
  raw: string;
  name: string;
  intlDes: string;
  epoch: string;
  /** rev/day */
  meanMotion: number;
  e: number;
  inclinationDeg: number;
}

export interface GpParse {
  rows: GpRow[];
  rejections: Rejection[];
}

function readRow(row: CsvRow, col: Record<string, number>): GpRow | Rejection {
  const reject = (reason: string): Rejection => ({ source: GP_SOURCE, line: row.line, reason });
  const f = (name: string): string => (row.fields[col[name]!] ?? '').trim();

  const norad = parsePositiveInteger(f('NORAD_CAT_ID'));
  if (norad === null) return reject('NORAD_CAT_ID is missing or not a positive whole number');
  const epoch = f('EPOCH');
  if (!isIsoDateTime(epoch)) return reject('EPOCH is not YYYY-MM-DDTHH:MM:SS');
  const meanMotion = parseNumber(f('MEAN_MOTION'));
  if (meanMotion === null) return reject('MEAN_MOTION is not a number');
  if (meanMotion <= 0) return reject('MEAN_MOTION is not above 0');
  const e = parseNumber(f('ECCENTRICITY'));
  if (e === null) return reject('ECCENTRICITY is not a number');
  if (e < 0 || e >= 1) return reject('ECCENTRICITY is outside [0, 1)');
  const inclinationDeg = parseNumber(f('INCLINATION'));
  if (inclinationDeg === null) return reject('INCLINATION is not a number');

  return {
    norad,
    line: row.line,
    raw: row.raw,
    name: f('OBJECT_NAME'),
    intlDes: f('OBJECT_ID'),
    epoch,
    meanMotion,
    e,
    inclinationDeg,
  };
}

export function parseGp(text: string): GpParse {
  const rejections: Rejection[] = [];
  try {
    const csv = parseCsv(text);
    const header = csv[0];
    if (header === undefined) return { rows: [], rejections: [{ source: GP_SOURCE, line: 0, reason: 'file is empty' }] };
    const cols = findColumns(header.fields, REQUIRED);
    if (!cols.ok) return { rows: [], rejections: [missingHeaderRejection(GP_SOURCE, header.line, cols.missing)] };
    const good: GpRow[] = [];
    for (const row of csv.slice(1)) {
      try {
        if (row.fields.length !== header.fields.length) {
          rejections.push({
            source: GP_SOURCE,
            line: row.line,
            reason: `wrong field count: ${row.fields.length}, header has ${header.fields.length}`,
          });
          continue;
        }
        const result = readRow(row, cols.index);
        if ('reason' in result) rejections.push(result);
        else good.push(result);
      } catch (error) {
        rejections.push({ ...unexpectedError(GP_SOURCE, error), line: row.line });
      }
    }
    // Duplicates: the newer EPOCH wins. If epochs tie, the smaller raw line wins.
    const rows = resolveDuplicates(
      good,
      GP_SOURCE,
      (a, b) => (a.epoch !== b.epoch ? a.epoch > b.epoch : a.raw < b.raw),
      rejections,
    );
    return { rows, rejections: sortRejections(rejections) };
  } catch (error) {
    return { rows: [], rejections: [unexpectedError(GP_SOURCE, error)] };
  }
}
