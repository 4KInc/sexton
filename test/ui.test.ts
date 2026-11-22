import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { CONFIG } from '../src/engine/config.ts';
import { registerText } from '../scripts/register-source.ts';
import { assumptionsLine, bandCopy, dataAge, verdictCopy } from '../src/ui/copy.ts';
import { formatP, formatSigned, spokenKm } from '../src/ui/format.ts';
import { esc, withSansDigits } from '../src/ui/html.ts';
import { isRegister } from '../src/ui/register.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { navRouteOf, parseHash } from '../src/ui/router.ts';
import { bandsOf } from '../src/ui/svg/bands.ts';
import { buildColumns, laneOf, LAYOUT, mossStep, offScale, plotHeight, SCALE, swayAngle, yearFraction, yOf } from '../src/ui/svg/scale.ts';
import { cardHtml, chartSvg, legendHtml, retiredPayloads } from '../src/ui/views/churchyard.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const fixture = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/register.json'), 'utf8')) as UiRegister;
const EDGES = [200, 247, 280];

describe('router', () => {
  it('reads the five routes', () => {
    expect(parseHash('').name).toBe('churchyard');
    expect(parseHash('#/').name).toBe('churchyard');
    expect(parseHash('#').name).toBe('churchyard');
    expect(parseHash('#/table').name).toBe('table');
    expect(parseHash('#/census').name).toBe('census');
    expect(parseHash('#/method').name).toBe('method');
    expect(parseHash('#/sat/27378')).toMatchObject({ name: 'sat', norad: 27378 });
  });
  it('keeps the query', () => {
    const r = parseHash('#/?verdict=buried&owner=US&q=intelsat');
    expect(r.name).toBe('churchyard');
    expect(r.query.get('verdict')).toBe('buried');
    expect(r.query.get('q')).toBe('intelsat');
    expect(parseHash('#/table?era=before').query.get('era')).toBe('before');
  });
  it('anything else is not found', () => {
    for (const h of ['#/nope', '#/sat', '#/sat/abc', '#/sat/0', '#/sat/12/3', '#/table/x', '#main', '#/sat/99999999999999999999']) {
      expect(parseHash(h).name, h).toBe('notfound');
    }
  });
  it('property: never throws', () => {
    fc.assert(fc.property(fc.string(), (s) => typeof parseHash(s).name === 'string'));
    fc.assert(fc.property(fc.string(), (s) => typeof parseHash('#/' + s).name === 'string'));
  });
  it('a ledger belongs to the table in the nav', () => {
    expect(navRouteOf(parseHash('#/sat/5'))).toBe('table');
    expect(navRouteOf(parseHash('#/'))).toBe('churchyard');
  });
});

describe('number formatting', () => {
  it('uses a real minus sign and a plus sign', () => {
    expect(formatSigned(110.44, 1)).toBe('+110.4');
    expect(formatSigned(-89.6, 1)).toBe('\u221289.6');
    expect(formatSigned(0, 1)).toBe('0.0');
    expect(formatSigned(-0.04, 1)).toBe('0.0');
    expect(formatSigned(1914, 0)).toBe('+1,914');
    expect(formatSigned(-2000, 0)).toBe('\u22122,000');
  });
  it('GP is shown to 0.1 km, SATCAT to whole km', () => {
    expect(formatP(110.44, 'GP', EDGES)).toBe('+110.4');
    expect(formatP(404, 'SATCAT', EDGES)).toBe('+404');
  });
  it('rounding never puts the shown value on or across a band edge (199.96, 246.96)', () => {
    expect(formatP(199.96, 'GP', EDGES)).toBe('+199.96');
    expect(formatP(246.96, 'GP', EDGES)).toBe('+246.96');
    expect(formatP(200.04, 'GP', EDGES)).toBe('+200.04');
    expect(formatP(279.97, 'GP', EDGES)).toBe('+279.97');
    expect(formatP(199.94, 'GP', EDGES)).toBe('+199.9');
    expect(formatP(200, 'GP', EDGES)).toBe('+200.0');
  });
  it('property: the shown value is on the same side of every edge as the true value', () => {
    fc.assert(
      fc.property(fc.double({ min: -400, max: 600, noNaN: true }), (p) => {
        const shown = Number(formatP(p, 'GP', EDGES).replace('\u2212', '-'));
        return EDGES.every((e) => Math.sign(p - e) === Math.sign(shown - e) || p === e);
      }),
    );
  });
  it('spoken text', () => {
    expect(spokenKm('+110.4')).toBe('plus 110.4');
    expect(spokenKm('\u221289.6')).toBe('minus 89.6');
  });
});

describe('scale', () => {
  it('maps p to y inside the plot and clamps off-scale values', () => {
    expect(yOf(SCALE.maxKm)).toBe(LAYOUT.top);
    expect(yOf(SCALE.minKm)).toBe(LAYOUT.top + plotHeight());
    expect(yOf(5000)).toBe(LAYOUT.top);
    expect(yOf(-5000)).toBe(LAYOUT.top + plotHeight());
    expect(yOf(100)).toBeLessThan(yOf(0));
  });
  it('the range covers −200 to +400 with room to spare', () => {
    expect(SCALE.minKm).toBeLessThan(-200);
    expect(SCALE.maxKm).toBeGreaterThan(400);
  });
  it('off-scale only outside the drawn range', () => {
    expect(offScale(450)).toBeNull();
    expect(offScale(450.1)).toBe('above');
    expect(offScale(-300)).toBeNull();
    expect(offScale(-300.1)).toBe('below');
  });
  it('sway: none at or below e = 0.003, 1° just above, 4° at 0.03 and beyond', () => {
    expect(swayAngle(0.003, CONFIG)).toBeNull();
    expect(swayAngle(0, CONFIG)).toBeNull();
    expect(swayAngle(0.0030001, CONFIG)).toBe(1);
    expect(swayAngle(0.03, CONFIG)).toBe(4);
    expect(swayAngle(0.5, CONFIG)).toBe(4);
    expect(swayAngle(0.0165, CONFIG)).toBe(2.5);
  });
  it('property: sway angle grows with e', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.0031, max: 0.1, noNaN: true }), fc.double({ min: 0.0031, max: 0.1, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return swayAngle(lo, CONFIG)! <= swayAngle(hi, CONFIG)!;
      }),
    );
  });
  it('moss steps by years since launch', () => {
    expect([null, 0, 9, 10, 19, 20, 29, 30, 80].map(mossStep)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('lanes are spread by NORAD id and stay in range', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 999999 }), fc.integer({ min: 1, max: 6 }), (n, k) => laneOf(n, k) >= 0 && laneOf(n, k) < k));
  });
  it('year columns: one per year with an empty column at each end', () => {
    const c = buildColumns([2000, 2003, 2003], false);
    expect(c.list.map((x) => x.from)).toEqual([1999, 2000, 2001, 2002, 2003, 2004]);
    expect(c.find(2003)).toBeDefined();
    expect(c.find(1990)).toBeUndefined();
  });
  it('narrow columns hold five years', () => {
    const c = buildColumns([2001, 2008], true);
    expect(c.list.map((x) => [x.from, x.to])).toEqual([[2000, 2004], [2005, 2009]]);
    expect(c.find(2004)).toBe(c.list[0]);
    expect(c.find(2005)).toBe(c.list[1]);
  });
  it('objects with no usable year get their own column at the left', () => {
    const c = buildColumns([null, 1999], false);
    expect(c.list[0]!.from).toBeNull();
    expect(c.find(null)).toBe(c.list[0]);
    expect(c.find(1999)!.x).toBeGreaterThan(c.list[0]!.x);
  });
  it('no unknown column when every object has a year', () => {
    expect(buildColumns([1999], false).find(null)).toBeUndefined();
  });
  it('the 18 March 2002 line sits about a fifth of the way through its year', () => {
    expect(yearFraction('2002-03-18')).toBeCloseTo(76 / 365, 9);
    expect(yearFraction('2002-01-01')).toBe(0);
    const c = buildColumns([2001, 2003], false);
    const x = c.xOfYear(2002, yearFraction('2002-03-18'))!;
    const col = c.find(2002)!;
    expect(x).toBeGreaterThan(col.x);
    expect(x).toBeLessThan(col.x + col.width);
    expect(c.xOfYear(1980, 0)).toBeNull();
  });
});

describe('bands come from the register config', () => {
  it('five bands, with edges at ±zone, 247 and 280', () => {
    const bands = bandsOf(CONFIG);
    expect(bands.map((b) => b.id)).toEqual(['below', 'road', 'shallow', 'wall', 'consecrated']);
    expect(bands.map((b) => [b.fromKm, b.toKm])).toEqual([[-300, -200], [-200, 200], [200, 247], [247, 280], [280, 450]]);
  });
  it('follow a changed config', () => {
    const changed = { ...CONFIG, thresholdLowKm: 250, thresholdHighKm: 290, protectedZoneKm: 150 } as unknown as typeof CONFIG;
    expect(bandsOf(changed).map((b) => b.toKm)).toEqual([-150, 150, 250, 290, 450]);
    expect(bandCopy('road', changed).full).toContain('±150 km');
    expect(assumptionsLine(changed)).toContain('±25 km');
  });
});

describe('copy', () => {
  it('every verdict word comes with its plain meaning', () => {
    for (const v of ['fallen', 'unquiet', 'shallow grave', 'restless', 'uncertain', 'buried'] as const) {
      const c = verdictCopy(v, CONFIG);
      expect(c.pair).toBe(`${c.word} (${c.meaning})`);
      expect(c.meaning.length).toBeGreaterThan(10);
    }
    expect(verdictCopy('shallow grave', CONFIG).pair).toBe('Shallow grave (perigee below the IADC threshold)');
  });
  it('data age says what the orbit came from', () => {
    expect(dataAge({ orbitSource: { kind: 'SATCAT' } })).toBe('SATCAT, element date not given');
    expect(dataAge({ orbitSource: { kind: 'GP', epoch: '2026-11-20T12:07:02.320608' } })).toBe('GP mean elements, epoch 2026-11-20 12:07 UTC');
  });
});

describe('html escaping', () => {
  it('escapes markup and quotes', () => {
    expect(esc(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
  it('digits go in the sans, the rest is escaped', () => {
    expect(withSansDigits('ECHOSTAR 7 <b>')).toBe('ECHOSTAR <span class="num">7</span> &lt;b&gt;');
  });
});

describe('register check', () => {
  it('accepts the fixture and rejects other shapes', () => {
    expect(isRegister(fixture)).toBe(true);
    for (const bad of [null, 5, {}, { ...fixture, schema: 2 }, { ...fixture, records: null }, { ...fixture, config: {} }]) {
      expect(isRegister(bad)).toBe(false);
    }
  });
});

const stones = (svg: string): string[] => svg.split('<a class=').slice(1);

describe('churchyard chart on the fixture register', () => {
  const retired = retiredPayloads(fixture.records);
  const svg = chartSvg(fixture, false);
  it('draws one link per retired payload, and nothing for the others', () => {
    expect(retired).toHaveLength(20);
    expect(stones(svg)).toHaveLength(20);
    expect(svg).not.toContain('data-norad="858"'); // living
    expect(svg).not.toContain('data-norad="4511"'); // rocket body
  });
  it('each link goes to the ledger and has a spoken label', () => {
    expect(svg).toContain('href="#/sat/27378"');
    expect(svg).toContain('aria-label="ECHOSTAR 7, unquiet, perigee plus 110.4 kilometres above GEO"');
    expect(svg).toContain('aria-label="FIXTURE FALLEN, fallen, perigee minus 386 kilometres, below GEO, off the drawn scale"');
    expect(svg).toContain('aria-label="FIXTURE EDGE P247, uncertain, perigee plus 247 kilometres above GEO, borderline"');
  });
  it('off-scale stones sit at the edge with an arrow and the true value', () => {
    expect(svg).toContain('\u25B2 +1,914 km');
    expect(svg).toContain('\u25BC \u22122,000 km');
    expect(svg).toContain('perigee plus 1,914 kilometres above GEO, off the drawn scale');
    expect(svg).toContain('\u25BC \u2212386 km'); // below −300 too
  });
  it('draws the five bands, the edge lines, the GEO line and the 18 March 2002 line', () => {
    for (const id of ['below', 'road', 'shallow', 'wall', 'consecrated']) expect(svg).toContain(`band band--${id}`);
    expect(svg.match(/class="edge/g)!.length).toBe(5);
    expect(svg).toContain('class="fcc-line"');
    expect(svg).toContain('FCC minimum-perigee rule (launches from 18 Mar 2002)');
    expect(svg).toContain('The wall');
  });
  it('sway only for e above 0.003, as an angle in a CSS variable', () => {
    const swaying = stones(svg).filter((s) => s.includes('class="sway"'));
    expect(swaying).toHaveLength(retired.filter((r) => r.e > 0.003).length);
    expect(swaying).toHaveLength(1);
    expect(swaying[0]).toContain('data-norad="90011"');
    expect(swaying[0]).toMatch(/--sway-angle:1deg/);
  });
  it('a borderline whisker for exactly the borderline stones', () => {
    const withWhisker = stones(svg).filter((s) => s.includes('class="whisker"'));
    expect(withWhisker).toHaveLength(retired.filter((r) => r.verdict.borderline).length);
    expect(withWhisker).toHaveLength(9);
  });
  it('moss only where there is a launch date, in four steps', () => {
    const mossy = (norad: number): boolean => stones(svg).find((s) => s.includes(`data-norad="${norad}"`))!.includes('class="moss"');
    expect(mossy(27378)).toBe(true);
    expect(mossy(90033)).toBe(false); // launch year from the designator
    expect(mossy(1317)).toBe(false); // GPZ-only, no launch date
  });
  it('a launch year from the designator puts the stone in that year column', () => {
    const cols = buildColumns(retired.map((r) => r.launchYear), false);
    expect(retired.find((r) => r.norad === 90033)!.launchYear).toBe(2002);
    expect(cols.find(2002)).toBeDefined();
    expect(retired.find((r) => r.norad === 1317)!.launchYear).toBe(1965);
  });
  it('has one shape per verdict', () => {
    const seen = new Set(stones(svg).map((s) => /stone--(\w+)/.exec(s)![1]));
    expect([...seen].sort()).toEqual(['buried', 'fallen', 'restless', 'shallow', 'uncertain', 'unquiet']);
  });
  it('the selected stone is marked', () => {
    expect(chartSvg(fixture, false, 27378)).toMatch(/class="stone-link selected" href="#\/sat\/27378"/);
    expect(svg).not.toContain('selected');
  });
  it('the narrow chart merges years into five-year columns and drops the in-chart labels', () => {
    const narrow = chartSvg(fixture, true);
    expect(narrow).not.toContain('band-name');
    expect(narrow).not.toContain('fcc-label');
    expect(narrow).toContain('class="fcc-line"');
    expect(Number(/viewBox="0 0 ([\d.]+)/.exec(narrow)![1])).toBeLessThan(Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]));
  });
  it('escapes a name that holds markup', () => {
    const evil = structuredClone(fixture);
    evil.records[0]!.name = '"><script>alert(1)</script>';
    const out = chartSvg(evil, false) + cardHtml(retiredPayloads(evil.records)[0], evil.config);
    expect(out).not.toContain('<script>');
  });
  it('an empty register draws nothing and does not throw', () => {
    const empty = { ...fixture, records: [] };
    expect(() => chartSvg(empty, false)).not.toThrow();
    expect(stones(chartSvg(empty, false))).toHaveLength(0);
  });
});

describe('selection card and legend', () => {
  const echostar = retiredPayloads(fixture.records).find((r) => r.norad === 27378)!;
  it('the card shows the verdict with its meaning, p, data age and assumptions', () => {
    const html = cardHtml(echostar, fixture.config);
    expect(html).toContain('Unquiet (the orbit reaches the protected zone');
    expect(html).toContain('+110.4 km');
    expect(html).toContain('GP mean elements, epoch 2026-11-20 12:07 UTC');
    expect(html).toContain('C_R·A/m from 0.012 to 0.045');
    expect(html).toContain('±25 km');
    expect(html).toContain('href="#/sat/27378"');
  });
  it('a SATCAT stone says the element date is not given, and p is in whole km', () => {
    const r = retiredPayloads(fixture.records).find((x) => x.norad === 90002)!;
    const html = cardHtml(r, fixture.config);
    expect(html).toContain('SATCAT, element date not given');
    expect(html).toContain('+404 km');
  });
  it('a stone placed by designator year says so and shows no moss claim', () => {
    const r = retiredPayloads(fixture.records).find((x) => x.norad === 90033)!;
    expect(cardHtml(r, fixture.config)).toContain('Launch year from the international designator');
  });
  it('no card text states a retirement date', () => {
    const all = retiredPayloads(fixture.records).map((r) => cardHtml(r, fixture.config)).join(' ');
    expect(all).not.toMatch(/retired (in|on|at)\b/i);
    expect(all).not.toMatch(/retirement date/i);
  });
  it('the legend lists the bands, all six stones, and the four moss steps', () => {
    const html = legendHtml(fixture.config);
    expect(html).toContain('The churchyard wall: the IADC threshold band');
    expect(html).toContain('Moss: years since launch');
    expect(html.match(/class="glyph"/g)!.length).toBe(6 + 4);
  });
});

describe('register source for the build', () => {
  it('falls back to the fixture and marks it as sample data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sexton-reg-'));
    try {
      mkdirSync(join(dir, 'test/fixtures'), { recursive: true });
      writeFileSync(join(dir, 'test/fixtures/register.json'), JSON.stringify({ schema: 1, sample: false, records: [] }));
      const r = registerText(dir);
      expect(r.sample).toBe(true);
      expect(JSON.parse(r.text)).toMatchObject({ schema: 1, sample: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('uses data/register.json when it exists, unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sexton-reg-'));
    try {
      mkdirSync(join(dir, 'data'), { recursive: true });
      mkdirSync(join(dir, 'test/fixtures'), { recursive: true });
      writeFileSync(join(dir, 'test/fixtures/register.json'), '{}');
      writeFileSync(join(dir, 'data/register.json'), '{"schema":1,"sample":false}');
      expect(registerText(dir)).toEqual({ text: '{"schema":1,"sample":false}', sample: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('the committed fixture register is not itself marked as sample (the build adds that)', () => {
    expect(fixture.sample).toBe(false);
  });
});

describe('no hard-coded colours outside tokens.css', () => {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|css|html|svg)$/.test(name)) files.push(path);
    }
  };
  walk(join(ROOT, 'src/ui'));
  files.push(join(ROOT, 'index.html'));
  const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklch|oklab)\(|\b(white|black|red|green|blue|yellow|orange|purple|gray|grey|silver|gold|brown|pink|cyan|magenta|navy|teal|olive|maroon|lime|aqua)\b/i;
  it('scans some files', () => expect(files.length).toBeGreaterThan(8));
  for (const file of files) {
    if (file.endsWith('tokens.css')) continue;
    it(file.replace(ROOT, ''), () => {
      const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(COLOUR.exec(text)?.[0]).toBeUndefined();
    });
  }
  it('tokens.css defines the seven palette colours and the print three', () => {
    const css = readFileSync(join(ROOT, 'src/ui/styles/tokens.css'), 'utf8');
    for (const name of ['ground', 'road', 'stone', 'bone', 'bone-muted', 'moss', 'lantern', 'ink', 'ink-muted', 'paper']) {
      expect(css).toMatch(new RegExp(`--${name}: #[0-9a-f]{6};`));
    }
  });
  it('lantern amber is used only for focus and selection', () => {
    const uses: string[] = [];
    for (const file of files) {
      if (!file.endsWith('.css') || file.endsWith('tokens.css')) continue;
      const css = readFileSync(file, 'utf8');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*var\(--lantern\)[^{}]*)\}/g)) uses.push(m[1]!.trim());
    }
    expect(uses.length).toBeGreaterThan(0);
    for (const sel of uses) expect(sel, sel).toMatch(/focus|selected|\.card:has/);
  });
});
