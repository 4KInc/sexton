// Redesign C and D: the census tiles and validation picture, and the table's header, rows, verdict chips and toolbar.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { disposalRate, postRuleSummary } from '../src/engine/headline.ts';
import { COMPARISONS, verdictCopy, VERDICT_ORDER } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { NO_FILTERS } from '../src/ui/state.ts';
import { censusHtml, statsHtml, validationHtml } from '../src/ui/views/census.ts';
import { filtersHtml } from '../src/ui/views/filters.ts';
import { rowHtml } from '../src/ui/views/table.ts';
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
      expect(row).toContain(`<span class="chip"><svg class="glyph"`);
      expect(row).toContain(`<span class="chip-word">${verdictCopy(v, config).word}</span>`);
      expect(row).toMatch(/aria-hidden="true"/);
    }
    expect(rowHtml(retired, config)).toContain('<th scope="row"><a href="#/sat/');
  });
  it('keeps its header in view, stripes its rows, and lifts the row under the pointer', () => {
    const t = css('table.css');
    expect(t).toMatch(/\.register-table thead th\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0/);
    expect(t).toMatch(/#table-host \.table-wrap\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/);
    expect(t).toMatch(/tbody tr:nth-child\(even\)\s*\{[^}]*background:\s*var\(--panel\)/);
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
