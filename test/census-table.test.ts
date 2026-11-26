// Redesign C and D: the census tiles and validation picture, and the table's header, rows, verdict chips and toolbar.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { disposalRate, postRuleSummary } from '../src/engine/headline.ts';
import { COMPARISONS, verdictCopy, VERDICT_ORDER } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { applyFilters, NO_FILTERS, parseFilters, sortRecords } from '../src/ui/state.ts';
import { censusHtml, statsHtml, validationHtml } from '../src/ui/views/census.ts';
import { filtersHtml } from '../src/ui/views/filters.ts';
import { defaultOrder, defaultSet, rowHtml, tableHtml, viewOf } from '../src/ui/views/table.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const css = (f: string): string => read(`src/ui/styles/${f}`).replace(/\/\*[\s\S]*?\*\//g, '');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const config = real.config;
describe('census tiles', () => {
  const html = statsHtml(real);
  const s = postRuleSummary(real.records);
  const figure = (id: string): string => new RegExp(`data-stat="${id}"><span class="num">([\\d,]+)</span>`).exec(html)![1]!;
  it('show the four key numbers, each equal to the census', () => {
    expect(figure('objects')).toBe(real.census.population.total.toLocaleString('en-US'));
    expect(figure('retired')).toBe(String(real.census.retired.total));
    expect(figure('post-rule')).toBe(String(s.postRule));
    expect(figure('zone')).toBe(String(s.inOrNearZone));
    expect(html).toContain(`of ${s.postRule}`);
  });
  it('come before the headline section and the tables', () => {
    const page = censusHtml(real);
    expect(page.indexOf('class="stats"')).toBeLessThan(page.indexOf('id="census-headline"'));
    expect(page.indexOf('id="census-headline"')).toBeLessThan(page.indexOf('id="census-validation"'));
    expect(page.indexOf('id="census-validation"')).toBeLessThan(page.indexOf('id="census-population"'));
  });
});
describe('the validation picture', () => {
  const html = validationHtml(real.records);
  const d = disposalRate(real.records, config);
  const pc = (n: number): number => Math.round((10000 * n) / d.n) / 100;
  it('puts Sexton\'s band and central share and the published range on one axis from 0 to 100', () => {
    expect(d.n).toBe(45);
    expect([d.lower, d.central, d.upper]).toEqual([24, 27, 29]);
    expect(html).toContain(`class="vplot-band" style="left:${pc(24)}%;width:${pc(5)}%"`);
    expect(html).toContain(`class="vplot-point" style="left:${pc(27)}%"`);
    expect(html).toContain('class="vplot-esa" data-published style="left:70%;width:25%">70% to 95%</span>');
    expect(html).toContain('<span style="left:0%">0</span>');
    expect(html).toContain('<span style="left:100%">100</span>');
    // One figure, so one axis: the two rows are in the same box.
    expect(html.match(/<figure class="vplot"/g)).toHaveLength(1);
  });
  it('shows the counts, and the "different groups" note beside the picture', () => {
    expect(html).toContain('>27 of 45</span>');
    expect(html).toContain('>24 to 29 of 45</span>');
    const grid = html.slice(html.indexOf('<div class="vgrid">'));
    expect(grid.indexOf('class="vplot"')).toBeLessThan(grid.indexOf('<aside class="vnote">'));
    expect(grid).toContain('<h3>Different groups</h3>');
    expect(grid).toContain('plausibility check, not a test of one against the other');
    expect(css('census.css')).toMatch(/\.vgrid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(15rem, 1fr\)/);
  });
  it('is described in words for screen readers, with the drawing hidden from them', () => {
    expect(html).toContain('role="img" aria-label="Share of payloads that are buried, per cent. 27 of 45 (60.0%). 24 of 45 (53.3%) to 29 of 45 (64.4%). 70% to 95%"');
    expect(html).toContain('<div class="vplot-rows" aria-hidden="true">');
  });
  it('shows no range when none has been checked in its source', () => {
    const unchecked = COMPARISONS.map((c) => ({ ...c, verified: false, where: null }));
    expect(validationHtml(real.records, unchecked)).not.toContain('vplot-esa');
  });
});
describe('the table', () => {
  const retired = real.records.find((r) => r.verdict.kind === 'verdict')!;
  it('shows each verdict as a chip: the stone shape and the churchyard word', () => {
    for (const v of VERDICT_ORDER) {
      const r = real.records.find((x) => x.verdict.kind === 'verdict' && x.verdict.verdict === v)!;
      const row = rowHtml(r, config);
      expect(row).toMatch(/<span class="chip( chip--(story|quiet|early))?"><svg class="glyph"/);
      expect(row).toContain(`<span class="chip-word">${verdictCopy(v, config).word}</span>`);
      expect(row).toMatch(/aria-hidden="true"/);
    }
    expect(rowHtml(retired, config)).toContain('<th scope="row" role="rowheader"><a href="#/sat/');
  });
  it('keeps its header in view, rules its rows with hairlines (no stripes), and lifts the row under the pointer', () => {
    const t = css('table.css');
    expect(t).toMatch(/\.register-table thead th\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0/);
    expect(t).toMatch(/#table-host \.table-wrap\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/);
    expect(t).not.toMatch(/nth-child\(even\)\s*\{[^}]*background:\s*var\(--(panel|surface)/);
    expect(t).toMatch(/tbody tr:hover\s*\{[^}]*background:\s*var\(--stone\)/);
  });
  it('has a toolbar: search first, the other filters behind a button on a phone, and the same form fields', () => {
    const bar = filtersHtml(real.records, NO_FILTERS, config, false, true);
    expect(bar).toContain('<form class="filters filters--bar"');
    expect(bar).not.toContain('<details');
    expect(bar.indexOf('id="f-q"')).toBeLessThan(bar.indexOf('data-more'));
    expect(bar).toContain('aria-expanded="false" aria-controls="more-filters"');
    expect(bar).toContain('<div class="more-filters" id="more-filters">');
    for (const id of ['f-owner', 'f-era', 'f-bones']) expect(bar).toContain(`id="${id}"`);
    expect(bar).toContain('placeholder="echostar or 27378"');
    // Opened when a filter is already set.
    expect(filtersHtml(real.records, NO_FILTERS, config, true, true)).toContain('id="more-filters" data-open');
    // The churchyard form is unchanged: a closed details.
    expect(filtersHtml(real.records, NO_FILTERS, config, false)).toContain('<details class="filters-details">');
  });
});

describe('the table on a phone (below 600 px)', () => {
  const retired = real.records.find((r) => r.norad === 27378)!;
  const row = rowHtml(retired, config);
  const phone = css('table.css').slice(css('table.css').indexOf('@media (max-width: 599px)'));
  it('keeps its table semantics with explicit roles, because a card layout changes the display of every part', () => {
    const t = tableHtml([retired], config, { key: 'norad', dir: 'asc' });
    expect(t).toContain('<table class="register-table" role="table">');
    expect(t).toContain('<thead role="rowgroup"><tr role="row">');
    expect(t).toContain('<tbody role="rowgroup">');
    expect(row).toMatch(/^<tr data-norad="27378" role="row"><th scope="row" role="rowheader">/);
    expect(row.match(/<td role="cell"/g)).toHaveLength(10);
    expect(t.match(/<th scope="col" role="columnheader"/g)).toHaveLength(11);
  });
  it('lists each row\'s cells in the order the card layout expects', () => {
    // The card places cells by position: 1 name, 2 NORAD, 3 owner, 4 launch, 5 verdict, 6 borderline, 7 p, 8 q, 9 e, 10 source, 11 data age.
    const cells = [...row.matchAll(/<(?:th|td)[ >][^]*?(?=<(?:th|td)[ >]|<\/tr>)/g)].map((m) => m[0].replace(/<[^>]*>/g, ''));
    expect(cells).toHaveLength(11);
    expect(cells[0]).toBe('ECHOSTAR 7');
    expect(cells[1]).toBe('27378');
    expect(cells[2]).toBe('US');
    expect(cells[3]).toBe('2002-02-21');
    expect(cells[4]).toBe('Unquiet');
    expect(cells[5]).toBe('No');
    expect(cells[6]).toBe('+110.1');
    expect(cells[7]).toBe('+137.1');
    expect(cells[8]).toBe('0.00032');
    expect(cells[9]).toBe('GP');
    expect(cells[10]).toMatch(/^GP mean elements, epoch 2026-11-22/);
  });
  it('lays a row out as a card: name and verdict, then "NORAD 634 · US · 1963-07-26", then "p −29.4 km · q +22.4 km · e 0.00061", then the data age', () => {
    expect(phone).toMatch(/tbody tr\s*\{[^}]*position:\s*relative/);
    expect(phone).toMatch(/tbody td\s*\{[^}]*display:\s*inline/);
    expect(phone).toMatch(/tbody td:nth-child\(5\)\s*\{[^}]*position:\s*absolute[^}]*right:\s*0/);
    expect(phone).toMatch(/tbody td:nth-child\(2\)::before\s*\{\s*content:\s*'NORAD '/);
    // One space either side of each middle dot (\\00b7).
    expect(phone).toMatch(/td:nth-child\(3\)::before,\s*#table-host \.register-table tbody td:nth-child\(4\)::before\s*\{\s*content:\s*' \\00b7  '/);
    expect(phone).toMatch(/tbody td:nth-child\(7\)::before\s*\{\s*content:\s*'p '/);
    expect(phone).toMatch(/tbody td:nth-child\(8\)::before\s*\{\s*content:\s*' \\00b7  q '/);
    expect(phone).toMatch(/tbody td:nth-child\(9\)::before\s*\{\s*content:\s*' \\00b7  e '/);
    expect(phone).toMatch(/tbody td:nth-child\(4\)::after\s*\{[^}]*display:\s*block/);
    expect(phone).toMatch(/tbody td:nth-child\(11\)\s*\{[^}]*font-size/);
    expect(phone).toMatch(/td:nth-child\(6\),\s*#table-host \.register-table tbody td:nth-child\(10\)\s*\{\s*display:\s*none/);
  });
  it('hides the column headers on screen without removing them, and shows them if a sort button gets focus', () => {
    expect(phone).toMatch(/\.register-table thead\s*\{[^}]*clip-path:\s*inset\(50%\)/);
    expect(phone).toMatch(/thead:focus-within\s*\{[^}]*position:\s*static/);
  });
  it('has a select with name, NORAD id, launch date and perigee above the list, shown only on a phone', async () => {
    const src = read('src/ui/views/table.ts');
    expect(src).toContain("const PHONE_SORTS: readonly SortKey[] = ['name', 'norad', 'launch', 'p'];");
    expect(src).toContain('<label for="sort-by">');
    expect(src).toContain("sortBy.addEventListener('change', onSortBy)");
    const t = css('table.css');
    expect(t).toMatch(/\.sortbar\s*\{\s*display:\s*none/);
    expect(phone).toMatch(/\.sortbar\s*\{\s*display:\s*flex/);
  });
  it('leaves a wide screen as it was: no phone rule is outside the 599 px query', () => {
    const before = css('table.css').slice(0, css('table.css').indexOf('@media (max-width: 599px)'));
    expect(before).not.toMatch(/td:nth-child\(4\)::before/);
    expect(before).not.toMatch(/position:\s*absolute;[^}]*right:\s*0/);
    expect(before).toMatch(/\.register-table thead th\s*\{[^}]*position:\s*sticky/);
  });
});

describe('the table default view (design 3, step 4)', () => {
  const all = real.records;
  const storyOf = (r: (typeof all)[number]): boolean =>
    r.verdict.kind === 'verdict' && r.verdict.era === null && (r.verdict.verdict === 'unquiet' || r.verdict.verdict === 'shallow grave');
  it('with no filter shows only launches on or after the rule date: 131 payloads', () => {
    const v = viewOf(all, NO_FILTERS);
    expect(v.byDefault).toBe(true);
    expect(v.shown).toHaveLength(postRuleSummary(all).postRule);
    expect(v.shown.every((r) => r.verdict.kind === 'verdict' && r.verdict.era === null)).toBe(true);
  });
  it('puts unquiet and shallow grave first, then perigee, lowest first', () => {
    const order = defaultOrder(defaultSet(all));
    const firstOther = order.findIndex((r) => !storyOf(r));
    expect(firstOther).toBe(order.filter(storyOf).length);
    for (const part of [order.slice(0, firstOther), order.slice(firstOther)]) {
      for (let i = 1; i < part.length; i++) expect(part[i]!.pKm).toBeGreaterThanOrEqual(part[i - 1]!.pKm);
    }
  });
  it('lights only the story rows in lantern', () => {
    for (const r of defaultSet(all)) {
      const html = rowHtml(r, config);
      expect(html.includes('chip--story'), String(r.norad)).toBe(storyOf(r));
    }
  });
  it('an explicit filter link gives exactly what applyFilters gives, in the order it always had', () => {
    const queries = ['owner=US', 'verdict=unquiet', 'verdict=buried&verdict=uncertain', 'era=before', 'era=after', 'era=unknown', 'bones=1', 'q=echostar', 'q=27378', 'owner=US&era=after&verdict=unquiet&sort=p&dir=desc'];
    for (const qs of queries) {
      const f = parseFilters(new URLSearchParams(qs));
      const v = viewOf(all, f);
      expect(v.byDefault, qs).toBe(false);
      expect(v.shown.map((r) => r.norad), qs).toEqual(applyFilters(all, f).map((r) => r.norad));
    }
    // "bones=1" is "Show all": every one of the register's objects.
    expect(viewOf(all, parseFilters(new URLSearchParams('bones=1'))).shown).toHaveLength(all.length);
  });
  it('the default order marks no sorted column; a chosen sort does', () => {
    const shown = defaultSet(all);
    expect(tableHtml(shown, config, { key: 'norad', dir: 'asc' }, true)).not.toContain('aria-sort');
    expect(tableHtml(shown, config, { key: 'norad', dir: 'asc' })).toContain('aria-sort="ascending"');
    const byNorad = sortRecords(shown, { key: 'norad', dir: 'asc' }).map((r) => r.norad);
    expect([...byNorad].sort((a, b) => a - b)).toEqual(byNorad);
  });
});
