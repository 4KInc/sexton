// data/operators.json (R13.2, R13.3): an operator is recorded only with a source that was opened.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { causeGroup } from '../src/engine/causes.ts';
import type { Register } from '../src/engine/types.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
interface Entry {
  norad: number;
  operator: string;
  relation: string;
  sourceUrl: string;
  sourceTitle: string;
  quote: string;
  openedOn: string;
}
interface Problem {
  norad: number;
  problem: string;
}
/** The rule, as a function, so a property test can break it. `postRule` is the set of retired payloads launched on or after the FCC rule date. */
export function operatorProblems(entries: readonly Entry[], postRule: ReadonlySet<number>, methodology: string, review: string): Problem[] {
  const out: Problem[] = [];
  const seen = new Set<number>();
  for (const e of entries) {
    const bad = (problem: string): number => out.push({ norad: e.norad, problem });
    if (seen.has(e.norad)) bad('duplicate entry');
    seen.add(e.norad);
    if (!postRule.has(e.norad)) bad('not a retired payload launched on or after 18 March 2002');
    if (typeof e.operator !== 'string' || e.operator.trim() === '') bad('no operator name');
    if (typeof e.relation !== 'string' || e.relation.trim() === '') bad('no relation label');
    if (!/^https?:\/\/\S+$/.test(e.sourceUrl ?? '')) bad('no http(s) source URL');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.openedOn ?? '')) bad('no date opened');
    if (typeof e.quote !== 'string' || e.quote.trim() === '') bad('no quote');
    else if (!methodology.includes(e.sourceUrl)) bad('source is not in the Sources table');
    else {
      const row = review.split('\n').find((l) => l.startsWith(`| ${e.norad} |`) && l.includes(e.sourceUrl) && /\bapproved\b/.test(l) && l.includes(e.quote));
      if (row === undefined) bad('quote is not in an approved row of docs/source-review.md');
    }
  }
  return out;
}
const file = JSON.parse(read('data/operators.json')) as { schema: number; entries: Entry[] };
const register = JSON.parse(read('data/register.json')) as Register;
const methodology = read('docs/methodology.md');
const review = read('docs/source-review.md');
const postRule = new Set(register.records.filter((r) => r.verdict.kind === 'verdict' && r.verdict.era === null).map((r) => r.norad));
describe('data/operators.json', () => {
  it('is schema 1, sorted by NORAD id', () => {
    expect(file.schema).toBe(1);
    const ids = file.entries.map((e) => e.norad);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
  it('every entry has a source that was opened, an approved quote, a label and a date', () => {
    expect(operatorProblems(file.entries, postRule, methodology, review)).toEqual([]);
  });
  it('19 of the 36 story stones have a sourced operator; the other 17 have none (null, "operator not sourced")', () => {
    const story = new Set(causeGroup(register.records).map((r) => r.norad));
    const sourced = file.entries.filter((e) => story.has(e.norad));
    expect(sourced).toHaveLength(19);
    expect(file.entries).toHaveLength(19);
    expect(story.size - sourced.length).toBe(17);
  });
  it('no operator is a SATCAT owner code or a name copied from the satellite name', () => {
    const owners = new Set(register.records.map((r) => r.owner).filter((o): o is string => o !== null));
    for (const e of file.entries) expect(owners.has(e.operator), `${e.norad} ${e.operator}`).toBe(false);
  });
  it('property: removing the source, the quote or the date from any entry is caught; so is a duplicate', () => {
    const base = file.entries;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: base.length - 1 }), fc.constantFrom('sourceUrl', 'quote', 'openedOn', 'operator', 'relation', 'dup'), (i, field) => {
        const copy = base.map((e) => ({ ...e }));
        if (field === 'dup') copy.push({ ...copy[i]! });
        else (copy[i] as unknown as Record<string, string>)[field] = '';
        return operatorProblems(copy, postRule, methodology, review).length > 0;
      }),
    );
  });
  it('property: an entry for a NORAD id outside the post-rule retired payloads is caught', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99999 }).filter((n) => !postRule.has(n)), (n) => operatorProblems([{ ...file.entries[0]!, norad: n }], postRule, methodology, review).some((p) => p.problem.startsWith('not a retired payload'))),
    );
  });
});
