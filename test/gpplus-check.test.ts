// The SATCAT-only story stones against the 2026-11-20 gpz-plus.csv mean elements (evidence only, not a source of any verdict).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { causeGroup } from '../src/engine/causes.ts';
import type { Register } from '../src/engine/types.ts';
import { GP_PLUS_FILE, compareSatcatToGpPlus, largestDifference, renderTable, signedKm } from '../scripts/compare-gpplus.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const real = JSON.parse(read('data/register.json')) as Register;
const result = compareSatcatToGpPlus(real.records, read(GP_PLUS_FILE));
const methodology = read('docs/methodology.md');
describe('SATCAT-only story stones against gpz-plus.csv', () => {
  it('15 of the 36 story stones rest on SATCAT alone, and 12 of them have a row in the file', () => {
    expect(causeGroup(real.records)).toHaveLength(36);
    expect(result.stones).toBe(15);
    expect(result.rows).toHaveLength(12);
    expect(result.missing).toEqual([28132, 32373, 37779]);
  });
  it('every difference is GP-PLUS minus SATCAT, and the largest is under 1 km, far inside the ±25 km band', () => {
    for (const r of result.rows) {
      expect(r.dP).toBeCloseTo(r.gpP - r.satcatP, 9);
      expect(r.dQ).toBeCloseTo(r.gpQ - r.satcatQ, 9);
    }
    const max = largestDifference(result.rows);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThan(1);
    expect(max).toBeLessThan(25);
  });
  it('the largest difference is the maximum of every |p| and |q| difference', () => {
    const all = result.rows.flatMap((r) => [Math.abs(r.dP), Math.abs(r.dQ)]);
    expect(largestDifference(result.rows)).toBe(Math.max(...all));
  });
  it('docs/methodology.md carries the table and the counts exactly as computed', () => {
    expect(methodology).toContain(renderTable(result.rows));
    expect(methodology).toContain(`The largest difference in p or q is ${largestDifference(result.rows).toFixed(1)} km`);
    expect(methodology).toContain(`${result.stones} of the 36 story stones`);
    expect(methodology).toContain(`mean elements for ${result.rows.length} of them`);
    expect(methodology).toContain(`The ${result.missing.length} stones with no row in the file are AMOS-2 (28132), RADUGA-1M 1 (32373) and PAKSAT-1R (37779)`);
  });
  it('signedKm writes a sign and one decimal place', () => {
    expect(signedKm(193)).toBe('+193.0');
    expect(signedKm(-0.7)).toBe('\u22120.7');
    expect(signedKm(0)).toBe('+0.0');
  });
  it('the gpz-plus.csv file stays evidence: the engine does not read it', () => {
    const engine = ['engine.ts', 'gp.ts', 'merge.ts', 'classify.ts'].map((f) => read(`src/engine/${f}`)).join('\n');
    expect(engine).not.toMatch(/gpz-plus|gpzPlus/i);
  });
});
