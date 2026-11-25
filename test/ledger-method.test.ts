// Redesign 2, step 4: the ledger as a register entry with an engraved scale, and the method page with a summary and expanders.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { METHOD_SECTIONS } from '../src/ui/copy.ts';
import type { Retired } from '../src/ui/ledger-text.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { retiredPayloads } from '../src/ui/views/churchyard.ts';
import { ledgerHtml } from '../src/ui/views/ledger.ts';
import { headingsOf, methodHtml } from '../src/ui/views/method.ts';
import { thresholdBarHtml } from '../src/ui/views/threshold.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const retired = retiredPayloads(real.records) as Retired[];
const echo = retired.find((r) => r.norad === 27378)!;
describe('the ledger entry', () => {
  const page = ledgerHtml(echo, real);
  const css = strip(read('src/ui/styles/ledger.css'));
  it('sets the name large in IM Fell and the number and readings in mono', () => {
    expect(/\.ledger-name\s*\{([^}]*)\}/.exec(css)![1]).toContain('font-family: var(--font-display)');
    expect(/\.ledger-name\s*\{([^}]*)\}/.exec(css)![1]).toContain('font-size: var(--fs-72)');
    expect(/\.entry-no\s*\{([^}]*)\}/.exec(css)![1]).toContain('font-family: var(--font-mono)');
    expect(/\.readings dd\s*\{([^}]*)\}/.exec(css)![1]).toContain('font-family: var(--font-mono)');
  });
  it('draws the threshold bar as an engraved scale: minor marks every 10 km, the three edges numbered, a needle and a bracket', () => {
    const bar = thresholdBarHtml(echo, real.config);
    // The scale runs 70 to 340 km here, so 10 km is a 3.7 per cent step.
    expect(bar).toMatch(/style="--minor:3\.7%"/);
    for (const km of ['200', '247', '280']) expect(bar).toContain(`>${km}</span>`);
    expect(bar).toContain('class="pbar-mark"');
    expect(bar).toContain('class="pbar-band"');
    expect(css).toMatch(/\.pbar-track\s*\{[^}]*repeating-linear-gradient\(90deg[^}]*var\(--minor\)/);
    expect(css).toMatch(/\.pbar-seg--wall\s*\{[^}]*repeating-linear-gradient\(135deg/);
    expect(css).toMatch(/\.pbar-band\s*\{[^}]*border-left[^}]*border-right/);
  });
  it('sets Cite this as a mono block, a line each', () => {
    expect(page).toContain('<ul class="cite">');
    expect(/\.cite\s*\{([^}]*)\}/.exec(css)![1]).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(/\.cite\s*\{([^}]*)\}/.exec(css)![1]).toMatch(/list-style:\s*none/);
  });
  it('links each caveat to its method section, and only to headings that exist', () => {
    const ids = new Set(headingsOf(methodHtml()).map((e) => e.id));
    const links = [...page.matchAll(/href="#\/method\?s=([^"]+)"/g)].map((m) => m[1]!);
    expect(links).toEqual([METHOD_SECTIONS.iadc, METHOD_SECTIONS.gp, METHOD_SECTIONS.status]);
    for (const id of links) expect(ids.has(id), id).toBe(true);
    for (const m of page.matchAll(/<p class="chart-note-mono">([^]*?)<\/p>/g)) expect(findHits(m[1]!.replace(/<[^>]*>/g, ' '), 'ledger-note')).toEqual([]);
  });
  it('keeps the print layout: the entry, the readings and the scale are drawn in ink on paper', () => {
    const print = read('src/ui/styles/print.css');
    expect(print).toMatch(/\.entry-no,\s*\.readings dt/);
    expect(print).toMatch(/\.readings\s*\{\s*border-color:\s*var\(--ink-muted\)/);
    expect(print).toMatch(/\.pbar-track\s*\{[^}]*var\(--ink-muted\)[^}]*var\(--minor\)/);
    expect(print).toMatch(/\.cite\s*\{\s*background:\s*none/);
    expect(print).toMatch(/\.ledger-grid\s*\{\s*display:\s*block/);
  });
});
describe('the method page', () => {
  const html = methodHtml();
  const doc = read('docs/methodology.md');
  it('opens with a summary of what was measured, the known limits, and what would change a verdict', () => {
    expect(doc).toContain('## At a glance');
    const start = html.indexOf('<details class="msec msec--glance" open>');
    const glance = html.slice(start, html.indexOf('</details>', start));
    for (const lead of ['What we measured.', 'Known limits.', 'What would change a verdict.']) expect(glance).toContain(`<strong>${lead}</strong>`);
    expect(glance).toContain('It is never a verdict about an owner.');
    expect(glance).toContain('The IADC guidelines are voluntary.');
    expect(glance).toContain('Sexton has no retirement dates.');
    expect(html.indexOf('msec--glance')).toBeLessThan(html.indexOf('id="m-what-sexton-does"'));
    expect(findHits(doc.slice(doc.indexOf('## At a glance'), doc.indexOf('## What Sexton does')), 'glance')).toEqual([]);
  });
  it('makes every section an expander that holds its own heading, and only the summary starts open', () => {
    const entries = headingsOf(html).filter((e) => e.level === 2);
    expect(html.match(/<details class="msec/g)).toHaveLength(entries.length);
    expect(html.match(/<details class="msec[^>]* open>/g)).toHaveLength(1);
    for (const e of entries) expect(html).toMatch(new RegExp(`<summary><h2 id="${e.id}" tabindex="-1">`));
  });
  it('opens a section from a link, a contents entry, or the open-all button', () => {
    const src = read('src/ui/views/method.ts');
    expect(src.match(/closest\('details'\)\?\.setAttribute\('open', ''\)/g)).toHaveLength(2);
    expect(src).toContain("d.open = all.hasAttribute('data-open-all')");
    expect(html).toContain('data-open-all');
    expect(html).toContain('data-close-all');
  });
  it('has a mono contents list that stays in view on a wide screen', () => {
    const css = strip(read('src/ui/styles/method.css'));
    expect(/\.toc a\s*\{([^}]*)\}/.exec(css)![1]).toContain('font-family: var(--font-mono)');
    expect(css).toMatch(/@media \(min-width: 1000px\)\s*\{[\s\S]*\.toc\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.method pre\s*\{[^}]*overflow-x:\s*auto/);
  });
  it('is reached from the caveats on the other pages', () => {
    const limits = read('src/ui/views/fine.ts');
    expect(limits).toContain('METHOD_SECTIONS.rules');
    expect(limits).toContain('METHOD_SECTIONS.blind');
    expect(Object.values(METHOD_SECTIONS).every((id) => headingsOf(html).some((e) => e.id === id))).toBe(true);
  });
});
