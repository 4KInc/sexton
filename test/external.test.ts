// Figures from outside the register on a ledger (src/ui/external.ts): each one is cited in its case file, and
// shown only where it differs from the snapshot. No other case file cites a differing orbit figure.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { DA_23_888, EXTERNAL, perigeeAside } from '../src/ui/external.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { ledgerPageHtml } from '../src/ui/views/ledger.ts';
const ROOT = process.cwd();
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const text = (html: string): string => html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'");
describe('EchoStar 7 (NORAD 27378)', () => {
  const html = ledgerPageHtml(real, 27378);
  const r = real.records.find((x) => x.norad === 27378)!;
  it('says it was fined, under the launch-era note, with the FCC order linked', () => {
    expect(text(html)).toContain('Fined by the FCC in 2023 (DA 23-888, $150,000) over its disposal orbit.');
    expect(html).toContain(`<a href="${DA_23_888}">DA 23-888</a>`);
    expect(html.indexOf('class="era-badge"')).toBeLessThan(html.indexOf('class="ledger-fine"'));
    expect(read('docs/methodology.md')).toContain(DA_23_888);
  });
  it('gives the order\'s perigee beside the snapshot\'s', () => {
    expect(text(html)).toContain("About 122 km at disposal (FCC, 2023); 110 km in the snapshot's elements.");
    expect(Math.round(r.pKm)).toBe(110);
  });
  it('prints both: the link with its address, and the two lines in ink', () => {
    const css = read('src/ui/styles/print.css');
    expect(css).toMatch(/\.ledger a\[href\^='http'\]::after\s*\{\s*content: ' \(' attr\(href\) '\)';/);
    expect(css).toMatch(/\.ledger-fine,\s*\.dd-aside\s*\{\s*color: var\(--ink\);/);
    expect(css).not.toMatch(/\.ledger-fine[^{]*\{[^}]*display:\s*none/);
  });
  it('the other ledgers show neither line', () => {
    for (const n of [15873, 40258]) {
      const other = ledgerPageHtml(real, n);
      expect(other).not.toContain('ledger-fine');
      expect(other).not.toContain('dd-aside');
    }
  });
});
describe('every outside figure', () => {
  it('is cited, with its source, in that object\'s case file, and differs from the snapshot', () => {
    for (const [norad, ext] of EXTERNAL) {
      const file = read(`data/cases/${norad}.md`);
      const r = real.records.find((x) => x.norad === norad)!;
      if (ext.fine !== undefined) {
        expect(file).toContain(ext.fine.url);
        expect(file).toContain('$150,000');
        expect(file).toContain(ext.fine.linkText);
      }
      if (ext.perigee !== undefined) {
        expect(file).toContain(`${ext.perigee.km} km`);
        expect(Math.abs(r.pKm - ext.perigee.km)).toBeGreaterThanOrEqual(1);
      }
      for (const s of [perigeeAside(ext.perigee ?? { km: 0, source: '' }, r.pKm), `${ext.fine?.before}${ext.fine?.linkText}${ext.fine?.after}`]) expect(findHits(s, 'external')).toEqual([]);
    }
  });
  it('no other case file cites an outside source for an orbit figure (the rule texts give no orbit, so they may stand on a line with one)', () => {
    for (const f of readdirSync(join(ROOT, 'data/cases')).filter((n) => n.endsWith('.md'))) {
      const norad = Number(f.replace('.md', ''));
      if (EXTERNAL.has(norad)) continue;
      const lines = read(`data/cases/${f}`).split('\n').filter((l) => /\d km/.test(l));
      for (const l of lines) for (const m of l.matchAll(/\[([^\]:]+):/g)) expect(['register', 'docs/methodology.md', 'IADC-02-01 Revision 2', '47 CFR § 25.283'], `${f}: ${m[1]}`).toContain(m[1]);
    }
  });
});
