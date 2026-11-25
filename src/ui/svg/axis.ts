// Where the axis texts stand: the tick numbers in the gutter, and the zone names inside their bands, at the plot's
// left edge. A name looks for a spot in its band where it covers no stone and no other label. Pure code, no DOM.
import type { Config } from '../../engine/config.ts';
import { bandCopy } from '../copy.ts';
import { bandsOf } from './bands.ts';
import { intersects, stoneBox } from './labels.ts';
import type { Box } from './labels.ts';
import { SCALE, yBreak, yOf } from './scale.ts';

export interface AxisText {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  box: Box;
}
/** Width of one mono capital at 10 px (names) and 11 px (ticks), with letter spacing, rounded up. */
const CHAR = { name: 7.1, tick: 7.4 } as const;
const NAME_H = 10;
export const textBox = (text: string, x: number, baseline: number, anchor: 'start' | 'end', size: 'name' | 'tick'): Box => {
  const w = Math.ceil(text.length * CHAR[size]);
  const h = size === 'name' ? NAME_H : 12;
  return { x0: anchor === 'start' ? x : x - w, y0: baseline - h + 2, x1: anchor === 'start' ? x + w : x, y1: baseline + 2 };
};
export const axisText = (text: string, x: number, y: number, anchor: 'start' | 'end', size: 'name' | 'tick'): AxisText => ({ text, x, y, anchor, box: textBox(text, x, y, anchor, size) });

/**
 * Zone names, one per band, plus the high-ground note. `taken` is every box already fixed (tick numbers, GEO,
 * edge labels, the road's own label); `stones` are the drawn stones. Each name takes the highest spot in its band
 * that is clear; if none is, the spot that covers the fewest stones.
 */
export function zoneNames(config: Config, x: number, taken: readonly Box[], stones: readonly { x: number; y: number }[], highText: string): AxisText[] {
  const boxes = stones.map((s) => stoneBox(s.x, s.y));
  const used = [...taken];
  const out: AxisText[] = [];
  const place = (text: string, top: number, bottom: number, fromBottom: boolean): void => {
    let best: AxisText | null = null;
    let bestHits = Infinity;
    for (let y = fromBottom ? bottom - 3 : top + NAME_H + 1; fromBottom ? y - NAME_H >= top : y <= bottom - 2; y += fromBottom ? -3 : 3) {
      const t = axisText(text, x + 8, y, 'start', 'name');
      const hits = used.filter((b) => intersects(t.box, b, 2)).length * 100 + boxes.filter((b) => intersects(t.box, b)).length;
      if (hits < bestHits) {
        best = t;
        bestHits = hits;
        if (hits === 0) break;
      }
    }
    if (best === null) return;
    out.push(best);
    used.push(best.box);
  };
  // The high ground's note sits just above the zigzag; the names sit in the linear part of their bands.
  place(highText, yOf(SCALE.maxKm), yBreak() - 4, true);
  for (const band of bandsOf(config)) {
    const top = band.toKm > SCALE.linearMaxKm ? yBreak() + 4 : yOf(band.toKm);
    place(bandCopy(band.id, config).short, top, yOf(band.fromKm), false);
  }
  return out;
}
