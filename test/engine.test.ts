import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { buildCensus, OBJECT_KINDS, VERDICT_NAMES } from '../src/engine/census.ts';
import { classify } from '../src/engine/classify.ts';
import { runEngine } from '../src/engine/engine.ts';
import type { MergedRecord, ObjectKind, SatRecord, VerdictCounts } from '../src/engine/types.ts';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const FIX = {
  satcatCsv: read('./fixtures/snapshot/satcat.csv'),
  gpzCsv: read('./fixtures/snapshot/gpz.csv'),
  gpzTableHtml: read('./fixtures/snapshot/table-gpz.csv'),
};
const REAL = { gpzCsv: read('../data/raw/2026-11-20/gpz.csv'), gpzTableHtml: read('../data/raw/2026-11-20/table-gpz.csv') };
const DATE = '2026-11-20';
const sum = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0);
const zero: VerdictCounts = { fallen: 0, unquiet: 0, 'shallow grave': 0, restless: 0, uncertain: 0, buried: 0 };

describe('runEngine on the fixtures', () => {
  const out = runEngine({ ...FIX, snapshotDate: DATE });
  it('gives the expected verdict counts for retired payloads', () => {
    expect(out.census.retired.total).toBe(20);
    expect(out.census.retired.byVerdict).toEqual({ fallen: 2, unquiet: 6, 'shallow grave': 1, restless: 1, uncertain: 1, buried: 9 });
  });
  it('counts object types: unmarked bones and objects with no verdict', () => {
    expect(out.census.byType).toEqual({
      'retired payload': 20, 'living payload': 8, 'unknown payload': 2, 'rocket body': 1, debris: 1, unknown: 1,
    });
    expect(out.records.filter((r) => r.verdict.kind === 'unmarked bones')).toHaveLength(2);
    expect(out.records.filter((r) => r.verdict.kind === 'no verdict')).toHaveLength(11);
  });
  it('counts borderline, era, orbit source and disagreements', () => {
    expect(out.census.retired.borderline).toEqual({ yes: 9, no: 11 });
    expect(out.census.retired.era).toEqual({ beforeRule: 4, onOrAfterRule: 14, unknown: 2 });
    expect(out.census.retired.orbitSource).toEqual({ GP: 3, SATCAT: 17 });
    expect(out.census.disagreements).toEqual({ total: 1, pairs: { 'living payload | retired payload': 1 } });
  });
  it('counts the US owner row by verdict, and an unknown owner on its own key', () => {
    expect(out.census.retired.byOwner['US']).toEqual({ ...zero, fallen: 2, unquiet: 1, buried: 3 });
    expect(out.census.retired.byOwner['unknown']).toEqual({ ...zero, unquiet: 1, buried: 1 });
  });
  it('counts population, rejected rows and no-orbit-data rows', () => {
    expect(out.census.population).toEqual({ total: 33, outsidePopulation: 4, rejectedRows: 6, noOrbitData: 2 });
    expect(out.census.snapshotDate).toBe(DATE);
    expect(out.rejections).toHaveLength(6);
    expect(out.noOrbitDataCount).toBe(2);
  });
  it('sets caseFile false (build-register sets it)', () => {
    expect(out.records.every((r) => r.caseFile === false)).toBe(true);
  });
});

describe('runEngine with no SATCAT, on the committed GPZ files', () => {
  const out = runEngine({ ...REAL, snapshotDate: DATE });
  it('runs and takes every status from the GPZ table', () => {
    expect(out.records).toHaveLength(863);
    expect(out.rejections).toEqual([]);
    expect(out.records.every((r) => r.statusSource === 'GPZ table')).toBe(true);
    expect(out.census.byType).toEqual({
      'retired payload': 238, 'living payload': 542, 'unknown payload': 0, 'rocket body': 70, debris: 13, unknown: 0,
    });
  });
  it('puts all 238 retired payloads in unquiet: the zone files stop at +200 km', () => {
    expect(out.census.retired.total).toBe(238);
    expect(out.census.retired.byVerdict).toEqual({ ...zero, unquiet: 238 });
    expect(out.census.retired.borderline).toEqual({ yes: 0, no: 238 });
    expect(out.census.retired.era).toEqual({ beforeRule: 0, onOrAfterRule: 0, unknown: 238 });
    expect(out.census.retired.byOwner).toEqual({ unknown: { ...zero, unquiet: 238 } });
  });
  it('has no records at all without any input', () => {
    const empty = runEngine({ snapshotDate: DATE });
    expect(empty.records).toEqual([]);
    expect(empty.census.population.total).toBe(0);
  });
});

// A random record list, made consistent by running every merged record through classify.
const kindArb = fc.constantFrom<ObjectKind>(...OBJECT_KINDS);
const mergedArb: fc.Arbitrary<MergedRecord> = fc.record({
  norad: fc.integer({ min: 1, max: 999999 }),
  name: fc.constant('N'),
  intlDes: fc.constant(null),
  objectType: fc.constant(null),
  status: kindArb,
  statusSource: fc.constantFrom('SATCAT' as const, 'GPZ table' as const, null),
  owner: fc.option(fc.constantFrom('US', 'FR', 'JP', '__proto__', 'constructor', 'unknown'), { nil: null }),
  launchDate: fc.option(fc.constantFrom('1980-05-05', '2002-03-17', '2002-03-18', '2015-01-01'), { nil: null }),
  launchYear: fc.constant(null),
  launchYearSource: fc.constant(null),
  decayDate: fc.constant(null),
  perigeeKm: fc.constant(0),
  apogeeKm: fc.constant(0),
  pKm: fc.double({ min: -500, max: 700, noNaN: true }),
  qKm: fc.double({ min: -500, max: 700, noNaN: true }),
  e: fc.double({ min: 0, max: 0.01, noNaN: true }),
  inclinationDeg: fc.constant(null),
  orbitSource: fc.oneof(
    fc.constant({ kind: 'SATCAT' as const }),
    fc.constant({ kind: 'GP' as const, epoch: '2026-11-20T00:00:00' }),
  ),
  disagreement: fc.option(fc.record({ satcat: kindArb, gpzTable: kindArb }), { nil: null }),
});
const recordsArb = fc.array(mergedArb, { maxLength: 60 }).map((list): SatRecord[] =>
  list.map((m) => ({ ...m, verdict: classify(m, DATE), caseFile: false })),
);

describe('census adds up (R5.2)', () => {
  it('property: every grouping sums to its population size', () => {
    fc.assert(
      fc.property(recordsArb, fc.nat(100), fc.nat(100), fc.nat(100), (records, a, b, c) => {
        const c1 = buildCensus(records, { snapshotDate: DATE, outsidePopulation: a, rejectedRows: b, noOrbitData: c });
        const retired = records.filter((r) => r.verdict.kind === 'verdict').length;
        const ownerSum = Object.values(c1.retired.byOwner).reduce((n, v) => n + sum(v), 0);
        expect(c1.population.total).toBe(records.length);
        expect(sum(c1.byType)).toBe(records.length);
        expect(c1.retired.total).toBe(retired);
        expect(sum(c1.retired.byVerdict)).toBe(retired);
        expect(c1.retired.borderline.yes + c1.retired.borderline.no).toBe(retired);
        expect(sum(c1.retired.era)).toBe(retired);
        expect(sum(c1.retired.orbitSource)).toBe(retired);
        expect(ownerSum).toBe(retired);
        expect(c1.disagreements.total).toBe(records.filter((r) => r.disagreement !== null).length);
        expect(sum(c1.disagreements.pairs)).toBe(c1.disagreements.total);
        expect([c1.population.outsidePopulation, c1.population.rejectedRows, c1.population.noOrbitData]).toEqual([a, b, c]);
      }),
    );
  });
  it('retired.total equals the retired payload count in byType', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const c = buildCensus(records, { snapshotDate: DATE, outsidePopulation: 0, rejectedRows: 0, noOrbitData: 0 });
        expect(c.retired.total).toBe(c.byType['retired payload']);
      }),
    );
  });
  it('owner codes that look like object keys stay plain keys', () => {
    const m = { ...(runEngine({ ...FIX, snapshotDate: DATE }).records[0]!), owner: '__proto__' };
    const c = buildCensus([{ ...m, status: 'retired payload', verdict: classify({ ...m, status: 'retired payload' }, DATE) }], {
      snapshotDate: DATE, outsidePopulation: 0, rejectedRows: 0, noOrbitData: 0,
    });
    expect(Object.keys(c.retired.byOwner)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(c.retired.byOwner)).toBe(Object.prototype);
  });
  it('lists all six verdicts and all object kinds', () => {
    expect(VERDICT_NAMES).toHaveLength(6);
    expect(OBJECT_KINDS).toHaveLength(6);
  });
});

describe('runEngine never throws', () => {
  const noise = fc.oneof(
    fc.string(),
    fc.string({ unit: 'binary' }),
    fc.array(fc.constantFrom('a', ',', '"', '\n', ' ', '1', '.', '-', '<tr>', '<td>', '</td>', '<th>', '</th>', '<thead>', '</thead>', '<tbody>', '</tbody>', 'NORAD Catalog Number', 'Latest Data', '2000-01-01', 'T'))
      .map((a) => a.join('')),
  );
  const opt = fc.option(noise, { nil: undefined });
  it('property: arbitrary strings in every input', () => {
    fc.assert(
      fc.property(opt, opt, opt, (satcatCsv, gpzCsv, gpzTableHtml) => {
        const out = runEngine({ satcatCsv, gpzCsv, gpzTableHtml, snapshotDate: DATE });
        return Array.isArray(out.records) && Array.isArray(out.rejections);
      }),
    );
  });
  it('property: valid headers followed by arbitrary rows', () => {
    const satcatHead = FIX.satcatCsv.split('\n')[0]!;
    const gpHead = FIX.gpzCsv.split('\n')[0]!;
    const tableHead = FIX.gpzTableHtml.slice(0, FIX.gpzTableHtml.indexOf('<tbody>'));
    fc.assert(
      fc.property(noise, noise, noise, (a, b, c) => {
        const out = runEngine({
          satcatCsv: `${satcatHead}\n${a}`, gpzCsv: `${gpHead}\n${b}`, gpzTableHtml: `${tableHead}<tbody>${c}</tbody>`, snapshotDate: DATE,
        });
        expect(out.census.population.total).toBe(out.records.length);
        return true;
      }),
    );
  });
  it('property: an arbitrary snapshot date', () => {
    fc.assert(fc.property(fc.string(), (d) => Array.isArray(runEngine({ ...FIX, snapshotDate: d }).records)));
  });
  it('a bad snapshot date gives one rejection and no records', () => {
    const out = runEngine({ ...FIX, snapshotDate: 'yesterday' });
    expect(out.records).toEqual([]);
    expect(out.rejections).toEqual([{ source: 'engine', line: 0, reason: 'snapshotDate is not YYYY-MM-DD' }]);
  });
  it('non-string inputs do not throw', () => {
    expect(() => runEngine({ satcatCsv: 5 as unknown as string, snapshotDate: DATE })).not.toThrow();
    expect(() => runEngine(undefined as unknown as { snapshotDate: string })).not.toThrow();
  });
});

describe('order independence through runEngine (R1.13)', () => {
  it('property: shuffling the data lines of each file gives the same records', () => {
    const lines = (s: string) => s.split('\n').filter((l) => l !== '');
    const sHead = lines(FIX.satcatCsv)[0]!;
    const sRows = lines(FIX.satcatCsv).slice(1);
    const gHead = lines(FIX.gpzCsv)[0]!;
    const gRows = lines(FIX.gpzCsv).slice(1);
    const base = runEngine({ ...FIX, snapshotDate: DATE }).records;
    fc.assert(
      fc.property(
        fc.shuffledSubarray(sRows, { minLength: sRows.length, maxLength: sRows.length }),
        fc.shuffledSubarray(gRows, { minLength: gRows.length, maxLength: gRows.length }),
        (s, g) => {
          const out = runEngine({ ...FIX, satcatCsv: [sHead, ...s].join('\n'), gpzCsv: [gHead, ...g].join('\n'), snapshotDate: DATE });
          expect(out.records).toEqual(base);
        },
      ),
    );
  });
});
