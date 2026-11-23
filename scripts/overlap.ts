// Counts overlapping stones in the churchyard chart, from the SVG that chartSvg draws.
// Usage: node scripts/overlap.ts [register.json] [width height]   (stone box size in SVG units)
// Two stones overlap when their boxes share area. Prints stones touched and pairs.
import { readFileSync } from 'node:fs';
import { chartSvg } from '../src/ui/views/churchyard.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { countOverlaps } from '../src/ui/svg/layout.ts';
import type { BoxPos } from '../src/ui/svg/layout.ts';
import { LAYOUT } from '../src/ui/svg/scale.ts';
export function stonePositions(svg: string): BoxPos[] {
  const out: BoxPos[] = [];
  for (const m of svg.matchAll(/<a class="stone-link[^"]*"[^>]*>.*?<g transform="translate\(([-\d.]+) ([-\d.]+)\)"/g)) {
    out.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  return out;
}
if (process.argv[1]?.endsWith('overlap.ts')) {
  const file = process.argv[2] ?? 'data/register.json';
  const w = Number(process.argv[3] ?? LAYOUT.stoneWidth);
  const h = Number(process.argv[4] ?? LAYOUT.stoneHeight);
  const reg = JSON.parse(readFileSync(file, 'utf8')) as UiRegister;
  for (const narrow of [false, true]) {
    const boxes = stonePositions(chartSvg(reg, narrow));
    const r = countOverlaps(boxes, w, h);
    console.log(`${narrow ? 'narrow' : 'wide  '}: ${boxes.length} stones, ${r.stones} overlap another, ${r.pairs} overlapping pairs (box ${w}x${h})`);
  }
}
