// state.ts (task 11): filters and search round-trip through the hash query, and the churchyard and
// the table show the same filtered set.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FILTERS, TABLE, VERDICT_ORDER } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { parseHash } from '../src/ui/router.ts';
import {
  applyFilters,
  DEFAULT_SORT,
  drawnInChurchyard,
  ERA_FILTERS,
  hashFor,
  NO_FILTERS,
  normalizeQ,
  OWNER_NONE,
  parseFilters,
  parseSort,
  parseState,
  SORT_KEYS,
  sortRecords,
  toQuery,
} from '../src/ui/state.ts';
import type { Filters, Sort, ViewState } from '../src/ui/state.ts';
import { chartSvg, legendHtml } from '../src/ui/views/churchyard.ts';
import { filtersHtml } from '../src/ui/views/filters.ts';
import { tableHtml, verdictKeyHtml } from '../src/ui/views/table.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const reg = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/register.json'), 'utf8')) as UiRegister;
const all = reg.records;
const norads = (records: readonly { norad: number }[]): number[] => records.map((r) => r.norad);
const withFilters = (patch: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...patch });
const stateOf = (filters: Filters, sort: Sort = DEFAULT_SORT): ViewState => ({ filters, sort });

const arbFilters: fc.Arbitrary<Filters> = fc.record({
  owner: fc.option(fc.string({ unit: 'grapheme', minLength: 1 }), { nil: null }),
  verdicts: fc.subarray([...VERDICT_ORDER]),
  era: fc.constantFrom(null, ...ERA_FILTERS),
  bones: fc.boolean(),
  q: fc.string({ unit: 'grapheme' }).map(normalizeQ),
});
const arbSort: fc.Arbitrary<Sort> = fc.record({ key: fc.constantFrom(...SORT_KEYS), dir: fc.constantFrom('asc', 'desc') });
const arbState: fc.Arbitrary<ViewState> = fc.record({ filters: arbFilters, sort: arbSort });

/** Order the verdicts the way VERDICT_ORDER does, because the query is canonical. */
const canon = (f: Filters): Filters => ({ ...f, verdicts: VERDICT_ORDER.filter((v) => f.verdicts.includes(v)) });

describe('filters and search round-trip through the hash query', () => {
  it('property: state -> hash -> router -> state gives the same state, for either view', () => {
    fc.assert(
      fc.property(arbState, fc.constantFrom('' as const, 'table' as const), (state, path) => {
        const route = parseHash(hashFor(path, state));
        expect(route.name).toBe(path === '' ? 'churchyard' : 'table');
        expect(parseState(route.query)).toEqual({ filters: canon(state.filters), sort: state.sort });
      }),
    );
  });
  it('the empty state is the bare route, with no "?"', () => {
    expect(hashFor('', stateOf(NO_FILTERS))).toBe('#/');
    expect(hashFor('table', stateOf(NO_FILTERS))).toBe('#/table');
  });
  it('search text with &, #, %, +, =, ?, spaces and non-ASCII survives', () => {
    for (const q of ['a&b=c', '50% #1', 'x+y', 'what?', 'ÉCHO étoile', 'sp ace', '"quoted"', '<b>']) {
      const hash = hashFor('table', stateOf(withFilters({ q, owner: q })));
      expect(parseFilters(parseHash(hash).query)).toMatchObject({ q, owner: q });
    }
  });
  it('search is trimmed and its spaces collapsed, so the address stays tidy', () => {
    expect(parseFilters(new URLSearchParams({ q: '  echo   star ' })).q).toBe('echo star');
    expect(toQuery(stateOf(withFilters({ q: '   ' }))).has('q')).toBe(false);
  });
  it('bad values are ignored and never throw', () => {
    const f = parseFilters(new URLSearchParams('verdict=nope&verdict=buried&era=never&bones=yes&owner=&sort=zzz&dir=up'));
    expect(f).toEqual(withFilters({ verdicts: ['buried'] }));
    expect(parseSort(new URLSearchParams('sort=zzz&dir=up'))).toEqual(DEFAULT_SORT);
    expect(parseSort(new URLSearchParams('sort=p&dir=up'))).toEqual({ key: 'p', dir: 'asc' });
    fc.assert(fc.property(fc.string(), (s) => typeof parseState(new URLSearchParams(s)).filters.q === 'string'));
    fc.assert(fc.property(fc.string(), (s) => typeof parseState(parseHash('#/table?' + s).query).sort.key === 'string'));
  });
  it('the query is canonical: the same state always gives the same text', () => {
    const a = parseState(new URLSearchParams('q=x&verdict=fallen&verdict=buried&owner=US'));
    const b = parseState(new URLSearchParams('owner=US&verdict=buried&verdict=fallen&q=x&junk=1'));
    expect(toQuery(a).toString()).toBe(toQuery(b).toString());
    expect(toQuery(a).toString()).toBe('owner=US&verdict=buried&verdict=fallen&q=x');
  });
  it('the toolbar shows the state from the address, including an owner the register does not have', () => {
    // Changed on purpose (filter toolbar): verdicts are toggle chips with aria-pressed and unmarked bones is a switch, not checkboxes.
    const html = filtersHtml(all, withFilters({ owner: 'ZZ', verdicts: ['fallen'], era: 'before', bones: true, q: 'echo "x"' }), reg.config, true);
    expect(html).toContain('<option value="ZZ" selected>');
    expect(html).toMatch(/data-verdict="fallen" aria-pressed="true"/);
    expect(html).toMatch(/data-verdict="buried" aria-pressed="false"/);
    expect(html).toMatch(/value="before" selected/);
    expect(html).toMatch(/role="switch" id="f-bones" data-bones aria-checked="true"/);
    expect(html).toContain('value="echo &quot;x&quot;"');
    // One removable pill for each active filter, and a "Clear all" link.
    expect(html.match(/data-remove=/g)).toHaveLength(5);
    expect(html).toContain('data-clear-filters');
    expect(html).not.toMatch(/class="filter-active"[^>]* hidden/);
  });
  it('with no filter the active-filter line is hidden, and the options start closed unless asked', () => {
    const shut = filtersHtml(all, NO_FILTERS, reg.config, false);
    expect(shut).toMatch(/class="filter-active"[^>]* hidden/);
    expect(shut).not.toContain('data-open');
    expect(shut).toContain('aria-expanded="false" aria-controls="filter-panel"');
    expect(filtersHtml(all, NO_FILTERS, reg.config, true)).toContain('<form class="filters" id="filters" aria-label="Filter the register" data-open');
  });
  it('each verdict chip counts what it would show with the other filters as they are', () => {
    const html = filtersHtml(all, withFilters({ owner: 'US' }), reg.config, false);
    for (const v of VERDICT_ORDER) {
      const n = applyFilters(all, { ...NO_FILTERS, owner: 'US', verdicts: [v] }).length;
      expect(html).toContain(`data-verdict="${v}" aria-pressed="false"><svg`);
      expect(html).toMatch(new RegExp(`data-verdict="${v}"[^]*?fchip-count mono">${n}</span>`));
    }
  });
  it('only the Unquiet and Shallow grave chips are story chips (lantern when pressed)', () => {
    const html = filtersHtml(all, NO_FILTERS, reg.config, false);
    const story = [...html.matchAll(/class="fchip( chip--story)?" data-verdict="([^"]+)"/g)].filter((m) => m[1] !== undefined).map((m) => m[2]);
    expect(story).toEqual(['shallow grave', 'unquiet']);
  });
});
describe('addresses from before the filter toolbar', () => {
  // The toolbar changed the controls, not the address: these queries still parse to the same filters and the same set.
  const cases: [string, Partial<Filters>][] = [
    ['owner=US', { owner: 'US' }],
    ['verdict=unquiet&verdict=shallow%20grave', { verdicts: ['shallow grave', 'unquiet'] }],
    ['era=after&bones=1', { era: 'after', bones: true }],
    ['q=echostar&owner=US&verdict=unquiet&era=after', { q: 'echostar', owner: 'US', verdicts: ['unquiet'], era: 'after' }],
    ['bones=1&sort=e&dir=desc', { bones: true }],
  ];
  for (const [query, want] of cases) {
    it(`#/table?${query}`, () => {
      const f = parseState(new URLSearchParams(query)).filters;
      expect(f).toEqual({ ...NO_FILTERS, ...want });
      expect(norads(applyFilters(all, f))).toEqual(norads(applyFilters(all, { ...NO_FILTERS, ...want })));
    });
  }
});
describe('applyFilters on the fixture register', () => {
  it('no filters: everything except unmarked bones', () => {
    const out = applyFilters(all, NO_FILTERS);
    expect(out).toHaveLength(all.length - 2);
    expect(out.some((r) => r.verdict.kind === 'unmarked bones')).toBe(false);
    expect(out.some((r) => r.verdict.kind === 'no verdict')).toBe(true);
  });
  it('bones on: every object, in the register order', () => {
    expect(norads(applyFilters(all, withFilters({ bones: true })))).toEqual(norads(all));
  });
  it('owner, including "not given"', () => {
    expect(norads(applyFilters(all, withFilters({ owner: 'JP' })))).toEqual([90006, 90007, 90008, 90009, 90034]);
    expect(norads(applyFilters(all, withFilters({ owner: OWNER_NONE })))).toEqual([1317, 90033]);
    expect(applyFilters(all, withFilters({ owner: 'XX' }))).toEqual([]);
  });
  it('verdict keeps only objects with that verdict', () => {
    const out = applyFilters(all, withFilters({ verdicts: ['fallen', 'restless'], bones: true }));
    expect(norads(out)).toEqual([90001, 90011, 90014]);
  });
  it('era: before, on or after, unknown', () => {
    expect(norads(applyFilters(all, withFilters({ era: 'before' })))).toEqual([15873, 27378, 90001, 90031]);
    expect(applyFilters(all, withFilters({ era: 'unknown' })).map((r) => r.norad)).toEqual([1317, 90033]);
    const after = applyFilters(all, withFilters({ era: 'after' }));
    expect(after.every((r) => r.verdict.kind === 'verdict' && r.verdict.era === null)).toBe(true);
    expect(norads(after)).toContain(90032);
  });
  it('search by name, any case, and by the start of the NORAD id', () => {
    expect(norads(applyFilters(all, withFilters({ q: 'echostar' })))).toEqual([27378]);
    expect(norads(applyFilters(all, withFilters({ q: 'ECHOstar 7' })))).toEqual([27378]);
    expect(norads(applyFilters(all, withFilters({ q: '27378' })))).toEqual([27378]);
    expect(norads(applyFilters(all, withFilters({ q: '2737' })))).toEqual([27378]);
    expect(applyFilters(all, withFilters({ q: '7378' }))).toEqual([]);
    expect(applyFilters(all, withFilters({ q: 'no such satellite' }))).toEqual([]);
  });
  it('filters combine with AND', () => {
    expect(norads(applyFilters(all, withFilters({ owner: 'US', verdicts: ['unquiet'], era: 'before' })))).toEqual([27378]);
  });
  it('property: a filter never adds objects, and the order is the register order', () => {
    fc.assert(
      fc.property(arbFilters, (f) => {
        const out = norads(applyFilters(all, f));
        const base = norads(all);
        expect(out.every((n) => base.includes(n))).toBe(true);
        expect(out).toEqual(base.filter((n) => out.includes(n)));
      }),
    );
  });
});

describe('the churchyard and the table show the same filtered set', () => {
  const chartIds = (svg: string): number[] => [...svg.matchAll(/data-norad="(\d+)"/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
  const rowIds = (html: string): number[] => [...html.matchAll(/<tr data-norad="(\d+)"/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
  const both = (f: Filters): { chart: number[]; table: number[]; set: number[] } => {
    // The same two lines the views run: one filter, then each draws its part.
    const shown = applyFilters(all, f);
    return {
      chart: chartIds(chartSvg(reg, false, null, drawnInChurchyard(shown))),
      table: rowIds(tableHtml(shown, reg.config, DEFAULT_SORT)),
      set: norads(shown).sort((a, b) => a - b),
    };
  };
  it('the table lists the whole filtered set, including objects with no verdict', () => {
    const { table, set } = both(NO_FILTERS);
    expect(table).toEqual(set);
    expect(table).toContain(858); // living payload
    expect(table).toContain(90026); // unknown status
  });
  it('the churchyard draws exactly the retired payloads (and shown bones) of that same set', () => {
    for (const f of [NO_FILTERS, withFilters({ bones: true }), withFilters({ owner: 'US' }), withFilters({ q: 'fixture' })]) {
      const { chart, table } = both(f);
      const shown = applyFilters(all, f);
      expect(chart).toEqual(norads(drawnInChurchyard(shown)).sort((a, b) => a - b));
      expect(chart.every((n) => table.includes(n))).toBe(true);
    }
  });
  it('when a verdict or era filter is on, the two views list identical objects', () => {
    for (const f of [
      withFilters({ verdicts: ['buried'] }),
      withFilters({ verdicts: ['unquiet', 'fallen'], owner: 'US' }),
      withFilters({ era: 'before' }),
      withFilters({ era: 'unknown', bones: true }),
      withFilters({ verdicts: ['uncertain'], era: 'after', q: 'edge' }),
    ]) {
      const { chart, table } = both(f);
      expect(chart, JSON.stringify(f)).toEqual(table);
    }
  });
  it('property: for any filters, the chart is the table minus the rows the chart does not draw', () => {
    fc.assert(
      fc.property(arbFilters, (f) => {
        const { chart, table } = both(f);
        const drawable = applyFilters(all, f).filter((r) => r.verdict.kind !== 'no verdict');
        expect(chart).toEqual(norads(drawable).sort((a, b) => a - b));
        expect(chart.every((n) => table.includes(n))).toBe(true);
      }),
    );
  });
  it('property: the views agree when the filters come back from an address', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const viaChurchyard = parseState(parseHash(hashFor('', state)).query).filters;
        const viaTable = parseState(parseHash(hashFor('table', state)).query).filters;
        expect(norads(applyFilters(all, viaChurchyard))).toEqual(norads(applyFilters(all, viaTable)));
        expect(norads(applyFilters(all, viaTable))).toEqual(norads(applyFilters(all, state.filters)));
      }),
    );
  });
  it('shown bones are drawn as marks that are not links, and stay out of the default chart', () => {
    const on = chartSvg(reg, false, null, drawnInChurchyard(applyFilters(all, withFilters({ bones: true }))));
    expect(on).toContain('class="bone" data-norad="4511"');
    expect(on).toContain('unmarked bones (rocket body)');
    expect(on).not.toContain('href="#/sat/4511"');
    expect(chartSvg(reg, false)).not.toContain('class="bone"');
  });
  it('the legend explains the bones marker', () => {
    expect(legendHtml(reg.config)).toContain('unmarked bones');
  });
});

describe('table view', () => {
  const html = tableHtml(applyFilters(all, withFilters({ bones: true })), reg.config, DEFAULT_SORT);
  it('is a real table with a caption, column headers and row headers', () => {
    expect(html).toContain('<table');
    expect(html).toContain('<caption>');
    expect(html.match(/<th scope="col"/g)).toHaveLength(11);
    // Each header cell also has its explicit role, so the table stays a table when a phone lays the rows out as cards.
    expect(html.match(/<th scope="row" role="rowheader">/g)).toHaveLength(all.length);
  });
  it('every sortable header is a button, and only the sorted column has aria-sort', () => {
    expect(html.match(/<button type="button" class="sort"/g)).toHaveLength(11);
    expect(html.match(/aria-sort=/g)).toHaveLength(1);
    expect(html).toContain('<th scope="col" role="columnheader" aria-sort="ascending"><button type="button" class="sort" data-sort="norad">');
    const desc = tableHtml(all, reg.config, { key: 'p', dir: 'desc' });
    expect(desc).toContain('<th scope="col" role="columnheader" aria-sort="descending"><button type="button" class="sort" data-sort="p">');
    expect(desc.match(/aria-sort=/g)).toHaveLength(1);
  });
  it('objects with no verdict say why, and bones say what they are', () => {
    expect(html).toContain(TABLE.noVerdict('living payload'));
    expect(html).toContain(TABLE.noVerdict('unknown status'));
    expect(html).toContain(TABLE.bones('rocket body'));
    expect(html).toContain(TABLE.bones('debris'));
  });
  it('shows data age for every row: the GP epoch, or SATCAT with no element date', () => {
    // The date and time are in a no-break span, so a date never splits across two lines.
    expect(html).toContain('GP mean elements, epoch <span class="nw">2026-11-20 12:07 UTC</span>');
    expect(html.match(/<tr data-norad/g)!.length).toBe(all.length);
  });
  it('only objects with a verdict link to a ledger', () => {
    expect(html).toContain('<a href="#/sat/27378">ECHOSTAR 7</a>');
    expect(html).not.toContain('href="#/sat/858"');
    expect(html).not.toContain('href="#/sat/4511"');
  });
  it('escapes names that hold markup', () => {
    const evil = structuredClone(all);
    evil[0]!.name = '"><script>alert(1)</script>';
    expect(tableHtml(evil, reg.config, DEFAULT_SORT)).not.toContain('<script>');
  });
  it('pairs each verdict word with its plain meaning once, in the key', () => {
    const key = verdictKeyHtml(reg.config);
    for (const v of VERDICT_ORDER) expect(key.toLowerCase()).toContain(v);
    expect(key).toContain('Unquiet (the orbit reaches the protected zone');
    expect(key).toContain('Shallow grave (perigee below the IADC threshold)');
  });
  it('an empty set is an empty table body, not an error', () => {
    expect(() => tableHtml([], reg.config, DEFAULT_SORT)).not.toThrow();
  });
  it('the filter count text is plain', () => {
    expect(FILTERS.count(1, 33)).toBe('1 of 33 objects match.');
    expect(FILTERS.count(1, 1)).toBe('1 of 1 object match.');
  });
});

describe('sorting', () => {
  const asc = (key: Sort['key']): number[] => norads(sortRecords(all, { key, dir: 'asc' }));
  const desc = (key: Sort['key']): number[] => norads(sortRecords(all, { key, dir: 'desc' }));
  it('does not change the input', () => {
    const before = norads(all);
    sortRecords(all, { key: 'p', dir: 'desc' });
    expect(norads(all)).toEqual(before);
  });
  it('sorts numbers as numbers (4511 before 11581 by NORAD, not as text)', () => {
    expect(asc('norad').slice(0, 4)).toEqual([858, 1317, 4511, 11581]);
    expect(desc('norad')[0]).toBe(90034);
  });
  it('perigee sorts by true value, lowest first when ascending', () => {
    const ps = sortRecords(all, { key: 'p', dir: 'asc' }).map((r) => r.pKm);
    expect(ps).toEqual([...ps].sort((a, b) => a - b));
  });
  it('missing values go last in both directions', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const sorted = sortRecords(all, { key: 'verdict', dir });
      const kinds = sorted.map((r) => r.verdict.kind === 'verdict');
      const firstMissing = kinds.indexOf(false);
      expect(kinds.slice(firstMissing).every((k) => !k)).toBe(true);
      const owners = sortRecords(all, { key: 'owner', dir }).map((r) => r.owner);
      expect(owners.slice(-2)).toEqual([null, null]);
    }
  });
  it('property: every key gives a permutation of the same objects, and the same sort twice gives the same order', () => {
    fc.assert(
      fc.property(arbSort, (sort) => {
        const a = norads(sortRecords(all, sort));
        expect(a.slice().sort((x, y) => x - y)).toEqual(norads(all).sort((x, y) => x - y));
        expect(norads(sortRecords(all, sort))).toEqual(a);
      }),
    );
  });
});
describe('status line without filters', () => {
  it('does not read like a filter is on', () => {
    expect(FILTERS.drawnUnfiltered(696)).toBe(
      '696 retired payloads drawn. Living and unknown-status payloads, rocket bodies and debris are in the table.',
    );
    expect(FILTERS.drawnUnfiltered(696)).not.toMatch(/match/);
  });
});
