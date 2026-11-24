// A-FIX: selecting a stone, the first screen, and the chart's atmosphere.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CARD, HERO, TIP } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { LAYOUT, plotHeight, SCALE, yOf } from '../src/ui/svg/scale.ts';
import { chartSvg, enterAction, heroHtml } from '../src/ui/views/churchyard.ts';
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
    expect(main).toMatch(/classList\.toggle\('visually-hidden', route\.name === 'churchyard'\)/);
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
  it('GEO and perigee are explained in small text under the caption', () => {
    expect(HERO.caption.length).toBeLessThanOrEqual(110);
    expect(HERO.terms.join(' ')).toMatch(/GEO: the circular orbit about 35,786 km/);
    expect(HERO.terms.join(' ')).toMatch(/Perigee: the lowest point of an orbit/);
    expect(source).toContain('class="stage-terms"');
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
