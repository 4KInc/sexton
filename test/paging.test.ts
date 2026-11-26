// Table pagination (redesign 5): one pure pageSlice for the grid and the HTML table, page= and size= in the address.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { UiRegister } from '../src/ui/register.ts';
import { parseHash } from '../src/ui/router.ts';
import { DEFAULT_PAGING, DEFAULT_SORT, firstPage, NO_FILTERS, PAGE_SIZES, pageSlice, parsePaging, parseState, toQuery, hashFor } from '../src/ui/state.ts';
import type { PageSize, ViewState } from '../src/ui/state.ts';
import { pagerHtml, tableHtml, tablePage, viewOf } from '../src/ui/views/table.ts';
const ROOT = process.cwd();
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
describe('pageSlice', () => {
  it('cuts full pages and the last partial page', () => {
    const rows = range(312);
    expect(pageSlice(rows, 1, 50)).toMatchObject({ page: 1, pages: 7, from: 1, to: 50, total: 312 });
    expect(pageSlice(rows, 2, 50)).toMatchObject({ page: 2, from: 51, to: 100 });
    const last = pageSlice(rows, 7, 50);
    expect(last).toMatchObject({ page: 7, from: 301, to: 312 });
    expect(last.rows).toEqual(range(312).slice(300));
  });
  it('size "all" is one page of every row', () => {
    expect(pageSlice(range(1764), 1, 'all')).toMatchObject({ page: 1, pages: 1, from: 1, to: 1764, total: 1764 });
    expect(pageSlice(range(1764), 3, 'all').page).toBe(1);
  });
  it('a page beyond the end, or below 1, or not a whole number falls back to page 1', () => {
    for (const p of [8, 99, 0, -3, 1.5, Number.NaN]) expect(pageSlice(range(312), p, 50), String(p)).toMatchObject({ page: 1, from: 1, to: 50 });
  });
  it('no rows: one empty page, range 0 to 0 (the empty state shows and the pager hides)', () => {
    const empty = pageSlice([], 4, 25);
    expect(empty).toMatchObject({ rows: [], page: 1, pages: 1, from: 0, to: 0, total: 0 });
    expect(pagerHtml(empty, 25)).toMatch(/<nav class="pager" id="pager"[^>]* hidden>/);
    const html = tableHtml([], real.config, DEFAULT_SORT, false, { page: 1, size: 25 });
    expect(html.match(/<tr data-norad/g)).toBeNull();
  });
  it('property: the pages cover every row once, in order', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), fc.constantFrom(...PAGE_SIZES), (n, size) => {
        const rows = range(n);
        const first = pageSlice(rows, 1, size);
        const all = range(first.pages).flatMap((p) => pageSlice(rows, p, size).rows);
        expect(all).toEqual(rows);
        for (const p of range(first.pages)) {
          const s = pageSlice(rows, p, size);
          if (n > 0) expect(s.to - s.from + 1).toBe(s.rows.length);
        }
      }),
    );
  });
});
describe('page= and size= in the address', () => {
  it('defaults are page 1 and 50 rows, and are left out of the address', () => {
    expect(parsePaging(new URLSearchParams())).toEqual(DEFAULT_PAGING);
    const state: ViewState = { filters: NO_FILTERS, sort: DEFAULT_SORT, paging: { page: 1, size: 50 } };
    expect(toQuery(state).toString()).toBe('');
    expect(toQuery({ ...state, paging: { page: 2, size: 50 } }).toString()).toBe('page=2');
    expect(toQuery({ ...state, paging: { page: 1, size: 'all' } }).toString()).toBe('size=all');
  });
  it('bad values fall back to page 1 and size 50', () => {
    for (const q of ['page=0', 'page=-1', 'page=abc', 'page=2.5', 'page=', 'page=01']) expect(parsePaging(new URLSearchParams(q)).page, q).toBe(1);
    for (const q of ['size=10', 'size=ALL', 'size=', 'size=50.0', 'size=1e2']) expect(parsePaging(new URLSearchParams(q)).size, q).toBe(50);
    expect(parsePaging(new URLSearchParams('page=3&size=25'))).toEqual({ page: 3, size: 25 });
  });
  it('property: state -> hash -> router -> state keeps the page, the size, the filters and the sort', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), fc.constantFrom<PageSize>(...PAGE_SIZES), fc.constantFrom('', 'owner=US', 'verdict=unquiet&sort=e&dir=desc'), (page, size, extra) => {
        const base = parseState(new URLSearchParams(extra));
        const state: ViewState = { ...base, paging: { page, size } };
        const route = parseHash(hashFor('table', state));
        expect(parsePaging(route.query)).toEqual({ page, size });
        expect(parseState(route.query)).toEqual(base);
      }),
    );
  });
  it('the churchyard\'s addresses never carry a page', () => {
    expect(hashFor('', parseState(new URLSearchParams('owner=US&page=3&size=25')))).toBe('#/?owner=US');
  });
});
describe('a change of filter, search or sort goes back to page 1', () => {
  it('firstPage keeps the size and resets the page', () => {
    const s: ViewState = { filters: NO_FILTERS, sort: DEFAULT_SORT, paging: { page: 4, size: 25 } };
    expect(firstPage(s).paging).toEqual({ page: 1, size: 25 });
    expect(firstPage({ filters: NO_FILTERS, sort: DEFAULT_SORT })).toEqual({ filters: NO_FILTERS, sort: DEFAULT_SORT });
  });
  it('the toolbar and every sort control call it', () => {
    expect(read('src/ui/views/filters.ts')).toContain('const next = firstPage({ ...getState(), filters });');
    const table = read('src/ui/views/table.ts');
    expect(table.match(/state = firstPage\(\{ \.\.\.state, sort/g)).toHaveLength(4);
  });
});
describe('the HTML table and the pager', () => {
  const { shown } = viewOf(real.records, { ...NO_FILTERS, bones: true });
  it('draws only the page, numbering on from the page before', () => {
    const html = tableHtml(shown, real.config, DEFAULT_SORT, false, { page: 2, size: 50 });
    expect(html.match(/<tr data-norad/g)).toHaveLength(50);
    expect(html).toContain('<tbody role="rowgroup" style="counter-reset: rowno 50">');
    const order = tablePage(shown, DEFAULT_SORT, false, { page: 2, size: 50 }).rows.map((r) => r.norad);
    expect([...html.matchAll(/<tr data-norad="(\d+)"/g)].map((m) => Number(m[1]))).toEqual(order);
    // Without a page (print), every row.
    expect(tableHtml(shown, real.config, DEFAULT_SORT, false).match(/<tr data-norad/g)).toHaveLength(1764);
  });
  it('the pager: real buttons, a labelled select with 25, 50, 100 and All, and a polite live range', () => {
    const html = pagerHtml(pageSlice(range(312), 2, 50), 50);
    expect(html).toContain('<button type="button" class="button" data-page="prev">Previous</button>');
    expect(html).toContain('<button type="button" class="button" data-page="next">Next</button>');
    expect(html).toContain('role="status" aria-live="polite">Rows 51\u2013100 of 312</p>');
    expect(html).toContain('<label class="pager-size" for="page-size">Rows per page</label><select id="page-size"');
    expect([...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1])).toEqual(['25', '50', '100', 'all']);
    expect(html).toContain('<option value="50" selected>');
    expect(pagerHtml(pageSlice(range(312), 1, 50), 50)).toContain('data-page="prev" disabled');
    expect(pagerHtml(pageSlice(range(312), 7, 50), 50)).toContain('data-page="next" disabled');
    expect(pagerHtml(pageSlice(range(1764), 1, 'all'), 'all')).toContain('Rows 1\u20131,764 of 1,764');
  });
  it('keeps the size label and its select together, and on a phone puts them on a second row at the right', () => {
    const html = pagerHtml(pageSlice(range(312), 2, 50), 50);
    expect(html).toMatch(/<span class="pager-size-group"><label class="pager-size" for="page-size">Rows per page<\/label><select id="page-size"[^>]*>[\s\S]*?<\/select><\/span>/);
    const css = read('src/ui/styles/table.css');
    expect(css).toMatch(/\.pager-size-group\s*\{[^}]*display: inline-flex;[^}]*flex: none;[^}]*white-space: nowrap;/);
    expect(css).toMatch(/@media \(max-width: 600px\)\s*\{[^@]*\.pager\s*\{[^}]*display: grid;[^}]*grid-template-columns: auto minmax\(0, 1fr\) auto;[^@]*\.pager-size-group\s*\{[^}]*grid-column: 1 \/ -1;[^}]*justify-self: end;/);
  });
  it('the total is on screen once: the count under the grid shows only with all rows on one page, or with no pager', () => {
    const table = read('src/ui/views/table.ts');
    expect(table).toContain("gridFoot.hidden = grid === null || (pagerShown && paging().size !== 'all');");
    expect(table).toContain('showFoot(slice.total > 0);');
  });
  it('prints every row and no pager', () => {
    const css = read('src/ui/styles/print.css');
    expect(css).toMatch(/\.toolbar--table,\s*\.pager,/);
    const table = read('src/ui/views/table.ts');
    expect(table).toContain("window.addEventListener('beforeprint', onBeforePrint);");
    expect(table).toContain('tableHtml(shown, reg.config, state.sort, plain, printing ? null : paging())');
  });
});
