// Evidence check: for the story stones whose orbit comes from SATCAT whole-km altitudes alone, compare SATCAT p and q
// with the mean elements in the 2026-11-20 gpz-plus.csv. The file is evidence only. It is not a source of any verdict.
// Run: node scripts/compare-gpplus.ts   (prints the markdown table that docs/methodology.md carries)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/engine/config.ts';
import type { Config } from '../src/engine/config.ts';
import { causeGroup } from '../src/engine/causes.ts';
import { findColumns, parseCsv } from '../src/engine/csv.ts';
import { orbitFromMeanMotion } from '../src/engine/orbit.ts';
import type { SatRecord } from '../src/engine/types.ts';
import { isMain } from './is-main.ts';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GP_PLUS_FILE = 'data/raw/2026-11-20/gpz-plus.csv';
export interface GpPlusRow {
  norad: number;
  name: string;
  /** SATCAT, from the register. */
  satcatP: number;
  satcatQ: number;
  /** From the mean elements in gpz-plus.csv. */
  epoch: string;
  gpP: number;
  gpQ: number;
  /** GP-PLUS minus SATCAT, in km. */
  dP: number;
  dQ: number;
}
/** The story stones with a SATCAT-only orbit, in NORAD order, each compared with its GP-PLUS elements. A stone with no GP-PLUS row is left out of the rows and listed in `missing`. */
export function compareSatcatToGpPlus(records: readonly SatRecord[], gpPlusCsv: string, config: Config = CONFIG): { rows: GpPlusRow[]; missing: number[]; stones: number } {
  const stones = causeGroup(records).filter((r) => r.orbitSource.kind === 'SATCAT');
  const csv = parseCsv(gpPlusCsv);
  const header = csv[0]?.fields ?? [];
  const cols = findColumns(header, ['EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'NORAD_CAT_ID']);
  const byNorad = new Map<number, string[]>();
  if (cols.ok) for (const row of csv.slice(1)) byNorad.set(Number(row.fields[cols.index['NORAD_CAT_ID']!]), row.fields);
  const rows: GpPlusRow[] = [];
  const missing: number[] = [];
  for (const r of stones) {
    const f = byNorad.get(r.norad);
    if (f === undefined || !cols.ok) {
      missing.push(r.norad);
      continue;
    }
    const o = orbitFromMeanMotion(Number(f[cols.index['MEAN_MOTION']!]), Number(f[cols.index['ECCENTRICITY']!]), config);
    rows.push({ norad: r.norad, name: r.name, satcatP: r.pKm, satcatQ: r.qKm, epoch: f[cols.index['EPOCH']!]!, gpP: o.pKm, gpQ: o.qKm, dP: o.pKm - r.pKm, dQ: o.qKm - r.qKm });
  }
  return { rows, missing, stones: stones.length };
}
/** The largest absolute difference in p or q, in km. */
export const largestDifference = (rows: readonly GpPlusRow[]): number => rows.reduce((m, r) => Math.max(m, Math.abs(r.dP), Math.abs(r.dQ)), 0);
/** The markdown table that docs/methodology.md carries. */
export function renderTable(rows: readonly GpPlusRow[]): string {
  const head = '| NORAD | Name | SATCAT p | SATCAT q | GP-PLUS p | GP-PLUS q | Difference in p | Difference in q |\n| --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map((r) => `| ${r.norad} | ${r.name} | ${signedKm(r.satcatP)} | ${signedKm(r.satcatQ)} | ${signedKm(r.gpP)} | ${signedKm(r.gpQ)} | ${signedKm(r.dP)} | ${signedKm(r.dQ)} |`);
  return [head, ...body].join('\n');
}
/** One value in km with a sign and one decimal place: "+193.0", "\u2212238.0". */
export const signedKm = (x: number): string => {
  const t = Math.abs(x).toFixed(1);
  return (x < -0.049 ? '\u2212' : '+') + t;
};
export function main(): number {
  const register = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as { records: SatRecord[] };
  const { rows, missing, stones } = compareSatcatToGpPlus(register.records, readFileSync(join(ROOT, GP_PLUS_FILE), 'utf8'));
  console.log(renderTable(rows));
  console.log(`\n${rows.length} of ${stones} compared. Missing from the file: ${missing.join(', ') || 'none'}. Largest difference: ${largestDifference(rows).toFixed(1)} km.`);
  return 0;
}
if (isMain(import.meta.url)) process.exitCode = main();
