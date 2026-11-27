// The post-rule headline and the validation rate (polish steps 1 and 2). Pure functions over the records.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { classify } from '../src/engine/classify.ts';
import { CONFIG } from '../src/engine/config.ts';
import { disposalRate, postRuleSummary } from '../src/engine/headline.ts';
import type { MergedRecord, SatRecord } from '../src/engine/types.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as { records: SatRecord[]; snapshot: { set: string } };

function rec(norad: number, launchDate: string | null, p: number, e = 0.0005, status: MergedRecord['status'] = 'retired payload'): SatRecord {
  const merged: MergedRecord = {
    norad, name: `T${norad}`, intlDes: null, objectType: 'PAY', status, statusSource: 'SATCAT', owner: null,
    launchDate, launchYear: launchDate === null ? null : Number(launchDate.slice(0, 4)), launchYearSource: launchDate === null ? null : 'launch date',
    decayDate: null, perigeeKm: 35786 + p, apogeeKm: 35786 + p + 10, pKm: p, qKm: p + 10, e, inclinationDeg: 0.1,
    orbitSource: { kind: 'SATCAT' }, disagreement: null,
  };
  return { ...merged, verdict: classify(merged, '2026-11-22'), caseFile: false };
}

describe('postRuleSummary', () => {
  it('splits by era with examples at the rule date', () => {
    const s = postRuleSummary([
      rec(1, '2002-03-17', 100),
      rec(2, '2002-03-18', 100),
      rec(3, '2010-01-01', 300),
      rec(4, '2010-01-01', 260),
      rec(5, '2010-01-01', 230),
      rec(6, null, 300),
      rec(7, '2010-01-01', 300, 0.0005, 'living payload'),
    ]);
    expect(s).toMatchObject({ retired: 6, predate: 1, unknownLaunch: 1, postRule: 4, inOrNearZone: 2, belowThreshold: 2 });
    expect(s.byVerdict).toMatchObject({ unquiet: 1, buried: 1, uncertain: 1, 'shallow grave': 1 });
  });
  it('golden: the committed register, snapshot 2026-11-22', () => {
    expect(real.snapshot.set).toBe('2026-11-22');
    const s = postRuleSummary(real.records);
    expect(s).toMatchObject({ retired: 696, predate: 565, unknownLaunch: 0, postRule: 131, inOrNearZone: 36, belowThreshold: 36 });
    expect(s.byVerdict).toMatchObject({ buried: 81, uncertain: 14, unquiet: 33, 'shallow grave': 3, fallen: 0, restless: 0 });
  });
  it('property: the parts add up, and the order of the records does not matter', () => {
    const recArb = fc.record({
      year: fc.option(fc.integer({ min: 1960, max: 2026 }), { nil: null }),
      p: fc.double({ min: -500, max: 900, noNaN: true }),
      e: fc.double({ min: 0, max: 0.01, noNaN: true }),
      alive: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(recArb, { maxLength: 40 }), (rows) => {
        const records = rows.map((r, i) => rec(i + 1, r.year === null ? null : `${r.year}-06-15`, r.p, r.e, r.alive ? 'living payload' : 'retired payload'));
        const s = postRuleSummary(records);
        const sum = Object.values(s.byVerdict).reduce((a, b) => a + b, 0);
        const reversed = postRuleSummary([...records].reverse());
        return s.predate + s.unknownLaunch + s.postRule === s.retired && sum === s.postRule && s.inOrNearZone <= s.belowThreshold && JSON.stringify(s) === JSON.stringify(reversed);
      }),
    );
  });
});

describe('disposalRate', () => {
  it('counts launches after the year only, with the band from the ±25 km uncertainty', () => {
    expect(CONFIG.validation.afterLaunchYear).toBe(2007);
    const r = disposalRate([
      rec(1, '2007-12-31', 400), // 2007 is not after 2007
      rec(2, '2008-01-01', 400), // buried in every case
      rec(3, '2008-01-01', 290), // buried, but 25 km lower is uncertain
      rec(4, '2008-01-01', 240), // shallow grave, but 25 km higher is uncertain
      rec(5, '2008-01-01', 100), // unquiet in every case
      rec(6, null, 400), // no launch year
    ]);
    expect(r).toMatchObject({ n: 4, noLaunchYear: 1, lower: 1, central: 2, upper: 3 });
  });
  it('golden: the committed register, launched after 2007', () => {
    const r = disposalRate(real.records);
    expect(r.n).toBe(45);
    expect(r.central).toBe(27);
    expect(r.lower).toBeLessThanOrEqual(r.central);
    expect(r.upper).toBeGreaterThanOrEqual(r.central);
  });
  it('property: lower ≤ central ≤ upper ≤ n for any records', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ year: fc.integer({ min: 2000, max: 2026 }), p: fc.double({ min: -500, max: 900, noNaN: true }), e: fc.double({ min: 0, max: 0.01, noNaN: true }) }), { maxLength: 40 }),
        (rows) => {
          const r = disposalRate(rows.map((x, i) => rec(i + 1, `${x.year}-06-15`, x.p, x.e)));
          return r.lower <= r.central && r.central <= r.upper && r.upper <= r.n;
        },
      ),
    );
  });
});

describe('docs/methodology.md states the numbers the engine gives', () => {
  const doc = readFileSync(join(ROOT, 'docs/methodology.md'), 'utf8');
  const pct = (n: number, of: number): string => ((100 * n) / of).toFixed(1);
  it('the validation result for snapshot 2026-11-22', () => {
    expect(real.snapshot.set).toBe('2026-11-22');
    const r = disposalRate(real.records);
    expect(doc).toContain(`${r.central} of ${r.n} retired payloads launched after ${r.afterLaunchYear} are buried (${pct(r.central, r.n)}%)`);
    expect(doc).toContain(`${r.lower} of ${r.n} (${pct(r.lower, r.n)}%) to ${r.upper} of ${r.n} (${pct(r.upper, r.n)}%)`);
    expect(doc).toContain(`${(100 / r.n).toFixed(1)} percentage points of ${r.n}`);
  });
  it('the retired payloads that predate the rule', () => {
    const s = postRuleSummary(real.records);
    expect(doc).toContain(`${s.predate} of ${s.retired} retired payloads predate any guideline`);
  });
});

describe('README.md headline states the numbers the engine gives', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  it('the post-rule group, the predate count and the cause line for snapshot 2026-11-22', () => {
    const s = postRuleSummary(real.records);
    const r = disposalRate(real.records);
    const pct = (n: number, of: number): string => ((100 * n) / of).toFixed(1);
    expect(readme).toContain(`${s.postRule} of the ${s.retired} retired payloads`);
    expect(readme).toContain(`${s.inOrNearZone} of those ${s.postRule} (${pct(s.inOrNearZone, s.postRule)}%)`);
    expect(readme).toContain(`${s.predate} of ${s.retired} retired payloads predate any guideline`);
    // The ESA comparison moved to docs/methodology.md (R14.6). The README carries the cause line instead (test/causes.test.ts).
    expect(r.n).toBe(45);
    expect(readme).not.toMatch(/\bESA\b/);
    expect(readme).toContain('CelesTrak snapshot, 22 Nov 2026');
  });
});
