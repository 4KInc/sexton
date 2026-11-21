import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { classify, classifyOrbit, eraOf, iadcThresholdKm, isBorderline, marginsOf, yearsSinceLaunch } from '../src/engine/classify.ts';
import { CONFIG } from '../src/engine/config.ts';
import { parseGp } from '../src/engine/gp.ts';
import { parseGpzTable } from '../src/engine/gpz-table.ts';
import { mergeSources } from '../src/engine/merge.ts';
import type { MergedRecord, VerdictName } from '../src/engine/types.ts';

const v = (p: number, e = 0.0005, q = Math.max(p, -200)): VerdictName => classifyOrbit({ p, q, e }, CONFIG);

describe('threshold T(x)', () => {
  it('runs from 247 to 280 over the C_R·A/m range', () => {
    expect(iadcThresholdKm(CONFIG.iadc.crAmMin)).toBe(247);
    expect(iadcThresholdKm(CONFIG.iadc.crAmMax)).toBe(280);
  });
  it('property: never decreases as x grows', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.1, noNaN: true }), fc.double({ min: 0, max: 0.1, noNaN: true }), (a, b) => {
        const [x1, x2] = a <= b ? [a, b] : [b, a];
        return iadcThresholdKm(x1) <= iadcThresholdKm(x2);
      }),
    );
  });
});

describe('classifyOrbit: examples at every edge', () => {
  it('fallen exactly when q < −200', () => {
    expect(v(-300, 0.0005, -200)).toBe('unquiet'); // q = −200 is not fallen
    expect(v(-300, 0.0005, -200.0001)).toBe('fallen');
  });
  it('p = 200 is unquiet, just above is a shallow grave', () => {
    expect(v(200)).toBe('unquiet');
    expect(v(200.0001)).toBe('shallow grave');
  });
  it('p = 247 is uncertain, just below is a shallow grave', () => {
    expect(v(247)).toBe('uncertain');
    expect(v(246.9999)).toBe('shallow grave');
  });
  it('p = 280 is buried, just below is uncertain', () => {
    expect(v(280)).toBe('buried');
    expect(v(279.9999)).toBe('uncertain');
  });
  it('e = 0.003 is allowed, just above is restless', () => {
    expect(v(300, 0.003)).toBe('buried');
    expect(v(300, 0.0030001)).toBe('restless');
    expect(v(260, 0.003)).toBe('uncertain');
    expect(v(260, 0.0030001)).toBe('restless');
  });
  it('a high eccentricity does not change shallow grave or unquiet', () => {
    expect(v(230, 0.01)).toBe('shallow grave');
    expect(v(100, 0.01)).toBe('unquiet');
  });
  it('fallen wins over everything else', () => {
    expect(v(-400, 0.5, -300)).toBe('fallen');
  });
});

const rank3: Record<string, number> = { unquiet: 0, 'shallow grave': 1, uncertain: 2, buried: 3 };
const rank5: Record<string, number> = { unquiet: 0, 'shallow grave': 1, restless: 2 };
const pArb = fc.oneof(fc.double({ min: -600, max: 800, noNaN: true }), fc.integer({ min: 150, max: 320 }));

describe('classifyOrbit: properties (design 7.2)', () => {
  it('monotone for e ≤ 0.003 with q ≥ −200: raising p never worsens the verdict', () => {
    fc.assert(
      fc.property(pArb, pArb, fc.double({ min: 0, max: 0.003, noNaN: true }), (a, b, e) => {
        const [p1, p2] = a <= b ? [a, b] : [b, a];
        return rank3[v(p1, e)]! <= rank3[v(p2, e)]!;
      }),
    );
  });
  it('monotone for e > 0.003 with q ≥ −200: raising p never worsens the verdict', () => {
    fc.assert(
      fc.property(pArb, pArb, fc.double({ min: 0.0031, max: 0.9, noNaN: true }), (a, b, e) => {
        const [p1, p2] = a <= b ? [a, b] : [b, a];
        return rank5[v(p1, e)]! <= rank5[v(p2, e)]!;
      }),
    );
  });
  it('fallen exactly when q < −200', () => {
    fc.assert(
      fc.property(pArb, fc.double({ min: 0, max: 600, noNaN: true }), fc.double({ min: 0, max: 0.9, noNaN: true }), (p, extra, e) => {
        const q = p + extra; // q ≥ p
        return (classifyOrbit({ p, q, e }) === 'fallen') === (q < -200);
      }),
    );
  });
  it('never buried when e > 0.003', () => {
    fc.assert(
      fc.property(pArb, fc.double({ min: 0.0031, max: 0.9, noNaN: true }), (p, e) => v(p, e) !== 'buried'),
    );
  });
  it('all six verdicts are reachable', () => {
    const arb = fc.tuple(fc.integer({ min: -600, max: 800 }), fc.double({ min: 0, max: 600, noNaN: true }), fc.constantFrom(0.0001, 0.003, 0.0031, 0.02));
    const seen = new Set(fc.sample(arb, 3000).map(([p, extra, e]) => classifyOrbit({ p, q: p + extra, e })));
    expect([...seen].sort()).toEqual(['buried', 'fallen', 'restless', 'shallow grave', 'uncertain', 'unquiet']);
    // One fixed example per verdict.
    expect(classifyOrbit({ p: -300, q: -250, e: 0.001 })).toBe('fallen');
    expect(v(100)).toBe('unquiet');
    expect(v(230)).toBe('shallow grave');
    expect(v(300, 0.01)).toBe('restless');
    expect(v(260)).toBe('uncertain');
    expect(v(300)).toBe('buried');
  });
});

describe('borderline flag', () => {
  it('is set at exactly 25 km from an edge, and not at 26', () => {
    for (const edge of [200, 247, 280]) {
      expect(isBorderline(edge - 25), `${edge}-25`).toBe(true);
      expect(isBorderline(edge + 25), `${edge}+25`).toBe(true);
      expect(isBorderline(edge)).toBe(true);
    }
    expect(isBorderline(174)).toBe(false);
    expect(isBorderline(306)).toBe(false);
    expect(isBorderline(0)).toBe(false);
  });
  it('property: set exactly when |p − edge| ≤ 25 for an edge (quarter-km grid, so the arithmetic is exact)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2400, max: 3200 }), (n) => {
        const p = n / 4;
        const expected = [200, 247, 280].some((edge) => Math.abs(p - edge) <= 25);
        return isBorderline(p) === expected;
      }),
    );
  });
  it('is independent of the verdict: a fallen object can be borderline-free, a buried one borderline', () => {
    expect(isBorderline(285)).toBe(true);
    expect(v(285)).toBe('buried');
  });
});

describe('margins', () => {
  it('are p − 200, p − 247 and p − 280', () => {
    expect(marginsOf(300)).toEqual({ zone: 100, low: 53, high: 20 });
    expect(marginsOf(110.4).zone).toBeCloseTo(-89.6, 9);
  });
});

describe('era', () => {
  it('17 March 2002 is before the FCC rule, 18 March 2002 is not', () => {
    expect(eraOf('2002-03-17')).toBe('before FCC rule');
    expect(eraOf('2002-03-18')).toBeNull();
    expect(eraOf('2026-01-01')).toBeNull();
  });
  it('no launch date is unknown', () => {
    expect(eraOf(null)).toBe('unknown');
  });
});

describe('yearsSinceLaunch', () => {
  it('counts whole years', () => {
    expect(yearsSinceLaunch('2002-03-18', '2026-03-17')).toBe(23);
    expect(yearsSinceLaunch('2002-03-18', '2026-03-18')).toBe(24);
    expect(yearsSinceLaunch('2002-02-21', '2026-11-20')).toBe(24);
    expect(yearsSinceLaunch('2000-02-29', '2001-02-28')).toBe(0);
    expect(yearsSinceLaunch('2000-02-29', '2001-03-01')).toBe(1);
  });
  it('is null with no launch date and 0 for a launch after the snapshot', () => {
    expect(yearsSinceLaunch(null, '2026-11-20')).toBeNull();
    expect(yearsSinceLaunch('2030-01-01', '2026-11-20')).toBe(0);
  });
});

const rec = (o: Partial<MergedRecord> = {}): MergedRecord => ({
  norad: 1, name: 'N', intlDes: '2000-001A', objectType: 'PAY', status: 'retired payload', statusSource: 'SATCAT', owner: 'US',
  launchDate: '2000-01-01', launchYear: 2000, launchYearSource: 'launch date', decayDate: null,
  perigeeKm: 36086, apogeeKm: 36100, pKm: 300, qKm: 314, e: 0.0005, inclinationDeg: 0, orbitSource: { kind: 'SATCAT' }, disagreement: null, ...o,
});

describe('classify(record)', () => {
  it('gives a verdict only to retired payloads', () => {
    expect(classify(rec({ status: 'rocket body' }), '2026-11-20')).toEqual({ kind: 'unmarked bones' });
    expect(classify(rec({ status: 'debris' }), '2026-11-20')).toEqual({ kind: 'unmarked bones' });
    expect(classify(rec({ status: 'living payload' }), '2026-11-20')).toEqual({ kind: 'no verdict', reason: 'living payload' });
    expect(classify(rec({ status: 'unknown payload' }), '2026-11-20')).toEqual({ kind: 'no verdict', reason: 'unknown status' });
    expect(classify(rec({ status: 'unknown' }), '2026-11-20')).toEqual({ kind: 'no verdict', reason: 'unknown type' });
  });
  it('a retired payload gets the verdict, borderline flag, margins, era and years', () => {
    expect(classify(rec({ launchDate: '2002-03-17', pKm: 320, qKm: 334 }), '2026-11-20')).toEqual({
      kind: 'verdict',
      verdict: 'buried',
      borderline: false,
      margins: { zone: 120, low: 73, high: 40 },
      era: 'before FCC rule',
      yearsSinceLaunch: 24,
    });
  });
  it('does not carry launchYear on the verdict', () => {
    expect(Object.keys(classify(rec(), '2026-11-20')).sort()).toEqual(['borderline', 'era', 'kind', 'margins', 'verdict', 'yearsSinceLaunch']);
  });
  it('a record with no launch date has era unknown and no years', () => {
    const c = classify(rec({ launchDate: null, launchYear: 2002, launchYearSource: 'designator' }), '2026-11-20');
    expect(c).toMatchObject({ era: 'unknown', yearsSinceLaunch: null });
  });
});

describe('golden: committed GPZ files, no SATCAT', () => {
  const dir = new URL('../data/raw/2026-11-20/', import.meta.url);
  const gp = parseGp(readFileSync(new URL('gpz.csv', dir), 'utf8')).rows;
  const table = parseGpzTable(readFileSync(new URL('table-gpz.csv', dir), 'utf8')).rows;
  const { records } = mergeSources({ satcat: null, gp, table }, '2026-11-20');
  it('EchoStar-7 is unquiet at p = +110.4 km', () => {
    const r = records.find((x) => x.norad === 27378)!;
    expect(r.pKm).toBeCloseTo(110.4, 1);
    expect(Math.abs(r.pKm - 110.4)).toBeLessThan(0.05);
    expect(classify(r, '2026-11-20')).toMatchObject({ kind: 'verdict', verdict: 'unquiet' });
  });
  it('Intelsat 511 is unquiet at p = +17.6 km', () => {
    const r = records.find((x) => x.norad === 15873)!;
    expect(Math.abs(r.pKm - 17.6)).toBeLessThan(0.05);
    expect(classify(r, '2026-11-20')).toMatchObject({ kind: 'verdict', verdict: 'unquiet' });
  });
  it('every GPZ object gets a verdict of unquiet, fallen or none: the zone files stop at +200 km', () => {
    for (const r of records) {
      const c = classify(r, '2026-11-20');
      if (c.kind === 'verdict') expect(['unquiet', 'fallen']).toContain(c.verdict);
    }
  });
});
