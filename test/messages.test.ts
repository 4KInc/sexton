// Redesign 5: the site's short messages. Each says what happened, about the site only, and offers one next action.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { emptyFiltersHtml, loadErrorHtml, noStoneHtml, notFoundHtml, viewLoadErrorHtml } from '../src/ui/messages.ts';
import { ledgerPageHtml } from '../src/ui/views/ledger.ts';
const ROOT = process.cwd();
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const text = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
describe('the messages', () => {
  it('not found: "No stone stands at this address." with a link back to the churchyard', () => {
    const html = notFoundHtml();
    expect(text(html)).toBe('No stone stands at this address. Back to the churchyard');
    expect(html).toContain('<a href="#/">Back to the churchyard</a>');
  });
  it('the register did not load: "The register would not rise. Try again in a moment." with a Try again button', () => {
    const html = loadErrorHtml();
    expect(text(html)).toBe('The register would not rise. Try again in a moment. Try again');
    expect(html).toMatch(/<button type="button"[^>]*data-retry>Try again<\/button>/);
    expect(html).toContain('role="alert"');
  });
  it('a page did not load: "This page stayed in the ground. Check the connection, then try again." with a Try again link to the same address', () => {
    const html = viewLoadErrorHtml('#/sat/27378');
    expect(text(html)).toBe('This page stayed in the ground. Check the connection, then try again. Try again');
    expect(html).toContain('<a href="#/sat/27378" data-retry>Try again</a>');
  });
  it('no match: "No stones match these filters." with a Clear all button', () => {
    const html = emptyFiltersHtml('table-empty');
    expect(text(html)).toBe('No stones match these filters. Clear all');
    expect(html).toMatch(/<button type="button"[^>]*data-empty-clear>Clear all<\/button>/);
    expect(html).toContain('id="table-empty" hidden');
  });
  it('an unknown NORAD id: "No stone carries NORAD 999999999." with links to the table and the churchyard', () => {
    expect(real.records.some((r) => r.norad === 999999999)).toBe(false);
    for (const html of [noStoneHtml(999999999), ledgerPageHtml(real, 999999999)]) {
      expect(text(html)).toBe('No stone carries NORAD 999999999. Go to the table Back to the churchyard');
      expect(html).toContain('<a href="#/table">Go to the table</a>');
      expect(html).toContain('<a href="#/">Back to the churchyard</a>');
    }
  });
  it('every message passes the language check', () => {
    for (const html of [notFoundHtml(), loadErrorHtml(), viewLoadErrorHtml('#/method'), emptyFiltersHtml('x'), noStoneHtml(1)]) expect(findHits(text(html), 'messages')).toEqual([]);
  });
  it('the views use them: the router for an unknown address and a failed load, both lists for an empty result, wired to Clear all', () => {
    const main = read('src/ui/main.ts');
    expect(main).toContain('view.innerHTML = notFoundHtml();');
    expect(main).toContain('loadErrorHtml()');
    expect(main).toMatch(/\[data-retry\]'\)\?\.addEventListener\('click', \(\) => window\.location\.reload\(\)\)/);
    for (const [file, id] of [['src/ui/views/churchyard.ts', 'chart-empty'], ['src/ui/views/table.ts', 'table-empty']] as const) {
      const src = read(file);
      expect(src).toContain(`emptyFiltersHtml('${id}')`);
      expect(src).toMatch(/\[data-empty-clear\]'\) !== null\)[^\n]*\[data-clear-filters\]'\)\?\.click\(\)/);
    }
    // AG Grid's own "No Rows To Show" overlay is off, so the grid shows only Sexton's message.
    expect(read('src/ui/views/grid.ts')).toContain('suppressNoRowsOverlay: true');
  });
});
