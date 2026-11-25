// The chart's axis texts (tick numbers, zone names, GEO, the road's label, edge counts) never overlap each other.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { UiRegister } from '../src/ui/register.ts';
import { STONE_PATH } from '../src/ui/svg/headstone.ts';
import { textBox } from '../src/ui/svg/axis.ts';
import { intersects, stoneBox } from '../src/ui/svg/labels.ts';
import type { Box } from '../src/ui/svg/labels.ts';
import { chartModel, chartSvg } from '../src/ui/views/churchyard.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const fixture = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/register.json'), 'utf8')) as UiRegister;

interface Text {
  cls: string;
  text: string;
  box: Box;
}
const AXIS = /<text class="(tick tick--high|tick tick--geo|tick|zone-label|band-name|break-label|edge-label)" x="([\d.-]+)" y="([\d.-]+)"(?: text-anchor="(end)")?>([^<]*)<\/text>/g;
function axisTexts(svg: string): Text[] {
  const plot = svg.slice(0, svg.indexOf('class="axis-title"'));
  const out: Text[] = [];
  for (const m of plot.matchAll(AXIS)) {
    const cls = m[1]!;
    const size = /zone-label|band-name|break-label/.test(cls) ? 'name' : 'tick';
    out.push({ cls, text: m[5]!, box: textBox(m[5]!, Number(m[2]), Number(m[3]), m[4] === 'end' ? 'end' : 'start', size) });
  }
  return out;
}
describe.each([
  ['the real register', real],
  ['the fixture register', fixture],
])('axis labels on %s', (_name, reg) => {
  const texts = axisTexts(chartSvg(reg, false));
  it('draws the six zone names, the high-ground note and the tick numbers', () => {
    for (const cls of ['band-name', 'break-label', 'zone-label', 'tick tick--geo', 'tick tick--high']) expect(texts.some((t) => t.cls === cls), cls).toBe(true);
    expect(texts.filter((t) => t.cls === 'band-name')).toHaveLength(5);
  });
  it('no label box overlaps another label box', () => {
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) expect(intersects(texts[i]!.box, texts[j]!.box), `${texts[i]!.text} / ${texts[j]!.text}`).toBe(false);
    }
  });
  it('zone names sit inside the plot, not in the gutter', () => {
    const gutter = chartModel(reg, false).cols.gutter;
    for (const t of texts.filter((t) => /name|label/.test(t.cls))) expect(t.box.x0, t.text).toBeGreaterThanOrEqual(gutter);
  });
});
describe('on the real register', () => {
  it('the zone names cover no stone', () => {
    const model = chartModel(real, false);
    const names = axisTexts(chartSvg(real, false)).filter((t) => t.cls === 'band-name' || t.cls === 'break-label');
    for (const t of names) {
      const hit = [...model.pos.values()].filter((p) => intersects(t.box, stoneBox(p.x, p.y)));
      expect(hit.length, t.text).toBe(0);
    }
  });
});
describe('story stones and name labels on the real register', () => {
  const svg = chartSvg(real, false);
  it('a story stone draws no moss: lantern only', () => {
    const story = [...svg.matchAll(/<g class="stone-pos[^"]*stone-pos--story"[\s\S]*?<\/g><\/a>/g)];
    expect(story.length).toBe(36);
    for (const m of story) expect(m[0]).not.toContain('class="moss"');
  });
  it('no name label covers any stone', () => {
    const model = chartModel(real, false);
    for (const l of model.labels.values()) {
      for (const p of model.pos.values()) expect(intersects(l.box, stoneBox(p.x, p.y)), String(l.id)).toBe(false);
    }
  });
});
describe('shared defs', () => {
  it('every gradient, pattern and clip path the chart uses is defined once in index.html, not in each chart', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const css = readFileSync(join(ROOT, 'src/ui/styles/churchyard.css'), 'utf8');
    for (const id of new Set([...css.matchAll(/url\(#([a-z-]+)\)/g)].map((m) => m[1]!))) expect(html, id).toContain(`id="${id}"`);
    for (const id of ['stone-clip', 'above-ground']) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain(`<path d="${STONE_PATH}" />`);
    expect(chartSvg(real, false)).not.toContain('<defs>');
  });
});
