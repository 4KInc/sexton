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
import { buildColumns, edgeBaseY, HIGH_TICKS_KM, LAYOUT, mossStep, offScale, offScaleCounts, plotHeight, SCALE, swayAngle, yBreak, yearFraction, yOf } from '../src/ui/svg/scale.ts';
import { countOverlaps, layoutStones, nextInNav, NAV_KEYS, navSort, PACK } from '../src/ui/svg/layout.ts';
import { cardHtml, chartModel, chartSvg, legendHtml, retiredPayloads } from '../src/ui/views/churchyard.ts';

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
    expect(yOf(SCALE.maxKm)).toBe(LAYOUT.top + SCALE.edgePx);
    expect(yOf(SCALE.minKm)).toBe(LAYOUT.top + plotHeight() - SCALE.edgePx);
    expect(yOf(5000)).toBe(yOf(SCALE.maxKm));
    expect(yOf(-5000)).toBe(yOf(SCALE.minKm));
    expect(yOf(100)).toBeLessThan(yOf(0));
  });
  it('keeps −200 to +400 linear, at the same pixels per km', () => {
    for (const [a, b] of [[-300, -200], [-200, 0], [0, 247], [247, 400]] as const) {
      expect(yOf(a) - yOf(b)).toBeCloseTo((b - a) * SCALE.pxPerKm, 9);
    }
  });
  it('the break is at +400, and the scale is continuous there', () => {
    expect(SCALE.linearMaxKm).toBe(400);
    expect(yOf(400)).toBe(yBreak());
    expect(yOf(400.001)).toBeCloseTo(yOf(400), 2);
    expect(yOf(1000)).toBeCloseTo(yBreak() - SCALE.highPx, 9);
  });
  it('above the break the scale is compressed: a km is shorter than below it, and shorter further up', () => {
    const below = yOf(300) - yOf(400);
    const nearBreak = (yOf(400) - yOf(500)) / 100;
    const high = (yOf(900) - yOf(1000)) / 100;
    expect(nearBreak).toBeLessThan(below / 100);
    expect(high).toBeLessThan(nearBreak);
  });
  it('property: y falls as p rises, over the whole range and beyond it where it is flat', () => {
    fc.assert(
      fc.property(fc.double({ min: -3000, max: 3000, noNaN: true }), fc.double({ min: -3000, max: 3000, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return yOf(hi) <= yOf(lo);
      }),
    );
    fc.assert(
      fc.property(fc.double({ min: SCALE.minKm, max: SCALE.maxKm - 1, noNaN: true }), (p) => yOf(p + 1) < yOf(p)),
    );
  });
  it('the high ground has its own ticks, all inside it', () => {
    expect(HIGH_TICKS_KM).toEqual([500, 600, 800, 1000]);
    for (const km of HIGH_TICKS_KM) {
      expect(km).toBeGreaterThan(SCALE.linearMaxKm);
      expect(km).toBeLessThanOrEqual(SCALE.maxKm);
    }
  });
  it('off-scale only above +1,000 or below −300', () => {
    expect(offScale(450)).toBeNull();
    expect(offScale(1000)).toBeNull();
    expect(offScale(1000.1)).toBe('above');
    expect(offScale(-300)).toBeNull();
    expect(offScale(-300.1)).toBe('below');
  });
  it('counts the off-scale objects per edge', () => {
    expect(offScaleCounts([0, 999, 1000, 1001, 5000, -300, -301, -2000, -2001])).toEqual({ above: 2, below: 3 });
    expect(offScaleCounts([])).toEqual({ above: 0, below: 0 });
  });
  it('off-scale stones stand in the strips outside the scale proper', () => {
    expect(edgeBaseY('above')).toBeLessThan(yOf(SCALE.maxKm));
    expect(edgeBaseY('below') - LAYOUT.stoneHeight).toBeGreaterThan(yOf(SCALE.minKm));
    expect(edgeBaseY('below')).toBeLessThan(LAYOUT.top + plotHeight());
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
  it('year columns: one per year with an empty column at each end', () => {
    const c = buildColumns([2000, 2003, 2003], false);
    expect(c.list.map((x) => x.from)).toEqual([1999, 2000, 2001, 2002, 2003, 2004]);
    expect(c.find(2003)).toBeDefined();
    expect(c.find(1990)).toBeUndefined();
  });
  it('a column grows to the width its stones need, and no narrower than the minimum', () => {
    const c = buildColumns([2000, 2002], false, new Map([[2001, 50]]));
    expect(c.find(2001)!.width).toBe(50);
    expect(c.find(2000)!.width).toBe(LAYOUT.yearColumnMin);
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
    expect(bands.map((b) => [b.fromKm, b.toKm])).toEqual([[-300, -200], [-200, 200], [200, 247], [247, 280], [280, SCALE.maxKm]]);
  });
  it('follow a changed config', () => {
    const changed = { ...CONFIG, thresholdLowKm: 250, thresholdHighKm: 290, protectedZoneKm: 150 } as unknown as typeof CONFIG;
    expect(bandsOf(changed).map((b) => b.toKm)).toEqual([-150, 150, 250, 290, SCALE.maxKm]);
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
  it('off-scale stones get one label per edge with a count, and keep their exact value in the aria-label', () => {
    expect(svg.match(/class="edge-label"/g)).toHaveLength(2);
    expect(svg).toContain('\u25B2 1 more above +1,000 km');
    expect(svg).toContain('\u25BC 2 more below \u2212300 km');
    expect(svg).not.toContain('off-label');
    expect(svg).toContain('perigee plus 1,914 kilometres above GEO, off the drawn scale');
    expect(svg).toContain('perigee minus 2,000 kilometres, below GEO, off the drawn scale');
  });
  it('draws the break mark and the high-ground ticks', () => {
    expect(svg.match(/class="break-mark"/g)).toHaveLength(1);
    for (const km of ['+500', '+600', '+800', '+1,000', '+400']) expect(svg).toContain(`>${km}</text>`);
    expect(svg.match(/class="tick tick--high"/g)).toHaveLength(HIGH_TICKS_KM.length);
    expect(svg).toContain('High ground: compressed scale');
  });
  it('draws the five bands, the edge lines, the GEO line and the 18 March 2002 line', () => {
    for (const id of ['below', 'road', 'shallow', 'wall', 'consecrated']) expect(svg).toContain(`band band--${id}`);
    expect(svg.match(/class="edge(?: edge--geo)?"/g)!.length).toBe(7); // +1,000, 280, 247, 200, 0, −200, −300
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
  it('the narrow chart has the same year columns at its natural size, and drops the in-chart labels', () => {
    const narrow = chartSvg(fixture, true);
    expect(narrow).not.toContain('band-name');
    expect(narrow).not.toContain('fcc-label');
    expect(narrow).toContain('class="fcc-line"');
    const [w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(narrow)!.slice(1);
    expect(narrow).toContain(`width="${w}" height="${h}"`);
    expect(svg).not.toMatch(/<svg[^>]* width=/);
    expect(chartModel(fixture, true).cols.list.map((c) => c.from)).toEqual(chartModel(fixture, false).cols.list.map((c) => c.from));
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

describe('stone layout', () => {
  const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
  const posKey = (m: ReturnType<typeof chartModel>): string[] => [...m.pos.values()].map((p) => `${p.x.toFixed(2)}|${p.y.toFixed(2)}`);
  it('is deterministic: the same input in any order gives the same positions', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: 1000 + i * 7, column: 2000 + (i % 3), y: 100 + ((i * 37) % 50) }));
    const a = layoutStones(items);
    const b = layoutStones([...items].reverse());
    expect([...a.placed.entries()].sort()).toEqual([...b.placed.entries()].sort());
    expect([...a.widths.entries()].sort()).toEqual([...b.widths.entries()].sort());
  });
  it('property: no two stones stand at the same position, even when p is identical', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.record({ id: fc.integer({ min: 1, max: 99999 }), column: fc.integer({ min: 1999, max: 2001 }), y: fc.integer({ min: 100, max: 112 }) }), { selector: (r) => r.id, maxLength: 80 }),
        (items) => {
          const { placed } = layoutStones(items);
          const keys = [...placed.values()].map((p) => `${p.column}|${p.dx.toFixed(2)}|${p.y.toFixed(2)}`);
          return new Set(keys).size === items.length;
        },
      ),
    );
  });
  it('never moves a stone up or down, and keeps it inside its column width', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, column: 2000, y: 200 + (i % 5) }));
    const { placed, widths } = layoutStones(items);
    for (const it of items) {
      const p = placed.get(it.id)!;
      expect(p.y).toBe(it.y);
      expect(Math.abs(p.dx) + LAYOUT.stoneWidth / 2).toBeLessThanOrEqual(widths.get(2000)! / 2);
    }
  });
  it('stones far apart in height share a lane, and close ones take different lanes', () => {
    const far = layoutStones([{ id: 1, column: 1, y: 100 }, { id: 2, column: 1, y: 100 + LAYOUT.stoneHeight }]);
    expect(far.placed.get(1)!.dx).toBe(far.placed.get(2)!.dx);
    const near = layoutStones([{ id: 1, column: 1, y: 100 }, { id: 2, column: 1, y: 101 }]);
    expect(near.placed.get(1)!.dx).not.toBe(near.placed.get(2)!.dx);
    expect(Math.abs(near.placed.get(1)!.dx - near.placed.get(2)!.dx)).toBeGreaterThanOrEqual(LAYOUT.stoneWidth);
  });
  it('uses at most the lane cap, so a crowded year does not widen the chart without limit', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, column: 1, y: 100 }));
    const { placed } = layoutStones(items);
    expect(new Set([...placed.values()].map((p) => p.lane)).size).toBeLessThanOrEqual(PACK.maxLanes);
  });
  it('overlap counting: boxes share area only when closer than a stone in both directions', () => {
    expect(countOverlaps([{ x: 0, y: 0 }, { x: 9, y: 13 }])).toEqual({ stones: 2, pairs: 1 });
    expect(countOverlaps([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 14 }])).toEqual({ stones: 0, pairs: 0 });
  });
  it('on the real register: all stones have distinct positions, and overlap stays below 15% of the stones', () => {
    const m = chartModel(real, false);
    expect(m.stones).toHaveLength(696);
    expect(new Set(posKey(m)).size).toBe(696);
    const boxes = [...m.pos.values()];
    expect(countOverlaps(boxes).stones).toBeLessThan(696 * 0.15);
  });
  it('on the real register: the edge counts are 15 above and 8 below, and the labels say so', () => {
    const svg = chartSvg(real, false);
    expect(svg).toContain('\u25B2 15 more above +1,000 km');
    expect(svg).toContain('\u25BC 8 more below \u2212300 km');
    expect(svg.match(/class="edge-label"/g)).toHaveLength(2);
  });
  it('filtering does not move a stone', () => {
    const all = chartModel(fixture, false);
    const some = chartModel(fixture, false, fixture.records.filter((r) => r.norad === 27378));
    expect(some.pos.get(27378)).toEqual(all.pos.get(27378));
  });
});
describe('keyboard: one Tab stop and arrow keys', () => {
  const tabStops = (svg: string): string[] => stones(svg).filter((s) => s.includes('tabindex="0"')).map((s) => /data-norad="(\d+)"/.exec(s)![1]!);
  const model = chartModel(fixture, false);
  it('exactly one stone is in the Tab order, and the rest are at -1', () => {
    const svg = chartSvg(fixture, false);
    expect(tabStops(svg)).toHaveLength(1);
    expect(stones(svg).filter((s) => s.includes('tabindex="-1"'))).toHaveLength(19);
    expect(svg).not.toMatch(/tabindex="[1-9]/);
  });
  it('the Tab stop is the first stone in keyboard order, or the selected one', () => {
    expect(tabStops(chartSvg(fixture, false))).toEqual([String(model.nav[0]!.id)]);
    expect(tabStops(chartSvg(fixture, false, 27378))).toEqual(['27378']);
    expect(tabStops(chartSvg(fixture, false, null, undefined, 90011))).toEqual(['90011']);
  });
  it('keeps one Tab stop on the narrow chart too, and keeps the aria-labels and the skip link target', () => {
    const narrow = chartSvg(fixture, true);
    expect(tabStops(narrow)).toHaveLength(1);
    expect(narrow).toContain('aria-label="ECHOSTAR 7, unquiet, perigee plus 110.4 kilometres above GEO"');
  });
  const items = navSort([
    { id: 1, col: 0, y: 100, dx: 0 },
    { id: 2, col: 0, y: 150, dx: 0 },
    { id: 3, col: 0, y: 150, dx: 11 },
    { id: 4, col: 2, y: 90, dx: 0 },
    { id: 5, col: 2, y: 140, dx: 0 },
    { id: 6, col: 5, y: 120, dx: 0 },
  ]);
  it('orders by column, then top to bottom, then left to right', () => {
    expect(items.map((n) => n.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('up and down move within a column and stop at its ends', () => {
    expect(nextInNav(items, 1, 'ArrowDown')).toBe(2);
    expect(nextInNav(items, 2, 'ArrowDown')).toBe(3);
    expect(nextInNav(items, 3, 'ArrowDown')).toBeNull();
    expect(nextInNav(items, 3, 'ArrowUp')).toBe(2);
    expect(nextInNav(items, 1, 'ArrowUp')).toBeNull();
  });
  it('left and right go to the next column with stones, at the nearest height', () => {
    expect(nextInNav(items, 2, 'ArrowRight')).toBe(5);
    expect(nextInNav(items, 1, 'ArrowRight')).toBe(4);
    expect(nextInNav(items, 5, 'ArrowRight')).toBe(6);
    expect(nextInNav(items, 6, 'ArrowRight')).toBeNull();
    expect(nextInNav(items, 6, 'ArrowLeft')).toBe(5);
    expect(nextInNav(items, 4, 'ArrowLeft')).toBe(1);
    expect(nextInNav(items, 1, 'ArrowLeft')).toBeNull();
  });
  it('Home and End jump to the first and last stone', () => {
    expect(nextInNav(items, 5, 'Home')).toBe(1);
    expect(nextInNav(items, 2, 'End')).toBe(6);
  });
  it('other keys do nothing, and an empty chart has nowhere to go', () => {
    expect(nextInNav(items, 1, 'a')).toBeNull();
    expect(nextInNav(items, 1, 'Enter')).toBeNull();
    expect(nextInNav([], null, 'Home')).toBeNull();
    expect([...NAV_KEYS]).toEqual(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
  });
  it('property: every move lands on a stone, and Home then End reach the ends', () => {
    fc.assert(
      fc.property(fc.constantFrom(...NAV_KEYS), fc.constantFrom(...items.map((n) => n.id)), (key, id) => {
        const next = nextInNav(items, id, key);
        return next === null || items.some((n) => n.id === next);
      }),
    );
  });
  it('the real register: the arrow keys alone reach every stone from the first', () => {
    const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
    const nav = chartModel(real, false).nav;
    const seen = new Set<number>([nav[0]!.id]);
    const queue = [nav[0]!.id];
    while (queue.length > 0) {
      const id = queue.pop()!;
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
        const next = nextInNav(nav, id, key);
        if (next !== null && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(nav.length);
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
