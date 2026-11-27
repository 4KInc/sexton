// Redesign 2, step 3: the census as charts with direct labels, caveats under each chart, and the table as a ledger.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { postRuleSummary } from '../src/engine/headline.ts';
import type { VerdictName } from '../src/engine/types.ts';
import { METHOD_SECTIONS, verdictCopy, VERDICT_ORDER } from '../src/ui/copy.ts';
import { formatCount, formatShare } from '../src/ui/format.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { censusHtml } from '../src/ui/views/census.ts';
import { headingsOf, methodHtml } from '../src/ui/views/method.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const html = censusHtml(real);
const c = real.census;
const section = (id: string): string => {
  const start = html.indexOf(`id="census-${id}"`);
  return html.slice(start, html.indexOf('</section>', start));
};
describe('the verdict chart', () => {
  const body = section('verdicts');
  it('has one bar per verdict, in the legend order, each labelled in mono "n of N (x%)" with the word only', () => {
    const rows = [...body.matchAll(/<li class="bar-row"><span class="bar-name">([^<]*)<\/span>[\s\S]*?<span class="bar-n" data-census="([^"]*)">([^<]*)<\/span>([^<]*)/g)];
    expect(rows).toHaveLength(6);
    for (const [i, m] of rows.entries()) {
      const v = VERDICT_ORDER[i]!;
      const n = c.retired.byVerdict[v];
      expect(m[1]).toBe(verdictCopy(v, real.config).word);
      expect(m[3]).toBe(formatCount(n));
      expect(m[3]! + m[4]!).toBe(formatShare(n, c.retired.total));
    }
  });
  it('draws each bar as the share of N, from 0 to 100', () => {
    for (const v of VERDICT_ORDER) {
      const share = (100 * c.retired.byVerdict[v]) / c.retired.total;
      expect(body).toContain(`style="width:${share.toFixed(2)}%"`);
    }
  });
  it('shows the uncertain verdict in its own hatched grey, and the borderline part of each bar hatched', () => {
    expect(body.match(/bar-fill--uncertain/g)).toHaveLength(1);
    const hatched = [...body.matchAll(/<span class="bar-sub"> · ([\d,]+) borderline<\/span>/g)].map((m) => Number(m[1]!.replace(',', '')));
    expect(hatched.reduce((a, b) => a + b, 0)).toBe(c.retired.borderline.yes);
    const css = strip(read('src/ui/styles/census.css'));
    expect(css).toMatch(/\.bar-fill--uncertain\s*\{[^}]*repeating-linear-gradient/);
    expect(css).toMatch(/\.bar-hatch\s*\{[^}]*repeating-linear-gradient/);
  });
  it('is the era chart too: three rows, each a share of the retired payloads', () => {
    const era = section('era');
    expect(era.match(/<li class="bar-row">/g)).toHaveLength(3);
    for (const k of ['beforeRule', 'onOrAfterRule', 'unknown'] as const) {
      expect(era).toContain(`data-census="[&quot;retired&quot;,&quot;era&quot;,&quot;${k}&quot;]">${formatCount(c.retired.era[k])}</span>`);
    }
  });
  it('is the headline chart, for the group launched on or after the rule date', () => {
    const s = postRuleSummary(real.records);
    const head = section('headline');
    for (const v of VERDICT_ORDER as readonly VerdictName[]) expect(head).toContain(`data-headline="${v}">${formatCount(s.byVerdict[v])}</span>${formatShare(s.byVerdict[v], s.postRule).slice(formatCount(s.byVerdict[v]).length)}`);
  });
});
describe('the legend at the top', () => {
  it('comes before the numbers, with each verdict word and its meaning once, and every row shows the word alone', () => {
    expect(html.indexOf('class="legend-dl"')).toBeLessThan(html.indexOf('class="stats"'));
    expect(html.indexOf('class="legend-dl"')).toBeLessThan(html.indexOf('id="census-headline"'));
    expect(html).not.toMatch(/bar-name">[^<]*\(/);
  });
});
describe('caveats where they apply', () => {
  const notes = [...html.matchAll(/<p class="chart-note-mono">([^]*?)<\/p>/g)].map((m) => m[1]!);
  it('puts one short mono note under each chart, with a link to its method section', () => {
    expect(notes).toHaveLength(4);
    for (const n of notes) {
      expect(n).toMatch(/Method <a href="#\/method\?s=m-[a-z0-9-]+" aria-label="Method, section m-[a-z0-9-]+">§<\/a>$/);
      expect(n).not.toContain('%');
    }
    // In page order: the headline chart, the verdict chart, the era chart, the owner table.
    for (const i of [0, 1]) {
      expect(notes[i]).toContain('Perigee from GP mean elements or SATCAT altitudes, ±25 km');
      expect(notes[i]).toContain('CelesTrak, 22 Nov 2026');
    }
  });
  it('links only to headings that exist on the method page', () => {
    const ids = new Set(headingsOf(methodHtml()).map((e) => e.id));
    for (const id of Object.values(METHOD_SECTIONS)) expect(ids.has(id), id).toBe(true);
    for (const m of html.matchAll(/href="#\/method\?s=([^"]+)"/g)) expect(ids.has(m[1]!), m[1]).toBe(true);
  });
  it('opens the method page at that section, after the router has moved focus to the page heading', () => {
    const src = read('src/ui/views/method.ts');
    expect(src).toContain("query.get('s')");
    expect(src).toContain('window.setTimeout');
    // Changed on purpose: the method page now loads on first open, so main.ts mounts it from the loaded module with the same query.
    expect(read('src/ui/main.ts')).toContain('m.mountMethod(view, query)');
  });
});
describe('the owner table', () => {
  it('shows the top 12 owner codes with inline bars, and the rest behind "Show all"', () => {
    const owner = section('owner');
    const bodies = owner.match(/<tbody[^>]*>[\s\S]*?<\/tbody>/g)!;
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.match(/<tr>/g)).toHaveLength(12);
    const total = Object.keys(c.retired.byOwner).length;
    expect(bodies[1]!.match(/<tr>/g)).toHaveLength(total - 12);
    expect(bodies[1]).toContain('id="owners-rest"');
    expect(owner).toMatch(/<tbody id="owners-rest" hidden>/);
    expect(owner).toContain(`Show all ${total} owner codes`);
    expect(owner).toContain('aria-expanded="false" aria-controls="owners-rest"');
    expect(owner.match(/class="ibar-cell"/g)).toHaveLength(total);
    // The biggest owner has the longest bar.
    expect(bodies[0]!).toContain('class="ibar" aria-hidden="true" style="width:100.00%"');
  });
});
describe('the table as a ledger', () => {
  const css = strip(read('src/ui/styles/table.css'));
  it('numbers its rows, rules them with hairlines, and has no stripes', () => {
    expect(css).toMatch(/tbody\s*\{\s*counter-reset:\s*rowno/);
    expect(css).toMatch(/tbody tr\s*\{[^}]*counter-increment:\s*rowno/);
    expect(css).toMatch(/tbody th::before\s*\{[^}]*content:\s*counter\(rowno\)/);
    expect(css).toMatch(/\.register-table td\s*\{[^}]*border-bottom:\s*1px solid var\(--rule\)/);
    expect(css).not.toMatch(/nth-child\(even\)/);
  });
  it('makes rows 38 px tall, sets numbers and dates in mono, keeps dates on one line, and aligns numbers right', () => {
    expect(css).toMatch(/tbody tr\s*\{[^}]*height:\s*2\.375rem/);
    expect(css).toMatch(/tbody td\s*\{[^}]*font-family:\s*var\(--font-mono\)[^}]*text-wrap:\s*nowrap/);
    expect(css).toMatch(/tbody td:nth-child\(2\)\s*\{\s*text-align:\s*right/);
    expect(css).toMatch(/\.num-cell\s*\{[^}]*text-align:\s*right/);
    expect(css).toMatch(/thead th\s*\{[^}]*text-wrap:\s*nowrap/);
  });
  it('shows a short chip (the stone and the word) and keeps the meanings in the note above', () => {
    expect(css).toMatch(/\.chip\s*\{[^}]*border-radius:\s*999px/);
    expect(read('src/ui/copy.ts')).toContain("verdictKeySummary: 'The verdict words, and what each one means'");
  });
});
