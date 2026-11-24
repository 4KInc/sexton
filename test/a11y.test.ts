// Task 17: accessibility checks that can run without a browser. Colour contrast is computed from
// tokens.css, so a changed colour fails here. Screen readers, a real phone and the look of
// the focus ring still need a person (see the Task 17 note in the journal).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NAV, PAGE_TITLES, VERDICT_ORDER, verdictCopy } from '../src/ui/copy.ts';
import { methodHtml } from '../src/ui/views/method.ts';
import { parseHash } from '../src/ui/router.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { stoneBody } from '../src/ui/svg/headstone.ts';
import { cardHtml, chartSvg, introHtml as churchyardIntro, legendHtml, retiredPayloads } from '../src/ui/views/churchyard.ts';
import { censusHtml } from '../src/ui/views/census.ts';
import { filtersHtml } from '../src/ui/views/filters.ts';
import { ledgerPageHtml } from '../src/ui/views/ledger.ts';
import { introHtml as tableIntro, rowHtml, tableHtml, verdictKeyHtml } from '../src/ui/views/table.ts';
import { NO_FILTERS } from '../src/ui/state.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const config = real.config;

// ---- Contrast, from tokens.css -------------------------------------------------------------

type Rgb = [number, number, number];
const tokensCss = read('src/ui/styles/tokens.css');
function token(name: string): Rgb {
  const m = new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})\\s*;`).exec(tokensCss);
  if (m === null) throw new Error(`tokens.css has no --${name} hex colour`);
  const hex = m[1]!;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}
const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function ratio(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** `top` drawn at `alpha` over `under`, as the browser composites it. */
const over = (top: Rgb, under: Rgb, alpha: number): Rgb => top.map((v, i) => v * alpha + under[i]! * (1 - alpha)) as Rgb;

const ground = token('ground');
const road = token('road');
const stone = token('stone');
/** Every surface text or a graphic can sit on, on screen. The two compositions are the band fills in churchyard.css. */
const SURFACES: [string, Rgb][] = [
  ['ground', ground],
  ['road', road],
  ['stone', stone],
  ['shallow band (stone at 0.8 over ground)', over(stone, ground, 0.8)],
  ['consecrated band (bone at 0.07 over ground)', over(token('bone'), ground, 0.07)],
  ['wall gradient, top (stone at 0.1 over ground)', over(stone, ground, 0.1)],
  // Atmosphere around the chart (redesign): the sky behind the page, the panels, the active nav segment.
  ['sky-top', token('sky-top')],
  ['sky-glow (the brightest part of the page background)', token('sky-glow')],
  ['panel', token('panel')],
  ['moss-deep (the active nav segment)', token('moss-deep')],
];
/** Text colours (WCAG AA, 4.5:1). `moss` is only used as a fill, but is held to the text level too. */
const TEXT = ['bone', 'bone-muted', 'moss'];
/** Graphics and focus (WCAG 1.4.11, 3:1). */
const GRAPHIC = ['lantern', 'bone-muted', 'bone'];

describe('colour contrast from tokens.css', () => {
  it('prints the table', () => {
    // Visible with `vitest run --reporter verbose`; the assertions below are the gate.
    const lines: string[] = [];
    for (const fg of [...TEXT, 'lantern']) for (const [name, bg] of SURFACES) lines.push(`${fg} on ${name}: ${ratio(token(fg), bg).toFixed(2)}`);
    lines.push(`ink on paper: ${ratio(token('ink'), token('paper')).toFixed(2)}`, `ink-muted on paper: ${ratio(token('ink-muted'), token('paper')).toFixed(2)}`);
    expect(lines.length).toBeGreaterThan(10);
  });
  for (const fg of TEXT) {
    for (const [name, bg] of SURFACES) {
      it(`screen text: ${fg} on ${name} is at least 4.5:1`, () => {
        expect(ratio(token(fg), bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const fg of GRAPHIC) {
    for (const [name, bg] of SURFACES) {
      it(`screen graphics and focus: ${fg} on ${name} is at least 3:1`, () => {
        expect(ratio(token(fg), bg)).toBeGreaterThanOrEqual(3);
      });
    }
  }
  it('print theme: ink and ink-muted on paper are at least 4.5:1', () => {
    expect(ratio(token('ink'), token('paper'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token('ink-muted'), token('paper'))).toBeGreaterThanOrEqual(4.5);
  });
  it('the contrast function matches known values', () => {
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(ratio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    // The design's own table (5.3): bone on ground 14.0, bone-muted on stone 5.6.
    expect(ratio(token('bone'), ground)).toBeCloseTo(14.04, 1);
    expect(ratio(token('bone-muted'), stone)).toBeCloseTo(5.6, 1);
  });
});

// ---- The stylesheets -----------------------------------------------------------------------

const cssDir = join(ROOT, 'src/ui/styles');
const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith('.css'));
const css = (f: string): string => readFileSync(join(cssDir, f), 'utf8');
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
/** Removes `@media (...) { ... }` blocks whose header matches `header`, with balanced braces. */
function withoutMedia(text: string, header: RegExp): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const m = /@media[^{]*\{/.exec(rest);
    if (m === null) {
      out += rest;
      break;
    }
    out += rest.slice(0, m.index);
    let depth = 1;
    let j = i + m.index + m[0].length;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      if (text[j] === '}') depth--;
      j++;
    }
    if (!header.test(m[0])) out += text.slice(i + m.index, j);
    i = j;
  }
  return out;
}

describe('stylesheets', () => {
  it('no colour is written outside tokens.css', () => {
    for (const f of cssFiles.filter((x) => x !== 'tokens.css')) {
      expect(stripComments(css(f)), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    }
    // And the source that draws the SVG uses classes, not colours.
    for (const f of ['svg/headstone.ts', 'svg/bands.ts', 'views/churchyard.ts']) {
      expect(read(`src/ui/${f}`), f).not.toMatch(/(fill|stroke)="#/);
    }
  });
  it('every var(--x) is defined in tokens.css', () => {
    // The two sway variables are set per stone in a style attribute (svg/headstone.ts and views/churchyard.ts).
    const defined = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).concat(['--sway-angle', '--sway-delay']));
    for (const f of cssFiles) {
      for (const m of stripComments(css(f)).matchAll(/var\((--[\w-]+)/g)) expect(defined.has(m[1]!), `${f}: ${m[1]}`).toBe(true);
    }
  });
  it('text on screen uses only bone or bone-muted, and in print only ink or ink-muted', () => {
    for (const f of cssFiles) {
      const text = stripComments(css(f));
      const screen = f === 'print.css' ? '' : withoutMedia(text, /print/);
      const print = f === 'print.css' ? text : [...text.matchAll(/@media print\s*\{([\s\S]*)\}/g)].map((m) => m[1]).join('');
      for (const m of screen.matchAll(/(?<![-\w])color:\s*var\(--([\w-]+)\)/g)) expect(['bone', 'bone-muted'], `${f} color: ${m[1]}`).toContain(m[1]);
      for (const m of print.matchAll(/(?<![-\w])color:\s*var\(--([\w-]+)\)/g)) expect(['ink', 'ink-muted', 'bone', 'bone-muted'].includes(m[1]!), `${f} print color: ${m[1]}`).toBe(true);
    }
  });
  it('lantern amber is used only for focus and selection: outline, stroke and border-color', () => {
    for (const f of cssFiles) {
      for (const m of stripComments(css(f)).matchAll(/([\w-]+):\s*[^;{}]*var\(--lantern\)/g)) {
        expect(['outline', 'stroke', 'border-color'], `${f}: ${m[1]}`).toContain(m[1]);
      }
    }
  });
  it('every focusable thing gets the lantern ring from one rule', () => {
    const base = stripComments(css('base.css'));
    const rule = /:focus-visible\s*\{([^}]*)\}/.exec(base);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/outline:\s*(\d+)px solid var\(--lantern\)/);
    expect(Number(/outline:\s*(\d+)px/.exec(rule![1]!)![1])).toBeGreaterThanOrEqual(2);
  });
  it('outline is removed on one selector only, the SVG stone link, which draws its own ring on its hit area', () => {
    const off: string[] = [];
    for (const f of cssFiles) {
      for (const m of stripComments(css(f)).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (/outline(-style)?:\s*(none|0)\b/.test(m[2]!)) off.push(`${f}: ${m[1]!.trim()}`);
      }
    }
    // The page heading takes focus after a route change for screen readers; it is not a control, so it draws no ring.
    expect(off).toEqual(["base.css: h1[tabindex='-1']:focus", 'churchyard.css: .stone-link']);
    const churchyard = stripComments(css('churchyard.css'));
    expect(churchyard).toMatch(/\.stone-link:focus-visible \.hit\s*\{[^}]*stroke:\s*var\(--lantern\)/);
  });
  it('the skip link is hidden until it has focus, and then appears on screen', () => {
    const base = stripComments(css('base.css'));
    expect(base).toMatch(/\.skip-link\s*\{[^}]*top:\s*-\d/);
    expect(base).toMatch(/\.skip-link:focus\s*\{[^}]*top:\s*var\(--space-2\)/);
  });
  it('all motion is inside prefers-reduced-motion: no-preference', () => {
    let found = 0;
    for (const f of cssFiles) {
      const text = stripComments(css(f));
      const rest = withoutMedia(text, /prefers-reduced-motion:\s*no-preference/);
      expect(rest, `${f} has motion outside the media query`).not.toMatch(/(?<![-\w])(animation|transition)(-[\w-]+)?\s*:/);
      expect(rest, f).not.toMatch(/scroll-behavior:\s*smooth/);
      if (/prefers-reduced-motion:\s*no-preference/.test(text)) found++;
    }
    expect(found).toBeGreaterThan(0);
  });
  it('a swaying stone is still drawn at its angle when motion is off', () => {
    const churchyard = stripComments(css('churchyard.css'));
    expect(churchyard).toMatch(/\.sway\s*\{[^}]*transform:\s*rotate\(var\(--sway-angle\)\)/);
  });
  it('text size is in the user\u2019s hands: the root size is a percentage and page overflow is never hidden', () => {
    const base = stripComments(css('base.css'));
    expect(base).toMatch(/html\s*\{[^}]*font-size:\s*100%/);
    for (const f of cssFiles) {
      expect(stripComments(css(f)), f).not.toMatch(/(html|body)\s*\{[^}]*overflow(-x)?:\s*hidden/);
    }
  });
  it('wide things scroll inside their own box: tables, the phone chart, code blocks', () => {
    expect(stripComments(css('table.css'))).toMatch(/\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
    expect(stripComments(css('churchyard.css'))).toMatch(/\.chart-wrap--scroll\s*\{[^}]*overflow-x:\s*auto/);
    expect(stripComments(css('method.css'))).toMatch(/\.method pre\s*\{[^}]*overflow-x:\s*auto/);
  });
  it('long source addresses and hashes in the ledger wrap, so a 320 px screen does not scroll sideways', () => {
    expect(stripComments(css('ledger.css'))).toMatch(/\.ledger\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});

// ---- The page shell ------------------------------------------------------------------------

describe('index.html', () => {
  const html = read('index.html');
  it('has a language, a title and a viewport that allows zoom', () => {
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    const viewport = /<meta name="viewport" content="([^"]*)"/.exec(html);
    expect(viewport![1]).toContain('width=device-width');
    expect(viewport![1]).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale/);
  });
  it('the skip link is the first focusable thing and points at main', () => {
    const body = html.slice(html.indexOf('<body>'));
    const firstFocusable = /<(a|button|input|select|textarea)\b[^>]*>/.exec(body);
    expect(firstFocusable![0]).toContain('class="skip-link"');
    expect(firstFocusable![0]).toContain('href="#main"');
    expect(html).toMatch(/<main id="main" tabindex="-1">/);
  });
  it('has a header, a labelled nav and one main', () => {
    expect(html).toMatch(/<header\b/);
    expect(html).toMatch(/<nav aria-label="[^"]+">/);
    expect(html.match(/<main\b/g)).toHaveLength(1);
  });
  it('main.ts sets the title and moves focus to the page heading after a route change', () => {
    const main = read('src/ui/main.ts');
    expect(main).toMatch(/document\.title = /);
    expect(main).toMatch(/el\('page-title'\)\.focus\(/);
    expect(main).toMatch(/<h1 id="page-title" tabindex="-1">/);
  });
});

describe('page titles', () => {
  it('every route has its own non-empty title', () => {
    const titles = Object.values(PAGE_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) expect(t.trim()).not.toBe('');
  });
  it('each nav link goes to a route whose title is the link text', () => {
    for (const item of NAV) {
      const route = parseHash(item.href);
      expect(route.name).toBe(item.route);
      expect(PAGE_TITLES[route.name]).toBe(item.label);
    }
  });
});

// ---- Headings, landmarks and labels, per view ----------------------------------------------

const retired = retiredPayloads(real.records);
const withCase = retired.find((r) => r.norad === 40258)!;
const plain = retired.find((r) => r.norad === 27378) ?? retired[0]!;
const bones = real.records.find((r) => r.verdict.kind === 'unmarked bones');
const h1 = (text: string): string => `<h1 id="page-title" tabindex="-1">${text}</h1>`;

/** Each view as the router builds it: the h1 from main.ts, then the view's own HTML. */
const PAGES: Record<string, string> = {
  churchyard:
    h1('Churchyard') +
    churchyardIntro(real) +
    filtersHtml(real.records, NO_FILTERS, config, true) +
    chartSvg(real, false, plain.norad) +
    cardHtml(plain, config) +
    legendHtml(config),
  'churchyard, phone width': h1('Churchyard') + churchyardIntro(real) + filtersHtml(real.records, NO_FILTERS, config, false) + chartSvg(real, true) + cardHtml(undefined, config) + legendHtml(config),
  table: h1('Table') + tableIntro(config) + filtersHtml(real.records, NO_FILTERS, config, true) + verdictKeyHtml(config) + tableHtml(real.records.slice(0, 40), config, { key: 'norad', dir: 'asc' }),
  census: h1('Census') + censusHtml(real),
  method: h1('Method') + methodHtml(),
  'ledger with a case file': h1('Ledger: NORAD 40258') + ledgerPageHtml(real, withCase.norad),
  'ledger without a case file': h1('Ledger: NORAD 27378') + ledgerPageHtml(real, plain.norad),
  'ledger of an unmarked-bones object': h1('Ledger: NORAD 1') + (bones === undefined ? '' : ledgerPageHtml(real, bones.norad)),
  'object that is not in the register': h1('Ledger: NORAD 1') + ledgerPageHtml(real, 999999999),
};

const levelsOf = (html: string): number[] => [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));

describe('heading order', () => {
  for (const [name, html] of Object.entries(PAGES)) {
    it(`${name}: one h1, first, and no level is skipped going down`, () => {
      const levels = levelsOf(html);
      expect(levels[0]).toBe(1);
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      levels.forEach((level, i) => {
        if (i > 0) expect(level, `h${level} after h${levels[i - 1]}`).toBeLessThanOrEqual(levels[i - 1]! + 1);
      });
    });
  }
  it('the case file headings sit below the case title, so the ledger stays in order', () => {
    const levels = levelsOf(PAGES['ledger with a case file']!);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...levels)).toBeLessThanOrEqual(6);
  });
  it('no empty heading', () => {
    for (const [name, html] of Object.entries(PAGES)) {
      for (const m of html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)) expect(m[1]!.replace(/<[^>]*>/g, '').trim(), name).not.toBe('');
    }
  });
});

const ids = (html: string): string[] => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
const attr = (tag: string, name: string): string | null => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

describe('labels and landmarks', () => {
  for (const [name, html] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has no repeated id', () => {
        const all = ids(html);
        expect(all.filter((id, i) => all.indexOf(id) !== i)).toEqual([]);
      });
      it('every aria-labelledby, aria-describedby and label-for points at an id on the page', () => {
        const all = new Set(ids(html));
        for (const m of html.matchAll(/\saria-(?:labelledby|describedby)="([^"]+)"/g)) for (const id of m[1]!.split(/\s+/)) expect(all.has(id), id).toBe(true);
        for (const m of html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)) expect(all.has(m[1]!), `label for ${m[1]}`).toBe(true);
      });
      it('every form control has a label', () => {
        for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
          const id = attr(m[0], 'id');
          const labelled = id !== null && new RegExp(`<label\\b[^>]*\\sfor="${id}"`).test(html);
          expect(labelled || attr(m[0], 'aria-label') !== null, m[0]).toBe(true);
        }
        for (const m of html.matchAll(/<form\b[^>]*>/g)) expect(attr(m[0], 'aria-label') ?? attr(m[0], 'aria-labelledby'), 'form name').not.toBeNull();
      });
      it('every button has text, and every link has text or a label', () => {
        for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) expect(m[1]!.replace(/<[^>]*>/g, '').trim(), m[0]).not.toBe('');
        for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
          const named = m[2]!.replace(/<[^>]*>/g, '').trim() !== '' || / aria-label="[^"]+"/.test(m[1]!);
          expect(named, m[0].slice(0, 120)).toBe(true);
        }
      });
      it('every scroll region is named and reachable by keyboard', () => {
        for (const m of html.matchAll(/<div\b[^>]*role="region"[^>]*>/g)) {
          expect(attr(m[0], 'aria-label'), m[0]).not.toBeNull();
          if (/table-wrap/.test(m[0])) expect(attr(m[0], 'tabindex'), m[0]).toBe('0');
        }
      });
      it('every table has a caption or sits in a named region, and its column headers have scope', () => {
        for (const m of html.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
          const before = html.slice(Math.max(0, m.index! - 400), m.index!);
          const region = /<div[^>]*role="region"[^>]*aria-label="[^"]+"[^>]*>\s*$/.test(before);
          expect(/<caption>/.test(m[0]) || region, m[0].slice(0, 100)).toBe(true);
          for (const th of m[0].matchAll(/<th\b[^>]*>/g)) expect(attr(th[0], 'scope'), th[0]).toMatch(/^(col|row)$/);
        }
      });
      it('every svg is named, or hidden from screen readers', () => {
        for (const m of html.matchAll(/<svg\b[^>]*>/g)) {
          const named = attr(m[0], 'aria-hidden') === 'true' || attr(m[0], 'aria-label') !== null || attr(m[0], 'aria-labelledby') !== null;
          expect(named, m[0].slice(0, 120)).toBe(true);
        }
      });
      it('has no tabindex above 0, and no link that opens a new window without saying so', () => {
        for (const m of html.matchAll(/\stabindex="(-?\d+)"/g)) expect(Number(m[1])).toBeLessThanOrEqual(0);
        expect(html).not.toMatch(/target="_blank"/);
      });
    });
  }
  it('the filter form is a labelled form with a labelled fieldset for the verdicts', () => {
    const html = filtersHtml(real.records, NO_FILTERS, config, true);
    expect(html).toMatch(/<form[^>]*aria-label="[^"]+"/);
    expect(html).toMatch(/<fieldset[^>]*><legend>[^<]+<\/legend>/);
    expect(html).toMatch(/<summary>[^<]+<\/summary>/);
  });
  it('the sort buttons are real buttons inside column headers, and the sorted column says which way', () => {
    const html = tableHtml(real.records.slice(0, 5), config, { key: 'norad', dir: 'desc' });
    expect(html).toMatch(/<th scope="col" aria-sort="descending"><button type="button" class="sort"/);
    expect(html.match(/aria-sort=/g)).toHaveLength(1);
  });
  it('the live regions that announce counts and the selected stone are present', () => {
    expect(read('src/ui/views/churchyard.ts')).toMatch(/id="chart-status" role="status"/);
    expect(read('src/ui/views/churchyard.ts')).toMatch(/id="stone-card" aria-live="polite"/);
    expect(read('src/ui/views/table.ts')).toMatch(/id="table-status" role="status"/);
  });
});

describe('the churchyard drawing', () => {
  const svg = chartSvg(real, false, null);
  it('is a named group with a title and a description', () => {
    expect(svg).toMatch(/<svg[^>]*role="group"[^>]*aria-labelledby="chart-title chart-desc"/);
    expect(svg).toMatch(/<title id="chart-title">[^<]+<\/title>/);
    expect(svg).toMatch(/<desc id="chart-desc">[^<]+<\/desc>/);
  });
  it('every stone is a link with a spoken label that carries the name, the verdict word and the perigee', () => {
    const links = [...svg.matchAll(/<a class="stone-link[^"]*"[^>]*>/g)];
    expect(links).toHaveLength(retired.length);
    for (const m of links) {
      const label = attr(m[0], 'aria-label') ?? '';
      expect(label, m[0]).toMatch(/perigee/);
      expect(VERDICT_ORDER.some((v) => label.includes(`, ${v},`)), label).toBe(true);
      expect(attr(m[0], 'href')).toMatch(/^#\/sat\/\d+$/);
    }
  });
  it('the decoration is hidden from screen readers, and the stones are not', () => {
    expect(svg).toMatch(/<g aria-hidden="true">/);
    const hidden = svg.slice(svg.indexOf('<g aria-hidden="true">'), svg.indexOf('</g>', svg.indexOf('fcc-label')));
    expect(hidden).not.toContain('stone-link');
  });
  it('exactly one stone is in the Tab order', () => {
    expect([...svg.matchAll(/<a class="stone-link[^"]*"[^>]*tabindex="0"/g)]).toHaveLength(1);
    expect([...svg.matchAll(/<a class="stone-link[^"]*"[^>]*tabindex="-1"/g)]).toHaveLength(retired.length - 1);
  });
  it('the legend glyphs are hidden from screen readers, because the words beside them say the same', () => {
    const legend = legendHtml(config);
    for (const m of legend.matchAll(/<svg\b[^>]*>/g)) expect(m[0]).toContain('aria-hidden="true"');
    for (const v of VERDICT_ORDER) expect(legend).toContain(verdictCopy(v, config).pair.replace(/&/g, '&amp;'));
  });
});

describe('verdicts are never shown by colour alone', () => {
  const shape = (verdict: (typeof VERDICT_ORDER)[number]): string => stoneBody({ verdict, moss: 0 });
  it('each verdict has its own shape, and the shapes differ without any colour', () => {
    const shapes = VERDICT_ORDER.map(shape);
    expect(new Set(shapes).size).toBe(VERDICT_ORDER.length);
    for (const s of shapes) expect(s).not.toMatch(/fill="|stroke="|style="/);
  });
  it('no style rule gives one verdict its own colour', () => {
    for (const f of cssFiles) {
      for (const m of stripComments(css(f)).matchAll(/([^{}]*\.stone--[\w-]+[^{}]*)\{([^}]*)\}/g)) {
        const decls = m[2]!.split(';').map((d) => d.trim()).filter((d) => d !== '');
        for (const d of decls) expect(d, `${f}: ${m[1]!.trim()}`).toMatch(/^fill:\s*none$/);
      }
    }
  });
  it('the table, the card, the ledger and the stone label all say the verdict in words', () => {
    for (const r of [plain, withCase]) {
      const word = r.verdict.verdict;
      expect(rowHtml(r, config)).toContain(verdictCopy(word, config).word);
      // The card is a badge: the word large, the meaning under it. Both are in the card's text.
      expect(cardHtml(r, config)).toContain(`<span class="badge-word">${verdictCopy(word, config).word}</span>`);
      expect(cardHtml(r, config)).toContain(`<span class="badge-meaning">${verdictCopy(word, config).meaning.replace(/&/g, '&amp;')}</span>`);
      expect(ledgerPageHtml(real, r.norad)).toContain(verdictCopy(word, config).pair.replace(/&/g, '&amp;'));
      expect(chartSvg(real, false, null)).toContain(`${r.name.replace(/&/g, '&amp;')}, ${word},`);
    }
  });
  it('the borderline mark is a whisker line and a word, not a colour', () => {
    expect(chartSvg(real, false, null)).toMatch(/<g class="whisker">/);
    expect(cardHtml(retired.find((r) => r.verdict.borderline)!, config)).toMatch(/Borderline/);
  });
  it('the sorted column and the selected stone are marked by more than colour', () => {
    expect(stripComments(css('table.css'))).toMatch(/aria-sort='ascending'\] \.sort::after\s*\{\s*content/);
    expect(stripComments(css('churchyard.css'))).toMatch(/\.stone-link\.selected \.stone-body\s*\{[^}]*stroke-width/);
    // The current nav segment is filled, has its own border and is bolder, so it is not marked by colour alone.
    expect(stripComments(css('base.css'))).toMatch(/\[aria-current='page'\]\s*\{[^}]*border-color[^}]*font-weight/);
  });
});

describe('polish step 3: faint stones and the tooltip', () => {
  const alpha = Number(/\.stone-pos--early\s*\{\s*opacity:\s*([0-9.]+)/.exec(read('src/ui/styles/churchyard.css'))?.[1]);
  it('a faint stone keeps 3:1 against the ground for its outline and its moss', () => {
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
    for (const name of ['bone', 'moss']) {
      expect(ratio(over(token(name), token('ground'), alpha), token('ground')), `${name} at ${alpha}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('the tooltip text has 4.5:1 on the tooltip background', () => {
    for (const name of ['bone', 'bone-muted']) expect(ratio(token(name), token('stone')), name).toBeGreaterThanOrEqual(4.5);
  });
  it('the tooltip and the ring use tokens only, and nothing in the tooltip moves', () => {
    const rule = (sel: string): string => new RegExp(`${sel.replace('.', '\\.')}\\s*\\{[^}]*\\}`).exec(read('src/ui/styles/churchyard.css'))![0];
    for (const sel of ['.tip', '.flag-ring', '.stone-name']) expect(rule(sel), sel).not.toMatch(/#[0-9a-fA-F]{3,6}|rgb\(/);
    expect(rule('.tip')).not.toMatch(/transition|animation/);
  });
});
