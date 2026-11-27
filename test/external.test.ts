// Figures from outside the register on a ledger (src/ui/external.ts): each one is cited in its case file, and
// shown only where it differs from the snapshot. No other case file cites a differing orbit figure.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { figureProblems, sourcesRow } from '../scripts/case-figures.ts';
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
  it('in every other case file, a distance in km is cited to the register, the methodology, or a Sources row that holds that figure', () => {
    const methodology = read('docs/methodology.md');
    for (const f of readdirSync(join(ROOT, 'data/cases')).filter((n) => n.endsWith('.md'))) {
      if (EXTERNAL.has(Number(f.replace('.md', '')))) continue;
      expect(figureProblems(read(`data/cases/${f}`), methodology), f).toEqual([]);
    }
  });
  it('the Kodama note passes because 292 km is cited to the MEXT row, which holds 292', () => {
    const methodology = read('docs/methodology.md');
    const kodama = read('data/cases/27516.md');
    expect(kodama).toContain('約292㎞');
    expect(figureProblems(kodama, methodology)).toEqual([]);
    expect(sourcesRow(methodology, 'https://www.mext.go.jp/b_menu/shingi/gijyutu/gijyutu2/059/shiryo/__icsFiles/afieldfile/2017/10/27/1397652_4.pdf')).toContain('292');
  });
  it('still fails on an uncited figure, on one cited to a row that does not hold it, and on one cited only to a rule text', () => {
    const methodology = read('docs/methodology.md');
    const mext = 'https://www.mext.go.jp/b_menu/shingi/gijyutu/gijyutu2/059/shiryo/__icsFiles/afieldfile/2017/10/27/1397652_4.pdf';
    expect(figureProblems('- The operator raised the perigee about 300 km.', methodology).map((p) => p.problem)).toEqual(['no citation']);
    expect(figureProblems('- The perigee is +193 km [register: pKm]. The operator says 300 km.', methodology).map((p) => p.figure)).toEqual(['300']);
    expect(figureProblems(`- The operator reports about 300 km [JAXA slides for MEXT: ${mext}].`, methodology).map((p) => p.figure)).toEqual(['300']);
    expect(figureProblems(`- The operator reports about 292 km [JAXA slides for MEXT: ${mext}].`, methodology)).toEqual([]);
    expect(figureProblems('- A band of 280 km [IADC-02-01 Revision 2: https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf].', methodology)).toHaveLength(1);
    expect(figureProblems('- An invented source says 292 km [Made Up: https://example.org/x].', methodology)).toHaveLength(1);
  });
});
