// The parish register's engine (R13, design 10): counts by verdict for one operator or one SATCAT owner code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { OWNER_NOT_GIVEN, inGroup, operatorCoverage, parishGroups, parishOf } from '../src/engine/parish.ts';
import type { Group } from '../src/engine/parish.ts';
import type { Register, SatRecord } from '../src/engine/types.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as Register;
const retired = real.records.filter((r) => r.verdict.kind === 'verdict');
const sum = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0);
const records = fc.shuffledSubarray(real.records, { minLength: 0, maxLength: real.records.length });

describe('owner groups', () => {
  it('the verdict counts of every owner code equal census.byOwner for that code, and add up to the group', () => {
    for (const [code, counts] of Object.entries(real.census.retired.byOwner)) {
      const page = parishOf(real.records, { kind: 'owner', key: code });
      expect(page.byVerdict, code).toEqual(counts);
      expect(page.total, code).toBe(sum(counts));
      expect(sum(page.byVerdict), code).toBe(page.total);
      expect(page.rows, code).toHaveLength(page.total);
    }
  });
  it('the owner groups together hold every retired payload once', () => {
    const { owners } = parishGroups(real.records);
    expect(sum(Object.fromEntries(owners.map((o) => [o.key, o.count])))).toBe(retired.length);
    expect(owners.map((o) => o.key)).toEqual(Object.keys(real.census.retired.byOwner).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)));
  });
  it('"unknown" is the retired payloads with no SATCAT owner', () => {
    const page = parishOf(real.records, { kind: 'owner', key: OWNER_NOT_GIVEN });
    expect(page.rows.every((r) => r.owner === null)).toBe(true);
    expect(page.total).toBe(retired.filter((r) => r.owner === null).length);
  });
  it('a code with no retired payloads gives an empty page with all six verdicts at 0', () => {
    const page = parishOf(real.records, { kind: 'owner', key: 'NO-SUCH-CODE' });
    expect(page.total).toBe(0);
    expect(page.rows).toEqual([]);
    expect(page.gpEpochs).toBeNull();
    expect(Object.keys(page.byVerdict)).toHaveLength(6);
    expect(sum(page.byVerdict)).toBe(0);
  });
  it('splits the era and the orbit source so that each adds up to the group, and gives the GP epoch range', () => {
    const page = parishOf(real.records, { kind: 'owner', key: 'US' });
    expect(page.era.beforeRule + page.era.onOrAfterRule + page.era.unknown).toBe(page.total);
    expect(page.orbitSource.GP + page.orbitSource.SATCAT).toBe(page.total);
    if (page.orbitSource.GP > 0) expect(page.gpEpochs!.first <= page.gpEpochs!.last).toBe(true);
  });
});

describe('operator groups', () => {
  const sourced = real.records.filter((r) => typeof r.operator === 'string');
  it('an operator group holds exactly the retired payloads with that operator name', () => {
    const { operators } = parishGroups(real.records);
    expect(operators.length).toBeGreaterThan(0);
    for (const o of operators) {
      const page = parishOf(real.records, { kind: 'operator', key: o.key });
      expect(page.total).toBe(o.count);
      expect(page.total).toBe(sourced.filter((r) => r.operator === o.key).length);
      expect(page.rows.every((r) => r.operator === o.key)).toBe(true);
      expect(page.withOperator).toBe(page.total);
    }
  });
  it('a record with no operator is never in an operator group, whatever the name asked for', () => {
    for (const name of ['null', 'undefined', '', 'unknown']) {
      const page = parishOf(real.records, { kind: 'operator', key: name });
      expect(page.rows.every((r) => typeof r.operator === 'string')).toBe(true);
    }
    expect(parishGroups(real.records).operators.map((o) => o.key)).not.toContain('null');
  });
  it('the operator groups and the owner groups are separate lists: a payload with an operator is in both, and nothing is merged', () => {
    const g = parishGroups(real.records);
    expect(g.operators.reduce((a, b) => a + b.count, 0)).toBe(sourced.length);
    const kodama = real.records.find((r) => r.norad === 32500)!;
    expect(inGroup(kodama, { kind: 'operator', key: 'JAXA' })).toBe(true);
    expect(inGroup(kodama, { kind: 'owner', key: 'JPN' })).toBe(true);
    expect(inGroup(kodama, { kind: 'owner', key: 'JAXA' })).toBe(false);
    expect(inGroup(kodama, { kind: 'operator', key: 'JPN' })).toBe(false);
  });
  it('both lists are in alphabetical order', () => {
    const g = parishGroups(real.records);
    for (const list of [g.operators, g.owners]) {
      const keys = list.map((x) => x.key.toLowerCase());
      expect(keys).toEqual([...keys].sort());
    }
  });
});

describe('operatorCoverage', () => {
  it('is 19 of 131 in the 2026-11-22 snapshot, both counted from the records', () => {
    expect(operatorCoverage(real.records)).toEqual({ sourced: 19, of: 131 });
  });
  it('property: sourced never exceeds the post-rule retired payloads, and no other record has an operator field', () => {
    fc.assert(
      fc.property(records, (subset) => {
        const c = operatorCoverage(subset);
        const postRule = subset.filter((r) => r.verdict.kind === 'verdict' && r.verdict.era === null);
        return c.of === postRule.length && c.sourced <= c.of && subset.every((r) => r.operator === undefined || postRule.includes(r));
      }),
    );
  });
});

describe('properties of parishOf', () => {
  const group = fc.oneof(
    fc.constantFrom(...Object.keys(real.census.retired.byOwner)).map((key): Group => ({ kind: 'owner', key })),
    fc.constantFrom(...parishGroups(real.records).operators.map((o) => o.key)).map((key): Group => ({ kind: 'operator', key })),
  );
  it('the verdicts, the era split and the orbit-source split each add up to the total, for any subset of the register', () => {
    fc.assert(
      fc.property(records, group, (subset, g) => {
        const p = parishOf(subset, g);
        return sum(p.byVerdict) === p.total && sum(p.era) === p.total && sum(p.orbitSource) === p.total && p.borderline <= p.total && p.rows.length === p.total;
      }),
    );
  });
  it('does not depend on the order of the records', () => {
    fc.assert(
      fc.property(records, group, fc.integer(), (subset, g, seed) => {
        const shuffled = [...subset].sort((a: SatRecord, b: SatRecord) => ((a.norad * 2654435761 + seed) % 1009) - ((b.norad * 2654435761 + seed) % 1009));
        return JSON.stringify(parishOf(shuffled, g)) === JSON.stringify(parishOf(subset, g));
      }),
    );
  });
  it('lists the rows by NORAD id', () => {
    fc.assert(
      fc.property(records, group, (subset, g) => {
        const ids = parishOf(subset, g).rows.map((r) => r.norad);
        return ids.every((n, i) => i === 0 || ids[i - 1]! < n);
      }),
    );
  });
});
