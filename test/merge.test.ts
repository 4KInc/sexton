import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { CONFIG } from '../src/engine/config.ts';
import type { GpRow } from '../src/engine/gp.ts';
import { parseGp } from '../src/engine/gp.ts';
import { parseGpzTable } from '../src/engine/gpz-table.ts';
import { inNearGeo, kindFromSatcat, kindFromTableStatus, launchYearOf, mergeSources } from '../src/engine/merge.ts';
import { orbitFromMeanMotion } from '../src/engine/orbit.ts';
import type { SatcatRow } from '../src/engine/satcat.ts';
import { parseSatcat } from '../src/engine/satcat.ts';

const FIX = new URL('./fixtures/snapshot/', import.meta.url);
const read = (f: string): string => readFileSync(new URL(f, FIX), 'utf8');
const satcat = parseSatcat(read('satcat.csv')).rows;
const gp = parseGp(read('gpz.csv')).rows;
const table = parseGpzTable(read('table-gpz.csv')).rows;
const DATE = '2026-11-20';
const merged = mergeSources({ satcat, gp, table }, DATE);
const byId = (id: number) => merged.records.find((r) => r.norad === id)!;

const satRow = (o: Partial<SatcatRow> = {}): SatcatRow => ({
  norad: 1, line: 2, raw: 'x', name: 'N', intlDes: '2000-001A', objectType: 'PAY', opsStatusCode: '-', owner: 'US',
  launchDate: '2000-01-01', decayDate: null, inclinationDeg: 0.5, apogeeKm: 36100, perigeeKm: 36090, orbitCenter: 'EA', ...o,
});
const gpRow = (o: Partial<GpRow> = {}): GpRow => ({
  norad: 1, line: 2, raw: 'x', name: 'N', intlDes: '2000-001A', epoch: '2026-11-20T00:00:00', meanMotion: 1.0027, e: 0.0005, inclinationDeg: 0.5, ...o,
});

describe('near-GEO filter', () => {
  const low = CONFIG.geoAltitudeKm + CONFIG.nearGeo.lowerKm;
  const high = CONFIG.geoAltitudeKm + CONFIG.nearGeo.upperKm;
  it('limits come from the config: 33,786 and 37,786', () => {
    expect([low, high]).toEqual([33786, 37786]);
  });
  it('is inclusive at exactly ±2,000 km', () => {
    expect(inNearGeo(satRow({ perigeeKm: low, apogeeKm: low }))).toBe(true);
    expect(inNearGeo(satRow({ perigeeKm: high, apogeeKm: high }))).toBe(true);
    expect(inNearGeo(satRow({ perigeeKm: low - 1, apogeeKm: low }))).toBe(false);
    expect(inNearGeo(satRow({ perigeeKm: high, apogeeKm: high + 1 }))).toBe(false);
  });
  it('excludes decayed objects and non-EA orbit centres', () => {
    expect(inNearGeo(satRow({ decayDate: '2020-03-03' }))).toBe(false);
    expect(inNearGeo(satRow({ orbitCenter: 'MO' }))).toBe(false);
    expect(inNearGeo(satRow())).toBe(true);
  });
  it('on the fixture: edges, decayed and non-EA rows are handled', () => {
    const ids = new Set(merged.records.map((r) => r.norad));
    expect(ids.has(90014)).toBe(true); // perigee exactly 33,786
    expect(ids.has(90015)).toBe(false); // 33,785
    expect(ids.has(90016)).toBe(true); // apogee exactly 37,786
    expect(ids.has(90017)).toBe(false); // 37,787
    expect(ids.has(90012)).toBe(false); // decayed
    expect(ids.has(90013)).toBe(false); // ORBIT_CENTER MO
    expect(merged.outsidePopulation).toBe(4);
  });
  it('rows with no orbit data never reach the population', () => {
    const ids = new Set(merged.records.map((r) => r.norad));
    expect(ids.has(90018)).toBe(false);
    expect(ids.has(90019)).toBe(false);
  });
});

describe('population and one record per NORAD id', () => {
  it('is the filtered SATCAT rows plus every GP id', () => {
    expect(merged.records).toHaveLength(33);
    const ids = merged.records.map((r) => r.norad);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of gp) expect(ids).toContain(g.norad);
  });
  it('a SATCAT row outside the filter is not outside the population when GP has the object', () => {
    const out = mergeSources({ satcat: [satRow({ norad: 5, orbitCenter: 'MO' })], gp: [gpRow({ norad: 5 })], table: [] }, DATE);
    expect(out.records.map((r) => r.norad)).toEqual([5]);
    expect(out.outsidePopulation).toBe(0);
  });
  it('output is sorted by NORAD id', () => {
    const ids = merged.records.map((r) => r.norad);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe('type and status', () => {
  it('maps SATCAT OBJECT_TYPE and OPS_STATUS_CODE (R1.7)', () => {
    const k = (objectType: string, opsStatusCode: string) => kindFromSatcat(satRow({ objectType, opsStatusCode }));
    expect(k('PAY', '-')).toBe('retired payload');
    for (const c of ['+', 'P', 'B', 'S', 'X']) expect(k('PAY', c)).toBe('living payload');
    for (const c of ['?', '', 'Z']) expect(k('PAY', c)).toBe('unknown payload');
    expect(k('R/B', '')).toBe('rocket body');
    expect(k('DEB', '')).toBe('debris');
    expect(k('UNK', '')).toBe('unknown');
  });
  it('maps GPZ table codes (R1.8)', () => {
    expect(kindFromTableStatus('PAY-')).toBe('retired payload');
    expect(kindFromTableStatus('PAY+')).toBe('living payload');
    expect(kindFromTableStatus('R/B')).toBe('rocket body');
    expect(kindFromTableStatus('DEB')).toBe('debris');
    expect(kindFromTableStatus('XYZ')).toBe('unknown');
    expect(kindFromTableStatus('constructor')).toBe('unknown');
  });
  it('every fixture status code lands where R1.7 says', () => {
    const want: Record<number, string> = {
      90021: 'living payload', 90022: 'living payload', 90023: 'living payload', 90024: 'living payload',
      90025: 'living payload', 90026: 'unknown payload', 90027: 'unknown payload', 90030: 'unknown',
    };
    for (const [id, kind] of Object.entries(want)) expect(byId(Number(id)).status, id).toBe(kind);
  });
  it('a GPZ-only record shows "GPZ table" status source, no owner and no launch date', () => {
    const r = byId(1317);
    expect(r.statusSource).toBe('GPZ table');
    expect(r.status).toBe('retired payload');
    expect(r.objectType).toBe('PAY');
    expect(r.owner).toBeNull();
    expect(r.launchDate).toBeNull();
    expect(r.orbitSource.kind).toBe('GP');
  });
  it('with no SATCAT, every GP object takes its status from the GPZ table', () => {
    const out = mergeSources({ satcat: null, gp, table }, DATE);
    expect(out.records).toHaveLength(7);
    expect(out.outsidePopulation).toBe(0);
    expect(out.records.every((r) => r.statusSource === 'GPZ table' && r.owner === null && r.launchDate === null)).toBe(true);
    expect(out.records.find((r) => r.norad === 27378)!.status).toBe('retired payload');
    expect(out.records.find((r) => r.norad === 4511)!.status).toBe('rocket body');
  });
  it('an object in neither SATCAT nor the table has unknown type and status', () => {
    const r = mergeSources({ satcat: [], gp: [gpRow()], table: [] }, DATE).records[0]!;
    expect([r.status, r.statusSource, r.objectType]).toEqual(['unknown', null, null]);
  });
  it('SATCAT decides when it has the row', () => {
    expect(byId(27378).statusSource).toBe('SATCAT');
    expect(byId(27378).owner).toBe('US');
  });
});

describe('disagreements', () => {
  it('records the pair and keeps the SATCAT value', () => {
    const r = byId(858); // SATCAT living, GPZ table PAY-
    expect(r.status).toBe('living payload');
    expect(r.statusSource).toBe('SATCAT');
    expect(r.disagreement).toEqual({ satcat: 'living payload', gpzTable: 'retired payload' });
  });
  it('is the only disagreement on the fixture', () => {
    expect(merged.records.filter((r) => r.disagreement !== null).map((r) => r.norad)).toEqual([858]);
  });
  it('SATCAT "unknown payload" against a table code is compared as "unknown"', () => {
    const out = mergeSources(
      { satcat: [satRow({ opsStatusCode: '?' })], gp: [], table: [{ norad: 1, line: 1, raw: '', status: 'PAY-' }] },
      DATE,
    );
    expect(out.records[0]!.disagreement).toEqual({ satcat: 'unknown', gpzTable: 'retired payload' });
  });
});

describe('orbit source', () => {
  it('GP wins for EchoStar-7 and Intelsat 511', () => {
    const e = byId(27378);
    expect(e.orbitSource).toEqual({ kind: 'GP', epoch: '2026-11-20T12:07:02.320608' });
    expect(e.pKm).toBeCloseTo(110.4, 1);
    expect(byId(15873).pKm).toBeCloseTo(17.6, 1);
  });
  it('SATCAT-only objects use the whole-km altitudes', () => {
    const r = byId(90002);
    expect(r.orbitSource).toEqual({ kind: 'SATCAT' });
    expect([r.perigeeKm, r.apogeeKm, r.pKm, r.qKm]).toEqual([36190, 36200, 404, 414]);
  });
  it('property: a GP row always wins over a SATCAT row for the same NORAD id', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }),
        fc.double({ min: 0.99, max: 1.01, noNaN: true }),
        fc.double({ min: 0, max: 0.01, noNaN: true }),
        fc.integer({ min: 33786, max: 37786 }),
        (norad, n, e, perigee) => {
          const out = mergeSources(
            { satcat: [satRow({ norad, perigeeKm: perigee, apogeeKm: perigee + 5 })], gp: [gpRow({ norad, meanMotion: n, e })], table: [] },
            DATE,
          );
          const r = out.records[0]!;
          const want = orbitFromMeanMotion(n, e, CONFIG);
          return out.records.length === 1 && r.orbitSource.kind === 'GP' && r.pKm === want.pKm && r.qKm === want.qKm;
        },
      ),
    );
  });
});

describe('launch year (design 7.3)', () => {
  it('comes from the launch date when there is one', () => {
    const r = byId(27378);
    expect([r.launchYear, r.launchYearSource]).toEqual([2002, 'launch date']);
  });
  it('a blank owner is null', () => {
    expect(byId(90033).owner).toBeNull();
  });
  it('falls back to the designator when the launch date is blank', () => {
    const r = byId(90033);
    expect(r.launchDate).toBeNull();
    expect([r.launchYear, r.launchYearSource]).toEqual([2002, 'designator']);
  });
  it('a GPZ-only record uses its GP designator', () => {
    expect([byId(1317).launchYear, byId(1317).launchYearSource]).toEqual([1965, 'designator']);
  });
  it('a malformed or out-of-range designator gives null', () => {
    for (const des of ['', 'abc', '20O2-006A', '2002', '2002-6A', '1956-001A', '2027-001A', null]) {
      expect(launchYearOf(null, des, DATE), String(des)).toEqual({ year: null, source: null });
    }
  });
  it('accepts the first and the snapshot year', () => {
    expect(launchYearOf(null, '1957-001A', DATE).year).toBe(1957);
    expect(launchYearOf(null, '2026-100A', DATE).year).toBe(2026);
  });
});

describe('order independence', () => {
  it('property: shuffling every input array gives deep-equal output', () => {
    const base = mergeSources({ satcat, gp, table }, DATE);
    fc.assert(
      fc.property(
        fc.shuffledSubarray(satcat, { minLength: satcat.length, maxLength: satcat.length }),
        fc.shuffledSubarray(gp, { minLength: gp.length, maxLength: gp.length }),
        fc.shuffledSubarray(table, { minLength: table.length, maxLength: table.length }),
        (s, g, t) => {
          expect(mergeSources({ satcat: s, gp: g, table: t }, DATE)).toEqual(base);
        },
      ),
    );
  });
});
