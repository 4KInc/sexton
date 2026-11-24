// Property tests added in polish step 5, for invariants that had no test of their own.
// The other invariants are in test/classify.test.ts, test/orbit.test.ts and test/merge.test.ts (see docs/kiro-usage.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { classify, classifyOrbit } from '../src/engine/classify.ts';
import { CONFIG } from '../src/engine/config.ts';
import { runEngine } from '../src/engine/engine.ts';
import { parseGp } from '../src/engine/gp.ts';
import { orbitFromMeanMotion } from '../src/engine/orbit.ts';
import type { MergedRecord, SatRecord } from '../src/engine/types.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const DATE = '2026-11-20';
const FIX = {
  satcatCsv: read('test/fixtures/snapshot/satcat.csv'),
  gpzCsv: read('test/fixtures/snapshot/gpz.csv'),
  gpzTableHtml: read('test/fixtures/snapshot/table-gpz.csv'),
};
const real = JSON.parse(read('data/register.json')) as { records: SatRecord[]; snapshot: { set: string } };

describe('mean motion and semi-major axis round-trip', () => {
  it('property: a → mean motion (rev/day) → a, to 1e-9 relative', () => {
    const { muKm3PerS2, secondsPerDay } = CONFIG.earth;
    fc.assert(
      fc.property(fc.double({ min: 6600, max: 90000, noNaN: true }), (a) => {
        const nRadPerS = Math.sqrt(muKm3PerS2 / a ** 3);
        const revPerDay = (nRadPerS * secondsPerDay) / (2 * Math.PI);
        const back = orbitFromMeanMotion(revPerDay, 0, CONFIG).semiMajorAxisKm;
        return Math.abs(back - a) / a < 1e-9;
      }),
    );
  });
  it('example: one revolution per sidereal-ish day gives the GEO radius to within 1 km', () => {
    const a = orbitFromMeanMotion(1.00273791, 0, CONFIG).semiMajorAxisKm;
    expect(Math.abs(a - (CONFIG.geoAltitudeKm + CONFIG.earth.radiusKm))).toBeLessThan(1);
  });
});

describe('input order does not change the result', () => {
  const lines = (csv: string): { head: string; rows: string[] } => {
    const [head = '', ...rows] = csv.trim().split(/\r?\n/);
    return { head, rows };
  };
  const satcat = lines(FIX.satcatCsv);
  const gpz = lines(FIX.gpzCsv);
  const baseline = runEngine({ ...FIX, snapshotDate: DATE });
  it('property: shuffling the SATCAT rows and the GP rows gives the same records and census', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(satcat.rows, { minLength: satcat.rows.length, maxLength: satcat.rows.length }), fc.shuffledSubarray(gpz.rows, { minLength: gpz.rows.length, maxLength: gpz.rows.length }), (s, g) => {
        const out = runEngine({ ...FIX, satcatCsv: [satcat.head, ...s].join('\n'), gpzCsv: [gpz.head, ...g].join('\n'), snapshotDate: DATE });
        return JSON.stringify(out.records) === JSON.stringify(baseline.records) && JSON.stringify(out.census) === JSON.stringify(baseline.census);
      }),
      { numRuns: 60 },
    );
  });
});

describe('the CSV path and the JSON register agree', () => {
  it('the engine has no JSON data parser; the register is the JSON form, so every committed verdict is reproduced from its JSON record', () => {
    expect(real.snapshot.set).toBe('2026-11-22');
    let checked = 0;
    for (const r of real.records) {
      if (r.verdict.kind !== 'verdict') continue;
      const { verdict: stored, caseFile: _caseFile, ...merged } = r;
      expect(classify(merged as MergedRecord, real.snapshot.set), String(r.norad)).toEqual(stored);
      checked++;
    }
    expect(checked).toBe(696);
  });
  it('property: a record gives the same classification after a JSON round trip', () => {
    const arb = fc.record({
      p: fc.double({ min: -600, max: 900, noNaN: true }),
      extra: fc.double({ min: 0, max: 300, noNaN: true }),
      e: fc.double({ min: 0, max: 0.01, noNaN: true }),
      year: fc.integer({ min: 1964, max: 2026 }),
    });
    fc.assert(
      fc.property(arb, ({ p, extra, e, year }) => {
        const rec = {
          norad: 1, name: 'T', intlDes: null, objectType: 'PAY', status: 'retired payload', statusSource: 'SATCAT', owner: null,
          launchDate: `${year}-06-15`, launchYear: year, launchYearSource: 'launch date', decayDate: null,
          perigeeKm: 35786 + p, apogeeKm: 35786 + p + extra, pKm: p, qKm: p + extra, e, inclinationDeg: 0.1,
          orbitSource: { kind: 'SATCAT' }, disagreement: null,
        } as MergedRecord;
        return JSON.stringify(classify(rec, DATE)) === JSON.stringify(classify(JSON.parse(JSON.stringify(rec)) as MergedRecord, DATE));
      }),
    );
  });
  it('property: a GP CSV row classifies like the same mean motion and eccentricity given directly', () => {
    const head = 'OBJECT_NAME,OBJECT_ID,EPOCH,MEAN_MOTION,ECCENTRICITY,INCLINATION,NORAD_CAT_ID';
    fc.assert(
      fc.property(fc.double({ min: 0.95, max: 1.05, noNaN: true }), fc.double({ min: 0, max: 0.01, noNaN: true }), (n, e) => {
        const parsed = parseGp(`${head}\nTEST,2000-001A,2026-11-20T00:00:00.000000,${n},${e},0.1,12345\n`);
        if (parsed.rows.length !== 1) return false;
        const row = parsed.rows[0]!;
        const verdictOf = (mm: number, ecc: number): string => {
          const o = orbitFromMeanMotion(mm, ecc, CONFIG);
          return classifyOrbit({ p: o.pKm, q: o.qKm, e: o.e }, CONFIG);
        };
        return row.meanMotion === n && row.e === e && verdictOf(row.meanMotion, row.e) === verdictOf(n, e);
      }),
    );
  });
});
