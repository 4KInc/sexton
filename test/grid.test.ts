// @vitest-environment happy-dom
// Redesign 4, step B: the desktop grid. The rows come from gridRows (pure, tested against the HTML table's rows and
// order), and one smoke test mounts the real AG Grid module in a DOM.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridAge } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { applyFilters, NO_FILTERS, parseState } from '../src/ui/state.ts';
import type { Sort } from '../src/ui/state.ts';
import { gridRow, gridRows } from '../src/ui/views/grid-rows.ts';
import { orderRows, rowHtml, viewOf } from '../src/ui/views/table.ts';
const ROOT = process.cwd();
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const config = real.config;
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');
/** The HTML table escapes its text; the grid's text cells are plain strings (AG Grid sets them as text). */
const unescape = (s: string): string => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** The text of each cell of one HTML table row, in order, without markup. */
const cellsOf = (html: string): string[] =>
  [...html.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => m[1]!.replace(/<span class="visually-hidden">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, '').trim()).map(unescape);
describe('gridRows: the same rows as the HTML table', () => {
  it('has the HTML table cell text for every record (name, NORAD, owner, launch, verdict word, ±, p, q, e, source)', () => {
    for (const r of real.records) {
      const g = gridRow(r, 1, config);
      const html = cellsOf(rowHtml(r, config));
      const verdict = g.verdictHtml.replace(/<[^>]*>/g, '').trim();
      // The data age is the one cell that differs on purpose: the grid drops its source, which is in the Orbit column beside it.
      expect([g.name, String(g.norad), g.owner, g.launch, verdict, g.borderline === true ? '\u00B1' : '', g.p, g.q, g.e, g.source], String(r.norad)).toEqual(html.slice(0, 10));
      expect(g.age, String(r.norad)).toBe(gridAge(r));
    }
  });
  const cases: [string, string][] = [
    ['default view', ''],
    ['Show all 1,764', 'bones=1'],
    ['sorted by e, descending', 'sort=e&dir=desc'],
    ['a filter and a sort', 'owner=US&verdict=unquiet&sort=name'],
    ['all, by data age', 'bones=1&sort=age'],
  ];
  for (const [label, query] of cases) {
    it(`keeps the HTML table's set and order: ${label}`, () => {
      const q = new URLSearchParams(query);
      const state = parseState(q);
      const { byDefault, shown } = viewOf(real.records, state.filters);
      const plain = byDefault && !q.has('sort');
      const rows = gridRows(shown, config, state.sort, plain);
      expect(rows.map((r) => r.norad)).toEqual(orderRows(shown, state.sort, plain).map((r) => r.norad));
      expect(rows.map((r) => r.n)).toEqual(rows.map((_, i) => i + 1));
    });
  }
  it('the default view is the 131 post-rule payloads, story rows first; Show all is all 1,764', () => {
    const def = gridRows(viewOf(real.records, NO_FILTERS).shown, config, parseState(new URLSearchParams()).sort, true);
    expect(def).toHaveLength(131);
    const story = def.filter((r) => r.story).length;
    expect(story).toBe(36);
    expect(def.slice(0, story).every((r) => r.story)).toBe(true);
    expect(gridRows(applyFilters(real.records, { ...NO_FILTERS, bones: true }), config, { key: 'norad', dir: 'asc' }, false)).toHaveLength(1764);
  });
  it('only story rows (unquiet or shallow grave, launched on or after the rule date) are marked story, and only rows with a verdict link to a ledger', () => {
    for (const r of real.records) {
      const g = gridRow(r, 1, config);
      const v = r.verdict;
      expect(g.story).toBe(v.kind === 'verdict' && v.era === null && (v.verdict === 'unquiet' || v.verdict === 'shallow grave'));
      expect(g.ledger).toBe(v.kind === 'verdict');
    }
  });
});
describe('the grid data age', () => {
  it('is the GP epoch as "22 Nov 2026, 09:58 UTC", or "Date not given" for SATCAT, and never repeats the source', () => {
    expect(gridAge({ orbitSource: { kind: 'GP', epoch: '2026-11-22T09:58:12.345Z' } } as never)).toBe('22 Nov 2026, 09:58 UTC');
    expect(gridAge({ orbitSource: { kind: 'GP', epoch: '2026-01-05T00:07:00Z' } } as never)).toBe('5 Jan 2026, 00:07 UTC');
    expect(gridAge({ orbitSource: { kind: 'SATCAT' } } as never)).toBe('Date not given');
    for (const r of real.records) {
      const age = gridAge(r);
      expect(age).not.toMatch(/GP|SATCAT|mean elements/);
      expect(age).toMatch(r.orbitSource.kind === 'GP' ? /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/ : /^Date not given$/);
    }
  });
});
describe('the grid module', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  it('mounts AG Grid with Sexton columns, the rows given, the sort shown, and no console errors or warnings', async () => {
    const errors: unknown[] = [];
    const spyE = vi.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a));
    const spyW = vi.spyOn(console, 'warn').mockImplementation((...a) => void errors.push(a));
    const { mountGrid } = await import('../src/ui/views/grid.ts');
    const host = document.createElement('div');
    host.style.height = '600px';
    host.style.width = '1400px';
    document.body.append(host);
    const shown = applyFilters(real.records, { ...NO_FILTERS, era: 'after' });
    const sort: Sort = { key: 'e', dir: 'desc' };
    const seen: Sort[] = [];
    const grid = mountGrid(host, { rows: gridRows(shown, config, sort, false), sort, paging: { page: 2, size: 25 }, onSort: (s) => void seen.push(s), onOpen: () => {} });
    await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector('[role="grid"], [role="treegrid"]')).not.toBeNull();
    const heads = [...host.querySelectorAll('.ag-header-cell')].map((h) => h.getAttribute('col-id'));
    expect(heads).toEqual(['n', 'name', 'norad', 'owner', 'launch', 'verdict', 'borderline', 'p', 'q', 'e', 'source', 'age']);
    // The legend sits directly above the grid, on screen, with the caption that names it.
    expect(read('src/ui/views/table.ts')).toMatch(/id="grid-caption"[^`]*TABLE\.caption[^`]*grid-key[^`]*TABLE\.colKey/);
    expect(host.querySelector('.ag-header-cell[col-id="e"]')!.getAttribute('aria-sort')).toBe('descending');
    // Page 2 of 25 rows: the first row drawn is row 26, and AG Grid's own pager panel is not drawn.
    const firstN = [...host.querySelectorAll('.ag-row')].map((r) => Number(r.querySelector('[col-id="n"]')?.textContent)).filter((n) => n > 0);
    expect(Math.min(...firstN)).toBe(26);
    expect(Math.max(...firstN)).toBeLessThanOrEqual(50);
    // AG Grid keeps its own pager element, but hidden (suppressPaginationPanel); Sexton's pager is the one drawn.
    const panel = host.querySelector('.ag-paging-panel');
    expect(panel === null || panel.classList.contains('ag-hidden')).toBe(true);
    // A sort set by the code is not passed back as a reader's sort.
    grid.update(gridRows(shown, config, { key: 'name', dir: 'asc' }, false), { key: 'name', dir: 'asc' }, { page: 1, size: 'all' });
    await new Promise((r) => setTimeout(r, 50));
    expect(seen).toEqual([]);
    expect(host.querySelector('.ag-header-cell[col-id="name"]')!.getAttribute('aria-sort')).toBe('ascending');
    grid.destroy();
    spyE.mockRestore();
    spyW.mockRestore();
    expect(errors).toEqual([]);
  });
  it('registers only the modules it uses: no AllCommunityModule, no Enterprise package, no licence key', () => {
    const src = read('src/ui/views/grid.ts');
    expect(src).not.toContain('AllCommunityModule');
    expect(src).not.toMatch(/ag-grid-enterprise|LicenseManager|licenseKey/);
    expect(src).toMatch(/ModuleRegistry\.registerModules\(\[RowStyleModule, CellStyleModule, ColumnApiModule, PaginationModule\]\)/);
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['ag-grid-community']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Object.keys(pkg.dependencies).some((d) => d.includes('enterprise'))).toBe(false);
  });
  it('is loaded only by a dynamic import, only over 600 px, and the HTML table stays for phones, print and a failed load', () => {
    const table = read('src/ui/views/table.ts');
    expect(table).toContain("import('./grid.ts')");
    expect(table).not.toMatch(/^import \{[^}]*\} from '\.\/grid\.ts'/m);
    expect(table).toContain("GRID_MEDIA = '(min-width: 601px)'");
    const css = read('src/ui/styles/table.css');
    expect(css).toMatch(/@media \(min-width: 601px\)\s*\{\s*\.grid-on #table-host\s*\{\s*display: none;/);
    expect(css).toMatch(/@media print\s*\{\s*\.grid-host,[^}]*display: none !important;[^}]*\}\s*\.grid-on #table-host\s*\{\s*display: block;/);
  });
});
