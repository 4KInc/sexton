// A-FIX: selecting a stone, the first screen, and the chart's atmosphere.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CARD, HERO, SITE, TIP } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { intersects, placeLabels, stoneBox } from '../src/ui/svg/labels.ts';
import { LAYOUT, plotHeight, SCALE, yOf } from '../src/ui/svg/scale.ts';
import { chartModel, chartSvg, enterAction, heroHtml } from '../src/ui/views/churchyard.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const source = read('src/ui/views/churchyard.ts');
describe('selecting a stone', () => {
  it('Enter selects, and Enter on the selected stone opens its ledger', () => {
    expect(enterAction(null, 27378)).toBe('select');
    expect(enterAction(40258, 27378)).toBe('select');
    expect(enterAction(27378, 27378)).toBe('open');
    fc.assert(fc.property(fc.integer({ min: 1, max: 99999 }), fc.integer({ min: 1, max: 99999 }), (a, b) => enterAction(a, b) === (a === b ? 'open' : 'select')));
  });
  it('a plain click selects and does not follow the link; a double-click opens; Escape clears; modified clicks keep the link', () => {
    expect(source).toMatch(/event\.preventDefault\(\);\s*select\(Number\(link\.dataset\['norad'\]\)\);/);
    expect(source).toMatch(/root\.addEventListener\('dblclick', onDblClick\)/);
    expect(source).toMatch(/window\.location\.hash = `#\/sat\/\$\{norad\}`/);
    expect(source).toMatch(/event\.key === 'Escape'[\s\S]*select\(null\)/);
    expect(source).toMatch(/event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey \|\| event\.altKey \|\| event\.button !== 0/);
  });
  it('the help text says how to select and how to open', () => {
    expect(TIP.open).toMatch(/select/i);
    expect(TIP.open).toMatch(/Double-click/);
    expect(CARD.empty).toMatch(/Escape/);
    expect(CARD.empty).toMatch(/Enter again/);
  });
  it('the card keeps a real button to the ledger', () => {
    expect(source).toContain('class="button button--primary" href="#/sat/');
  });
});
describe('the first screen', () => {
  it('the churchyard heading stays for screen readers and focus, but is hidden on screen', () => {
    const main = read('src/ui/main.ts');
    expect(main).toMatch(/classList\.toggle\(\s*'visually-hidden',\s*route\.name === 'churchyard' \|\| route\.name === 'table' \|\| route\.name === 'census' \|\| route\.name === 'method' \|\| view\.querySelector\('\.ledger-head'\) !== null,?\s*\)/);
    expect(read('src/ui/styles/base.css')).toMatch(/\.visually-hidden\s*\{[^}]*clip-path/);
  });
  it('the high ground is short, so the road (0 km) sits in the first 520 units of the chart', () => {
    expect(SCALE.highPx).toBeLessThanOrEqual(100);
    expect(yOf(0)).toBeLessThanOrEqual(520);
    // No plotted value moved: the linear part keeps its scale, and the whole chart got shorter.
    expect(SCALE.pxPerKm).toBe(0.8);
    expect(LAYOUT.top + plotHeight() + LAYOUT.bottom).toBeLessThan(868);
  });
  it('the fine print is one line of short items with a Limits panel that holds the full sentences', () => {
    const html = heroHtml(real);
    const line = html.slice(html.indexOf('<ul class="fine-list">'), html.indexOf('</ul>', html.indexOf('<ul class="fine-list">')));
    expect(line).toContain('CelesTrak snapshot, 22 Nov 2026');
    expect(line).toContain('C_R·A/m 0.012–0.045 m²/kg');
    expect(line).toContain('±25 km');
    expect(line).toContain('The register only sees objects still near GEO');
    expect(line).toContain('IADC guidelines are voluntary');
    expect(line).toContain('FCC rule covers FCC-authorized launches from 18 Mar 2002');
    const limits = html.slice(html.indexOf('<details class="limits">'));
    expect(limits).toContain('Satellites sent much higher, or that left GEO, may be missing.');
    expect(limits).toContain('applies only to satellites the FCC authorizes, launched on or after 18 March 2002');
    expect(limits).toContain('We do not know when a satellite retired.');
    expect(limits).toContain('plausibility check');
    expect(HERO.limits).toBe('Limits');
  });
  it('GEO and perigee are folded into the one-line caption', () => {
    expect(HERO.caption).toBe('Each stone is a retired satellite, as tall as its perigee (lowest point) above GEO (the 35,786 km belt). The road is the protected zone.');
    expect(HERO.caption.length).toBeLessThanOrEqual(150);
    expect(source).not.toContain('stage-terms');
  });
});
describe('the chart atmosphere', () => {
  const svg = chartSvg(real, false);
  it('has a night sky and a moon glow behind the bands, inside the hidden decoration group', () => {
    const hidden = svg.slice(svg.indexOf('<g aria-hidden="true">'));
    expect(hidden.indexOf('class="sky"')).toBeGreaterThan(-1);
    expect(hidden.indexOf('class="sky"')).toBeLessThan(hidden.indexOf('class="band band--below"'));
    expect(hidden.indexOf('class="moon-glow"')).toBeLessThan(hidden.indexOf('class="band band--road"'));
  });
  it('draws a crisp edge on both sides of the road at the band edges', () => {
    expect(svg.match(/class="road-edge"/g)).toHaveLength(2);
  });
  it('every ringed stone has the ring, and the ring is a bone outline, not amber', () => {
    const css = read('src/ui/styles/churchyard.css');
    const rule = /\.flag-ring\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toMatch(/stroke:\s*var\(--bone\)/);
    expect(rule).not.toMatch(/lantern/);
  });
});
describe('case-file labels', () => {
  const model = chartModel(real, false);
  const named = model.stones.filter((r) => r.caseFile);
  const all = [...model.pos.values()].map((p) => stoneBox(p.x, p.y));
  it('there are three, and every one has a place', () => {
    expect(named.map((r) => r.norad).sort((a, b) => a - b)).toEqual([15873, 27378, 40258]);
    for (const r of named) expect(model.labels.has(r.norad), r.name).toBe(true);
  });
  it('no label box meets any stone box, and no two labels meet', () => {
    const boxes = named.map((r) => model.labels.get(r.norad)!.box);
    for (const [i, b] of boxes.entries()) {
      for (const s of all) expect(intersects(b, s), `${named[i]!.name} against a stone`).toBe(false);
      for (const [j, o] of boxes.entries()) if (j !== i) expect(intersects(b, o), `${named[i]!.name} against ${named[j]!.name}`).toBe(false);
    }
  });
  it('every label stays inside the plot, and a label that stands apart has a leader line', () => {
    for (const r of named) {
      const l = model.labels.get(r.norad)!;
      expect(l.box.x0).toBeGreaterThanOrEqual(model.cols.gutter);
      expect(l.box.x1).toBeLessThanOrEqual(model.cols.width - LAYOUT.right);
      expect(l.box.y0).toBeGreaterThanOrEqual(LAYOUT.top);
      expect(l.box.y1).toBeLessThanOrEqual(LAYOUT.top + plotHeight());
    }
  });
  it('placeLabels tries right, left, above, below, then a leader, and never overlaps (property)', () => {
    const bounds = { x0: 0, y0: 0, x1: 400, y1: 300 };
    expect(placeLabels([{ id: 1, name: 'ECHOSTAR 7', x: 100, y: 100 }], [{ x: 100, y: 100 }], bounds).placements.get(1)!.anchor).toBe('start');
    fc.assert(
      fc.property(fc.array(fc.record({ x: fc.integer({ min: 40, max: 360 }), y: fc.integer({ min: 40, max: 260 }) }), { minLength: 1, maxLength: 12 }), (stones) => {
        const { placements, unplaced } = placeLabels([{ id: 1, name: 'LUCH (OLYMP-K 1)', x: 200, y: 150 }], [{ x: 200, y: 150 }, ...stones], bounds);
        if (unplaced.length === 0) {
          const b = placements.get(1)!.box;
          for (const s of [{ x: 200, y: 150 }, ...stones]) expect(intersects(b, stoneBox(s.x, s.y), 2)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
  it('the label is drawn outside the stone link, hidden from screen readers (the stone already says its name)', () => {
    const svg = chartSvg(real, false);
    expect(svg).toMatch(/<g aria-hidden="true" pointer-events="none"><g class="stone-label">/);
    expect(svg.match(/class="stone-name"/g)).toHaveLength(3);
  });
});
describe('the selection card stays inside the plot', () => {
  it('starts after the axis column and ends before the plot edge', () => {
    const css = read('src/ui/styles/churchyard.css');
    expect(css).toMatch(/\.card--left:has\(\.card-name\)\s*\{[^}]*left:\s*calc\(var\(--axis, 0%\)/);
    expect(css).toMatch(/right:\s*calc\(var\(--plot-right, 0%\)/);
    expect(css).toMatch(/top:\s*calc\(var\(--plot-top, 0%\)/);
    expect(source).toContain("['--axis', model.cols.gutter, vb.width]");
    expect(source).toContain('plot.style.setProperty(name');
  });
});
describe('ledger navigation', () => {
  it('a ledger highlights no tab and links back to the list the visitor came from', () => {
    const main = read('src/ui/main.ts');
    expect(main).toMatch(/lastList\.name === 'table' \? 'table' : ''/);
    expect(main).toContain('SITE.backTo[lastList.name]');
    expect(SITE.backTo.churchyard).toBe('\u2190 Back to churchyard');
    expect(SITE.backTo.table).toBe('\u2190 Back to table');
    expect(main).toMatch(/let lastList: \{ name: 'churchyard' \| 'table'; query: URLSearchParams \} = \{ name: 'churchyard'/);
  });
});
