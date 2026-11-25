// Redesign 2, steps 1 and 2: the design system (fonts, tokens, surfaces, atmosphere) and the chart story and tour.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { FILTERS, TOUR } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { HIGH_TICKS_KM, LAYOUT, SCALE, yOf } from '../src/ui/svg/scale.ts';
import { chartSvg, compactLegendHtml, heroHtml, retiredPayloads } from '../src/ui/views/churchyard.ts';
import { moveStep, rememberSkip, TOUR_KEY, tourHtml, tourSkipped, tourSteps } from '../src/ui/views/tour.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const config = real.config;
const cssDir = join(ROOT, 'src/ui/styles');
const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith('.css'));
describe('fonts', () => {
  const fonts = [
    ['ibm-plex-sans-latin-400.woff2', 'IBM Plex Sans', 400],
    ['ibm-plex-sans-latin-600.woff2', 'IBM Plex Sans', 600],
    ['ibm-plex-mono-latin-400.woff2', 'IBM Plex Mono', 400],
    ['ibm-plex-mono-latin-500.woff2', 'IBM Plex Mono', 500],
    ['im-fell-english-latin.woff2', 'IM Fell English', 400],
  ] as const;
  const tokens = strip(read('src/ui/styles/tokens.css'));
  it('are self-hosted woff2 files, declared with font-display: swap, and the files total under 200 KB', () => {
    let total = 0;
    for (const [file, family, weight] of fonts) {
      const path = join(ROOT, 'src/ui/fonts', file);
      expect(existsSync(path), file).toBe(true);
      total += statSync(path).size;
      const face = new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${family}';[^}]*font-weight:\\s*${weight};[^}]*font-display:\\s*swap;[^}]*${file}`).exec(tokens);
      expect(face, `${family} ${weight}`).not.toBeNull();
    }
    expect(total).toBeLessThan(200 * 1024);
    expect(tokens).not.toMatch(/https?:\/\//);
  });
  it('are recorded with their licence in THIRD_PARTY.md and docs/credits.md', () => {
    const third = read('THIRD_PARTY.md');
    const credits = read('docs/credits.md');
    for (const [file] of fonts) expect(third, file).toContain(file);
    expect(third).toContain('OFL-IBM-Plex.txt');
    expect(existsSync(join(ROOT, 'src/ui/fonts/OFL-IBM-Plex.txt'))).toBe(true);
    expect(credits).toMatch(/ibm-plex-mono-latin-500\.woff2[^\n]*[0-9a-f]{64}/);
  });
  it('preloads the two used above the fold', () => {
    const html = read('index.html');
    expect(html.match(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="[^"]+\.woff2"/g)).toHaveLength(2);
    expect(html).toContain('ibm-plex-sans-latin-400.woff2');
    expect(html).toContain('ibm-plex-mono-latin-400.woff2');
  });
  it('are used as the steering says: display, body, and mono for readings', () => {
    expect(tokens).toMatch(/--font-display:\s*'IM Fell English'/);
    expect(tokens).toMatch(/--font-body:\s*'IBM Plex Sans'/);
    expect(tokens).toMatch(/--font-mono:\s*'IBM Plex Mono'/);
    const steering = read('.kiro/steering/design.md');
    expect(steering).toContain('Display: IM Fell English (headings, headstone names). Body: IBM Plex Sans. Readings and labels: IBM Plex Mono with tabular figures');
    expect(steering).toContain('Repeated uses, such as table cells and chips, show the word only.');
  });
});
describe('tokens and surfaces', () => {
  const tokens = strip(read('src/ui/styles/tokens.css'));
  it('has the type scale 12 / 14 / 16 / 20 / 28 / 44 / 72 px and an 8 px grid', () => {
    const px = (name: string): number => Number(new RegExp(`--${name}:\\s*([\\d.]+)rem`).exec(tokens)![1]) * 16;
    expect(['fs-12', 'fs-14', 'fs-16', 'fs-20', 'fs-28', 'fs-44', 'fs-72'].map(px)).toEqual([12, 14, 16, 20, 28, 44, 72]);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(px(`space-${n}`) % 8, `space-${n}`).toBe(0);
  });
  it('has no corner radius above 2 px except pills', () => {
    for (const f of cssFiles) {
      for (const m of strip(read(`src/ui/styles/${f}`)).matchAll(/border-radius:\s*([^;]+);/g)) {
        expect(['0', 'var(--radius)', '999px', '1px', '2px', '50%'], `${f}: ${m[1]}`).toContain(m[1]!.trim());
      }
    }
    expect(tokens).toMatch(/--radius:\s*2px/);
  });
  it('raised panels have a soft shadow and no border', () => {
    const c = strip(read('src/ui/styles/churchyard.css'));
    const card = /\.card:has\(\.card-name\)\s*\{([^}]*)\}/.exec(c)![1]!;
    expect(card).toMatch(/box-shadow:/);
    expect(card).toMatch(/background:\s*var\(--surface-2\)/);
    expect(card).not.toMatch(/border(-color)?:\s*[^0]/);
    expect(/\.tip\s*\{([^}]*)\}/.exec(c)![1]).toMatch(/box-shadow:/);
  });
  it('draws the atmosphere behind the page: static grain at 3 to 5 per cent, a vignette and a light behind the hero', () => {
    const base = strip(read('src/ui/styles/base.css'));
    const before = /body::before\s*\{(\s*background:[^}]*)\}/.exec(base)![1]!;
    const after = /body::after\s*\{(\s*opacity:[^}]*)\}/.exec(base)![1]!;
    expect(/body::before,\s*body::after\s*\{([^}]*)\}/.exec(base)![1]).toMatch(/z-index:\s*-1/);
    expect(before).toContain('var(--hero-light)');
    expect(before).toContain('var(--vignette)');
    expect(after).toContain('feTurbulence');
    const opacity = Number(/opacity:\s*([0-9.]+)/.exec(after)![1]);
    expect(opacity).toBeGreaterThanOrEqual(0.03);
    expect(opacity).toBeLessThanOrEqual(0.05);
    expect(base).not.toMatch(/animation|transition/);
  });
  it('shows the header as a wordmark, a mono kicker and mono nav links with a hairline underline', () => {
    const base = strip(read('src/ui/styles/base.css'));
    expect(/\.site-tagline\s*\{([^}]*)\}/.exec(base)![1]).toMatch(/font-family:\s*var\(--font-mono\)[^}]*text-transform:\s*uppercase/);
    expect(/\.nav-list a\s*\{([^}]*)\}/.exec(base)![1]).toMatch(/font-family:\s*var\(--font-mono\)[^}]*text-transform:\s*uppercase/);
    expect(base).toMatch(/\.nav-list a\[aria-current='page'\]\s*\{[^}]*border-bottom:\s*1px solid var\(--bone\)/);
    expect(read('index.html')).toContain('Register of retired geostationary satellites');
  });
  it('sets the key reading at 72 px in mono, and the other two smaller', () => {
    const c = strip(read('src/ui/styles/churchyard.css'));
    expect(/\.tile--zone \.tile-figure\s*\{([^}]*)\}/.exec(c)![1]).toContain('font-size: var(--fs-72)');
    expect(/\.tile-figure\s*\{([^}]*)\}/.exec(c)![1]).toContain('font-family: var(--font-mono)');
    expect(c).toMatch(/\.tile--zone\s*\{[^}]*grid-row:\s*1/);
  });
});
describe('the chart: grey the mass, light the story', () => {
  const svg = chartSvg(real, false);
  const retired = retiredPayloads(real.records);
  it('draws the 36 story stones with a ring and every other stone quietly', () => {
    expect(svg.match(/stone-pos--ring/g)).toHaveLength(36);
    expect(svg.match(/stone-pos--quiet/g)).toHaveLength(retired.length - 36);
    expect(svg).not.toMatch(/stone-pos--quiet stone-pos--ring|stone-pos--ring stone-pos--quiet/);
    const css = strip(read('src/ui/styles/churchyard.css'));
    expect(css).toMatch(/\.stone-pos--quiet \.stone-body\s*\{[^}]*stroke:\s*var\(--moss\)/);
    expect(css).toMatch(/\.stone-body\s*\{[^}]*stroke:\s*var\(--bone\)/);
  });
  it('engraves the protected zone, hatches the threshold band, and labels the FCC line', () => {
    expect(svg).toContain('class="zone-label"');
    expect(svg).toContain('>Protected zone ±200 km</text>');
    expect(svg).toContain('<pattern id="wall-hatch"');
    expect(svg).toMatch(/class="band band--wall"/);
    expect(svg).toContain('>FCC rule · 18 Mar 2002</text>');
    const css = strip(read('src/ui/styles/churchyard.css'));
    expect(css).toMatch(/\.band--wall\s*\{[^}]*url\(#wall-hatch\)/);
    expect(css).toMatch(/\.zone-label\s*\{[^}]*text-transform:\s*uppercase/);
    expect(css).toMatch(/\.fcc-label\s*\{[^}]*font-family|\.fcc-label,[\s\S]*?letter-spacing/);
  });
  it('draws the axes as scales: a rule, marks, minor marks, mono labels, and no heavy grid', () => {
    expect(svg.match(/class="scale-line"/g)).toHaveLength(2);
    expect(svg.match(/class="scale-minor"/g)!.length).toBeGreaterThan(10);
    expect(svg.match(/class="scale-mark"/g)!.length).toBeGreaterThan(8);
    const css = strip(read('src/ui/styles/churchyard.css'));
    expect(css).toMatch(/\.tick,[\s\S]*?\{[^}]*fill:/);
    expect(/\.band-name,\s*\.tick,\s*\.axis-title,[\s\S]*?\{([^}]*)\}/.exec(css)![1]).toContain('font-family: var(--font-mono)');
    expect(/\.edge\s*\{([^}]*)\}/.exec(css)![1]).toMatch(/stroke-width:\s*0\.6/);
  });
  it('gives each legend word its meaning as a title, and keeps the word on its own', () => {
    const html = compactLegendHtml(config);
    expect(html).toContain('<li title="perigee below the IADC threshold">');
    expect(html).toContain('<span>Shallow grave</span>');
  });
});
describe('the guided tour', () => {
  const steps = tourSteps(real);
  it('has the four steps, in the words asked for, with figures that are already in the repository', () => {
    expect(steps.map((s) => s.text)).toEqual([
      'The road is the protected zone, ±200 km around GEO.',
      'The FCC rule covers satellites launched from 18 March 2002.',
      '36 of 131 launched since then sit in or near the zone.',
      'EchoStar 7: fined $150,000 by the FCC (DA 23-888). Perigee about 122 km against a planned 300 km.',
    ]);
    const doc = read('docs/methodology.md');
    for (const f of ['DA 23-888', '$150,000', '122 km', '300 km']) expect(doc, f).toContain(f);
    expect(steps[3]!.select).toBe(27378);
    expect(steps[3]!.sub).toBe("Sexton's own reading from the snapshot: +110.1 km above GEO.");
    expect(steps.slice(0, 3).map((s) => s.select)).toEqual([null, null, null]);
  });
  it('says what is voluntary and who the rule covers, and states no judgement', () => {
    expect(steps[1]!.sub).toContain('The IADC guidelines are voluntary.');
    expect(steps[1]!.sub).toContain('applies only to satellites the FCC authorizes');
    for (const s of steps) expect(findHits(`${s.text} ${s.sub}`, 'tour')).toEqual([]);
    expect(TOUR.start).toBe('Take the tour');
  });
  it('moves one step at a time, and ends at either end (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: -2, max: 10 }), fc.constantFrom(1 as const, -1 as const), (n, i, dir) => {
        const next = moveStep(i, dir, n);
        const inside = i + dir >= 0 && i + dir < n;
        expect(next === null).toBe(!inside);
        if (next !== null) expect(Math.abs(next - i)).toBe(1);
      }),
    );
  });
  it('is announced in a live region, keyboard operable with real buttons, and skippable', () => {
    const html = tourHtml(0, steps);
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain('Step 1 of 4.');
    expect(html).toContain('<button type="button" class="button" data-tour="back" disabled>');
    expect(html).toContain('data-tour="next"');
    expect(html).toContain('data-tour="skip"');
    expect(html).toContain('>1 / 4</p>');
    expect(tourHtml(3, steps)).toContain('data-tour="done">Explore freely</button>');
    expect(tourHtml(null, steps)).toContain('data-tour-start>Take the tour</button>');
    expect(html.match(/<button/g)).toHaveLength(3);
  });
  it('remembers a skip, and never throws when storage is blocked', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(tourSkipped(store)).toBe(false);
    rememberSkip(store);
    expect(mem.get(TOUR_KEY)).toBe('skipped');
    expect(tourSkipped(store)).toBe(true);
    const blocked = {
      getItem: (): never => {
        throw new Error('blocked');
      },
      setItem: (): never => {
        throw new Error('blocked');
      },
    };
    expect(() => rememberSkip(blocked)).not.toThrow();
    expect(tourSkipped(blocked)).toBe(false);
    expect(tourSkipped(null)).toBe(false);
  });
  it('lights each step with styles that need no motion: any transition sits inside no-preference', () => {
    const css = strip(read('src/ui/styles/churchyard.css'));
    for (const n of [1, 2, 3, 4]) expect(css).toContain(`.plot[data-tour='${n}']`);
    expect(css.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?\n\}\n/g, '')).not.toMatch(/transition|animation/);
  });
});
describe('fixes after the first look', () => {
  const css = strip(read('src/ui/styles/churchyard.css'));
  it('a selected stone is lit at full strength in bone with the amber selection ring, even when it is quiet', () => {
    expect(css).toMatch(/\.stone-link\.selected \.stone-body\s*\{[^}]*stroke:\s*var\(--bone\)[^}]*stroke-width/);
    expect(css).toMatch(/\.stone-link\.selected \.hit\s*\{[^}]*stroke:\s*var\(--lantern\)/);
    // More specific than the tour's dimming of quiet stones, so step 4 cannot dim the selected one.
    expect(css).toMatch(/\.plot \.stone-link\.selected \.stone-pos--quiet\s*\{\s*opacity:\s*1/);
    expect(css).toMatch(/\.stone-link\.selected \.stone-pos--quiet \.crack/);
  });
  it('the toolbar has no truncated count; the count is in the fine print and still announced', () => {
    const src = read('src/ui/views/churchyard.ts');
    expect(src).toContain('<p class="status visually-hidden" id="chart-status" role="status">');
    expect(FILTERS.drawnShort(696)).toBe('696 retired payloads drawn; others are in the table');
    const html = heroHtml(real);
    expect(html).toContain('<li id="fine-drawn">696 retired payloads drawn; others are in the table</li>');
    expect(html.indexOf('fine-drawn')).toBeLessThan(html.indexOf('C_R·A/m 0.012'));
    expect(css).not.toMatch(/\.toolbar \.status\s*\{[^}]*text-overflow/);
  });
  it('the tour bar has the skip as a small text link under the step, and on a phone one row of count, Back and Next', () => {
    const html = tourHtml(0, tourSteps(real));
    expect(html.indexOf('class="tour-text"')).toBeLessThan(html.indexOf('data-tour="skip"'));
    expect(html).toMatch(/<button type="button" class="link-button" data-tour="skip">Skip the tour<\/button>/);
    expect(html.indexOf('data-tour="skip"')).toBeLessThan(html.indexOf('class="tour-actions"'));
    expect(css).toMatch(/grid-template-areas:\s*'count actions' 'main main'/);
    expect(css).toMatch(/\.tour-actions\s*\{\s*justify-content:\s*flex-end/);
    expect(css).toMatch(/\.link-button\s*\{[^}]*text-decoration:\s*underline/);
  });
  it('keeps the 0 to +400 km range as it was and brings the 0 km line up, by shortening the high ground only', () => {
    expect(SCALE.pxPerKm).toBe(0.8);
    expect(SCALE.linearMaxKm - 0).toBe(400);
    expect(SCALE.highPx).toBeLessThanOrEqual(80);
    expect(LAYOUT.top).toBeLessThanOrEqual(30);
    expect(yOf(0)).toBeLessThanOrEqual(480);
    // The high-ground tick labels still do not touch: at least 10 units between neighbours.
    const ys = [SCALE.linearMaxKm, ...HIGH_TICKS_KM].map(yOf);
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1]! - ys[i]!).toBeGreaterThanOrEqual(10);
  });
  it('folds GEO and perigee into the caption, and puts the glossary in the first tour step', () => {
    expect(tourSteps(real)[0]!.sub).toBe('GEO: the circular orbit about 35,786 km above the equator. Perigee: the lowest point of an orbit.');
    expect(read('src/ui/views/churchyard.ts')).not.toContain('stage-terms');
  });
});
