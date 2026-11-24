// Name labels for the stones that have a case file. A label goes to the right of its stone, then the left, above,
// below, and then farther out on a short leader line. It never overlaps a stone or another label. Pure code, no DOM.
import { LAYOUT } from './scale.ts';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface LabelItem {
  id: number;
  name: string;
  /** Middle of the stone's base. */
  x: number;
  y: number;
}
export interface LabelPlacement {
  id: number;
  /** Where the text starts (x, baseline y), and which way it runs from there. */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  box: Box;
  /** A short line from the stone to the label, when the label stands apart. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}
export const LABEL = {
  /** Width of one character, with room to spare. IM Fell English capitals run about 7 units at 11 px (measured in a browser: ECHOSTAR 7 is 70 units). */
  charW: 7.4,
  height: 12,
  /** How far outside a stone's own box a label must stay. */
  clear: 2,
  /** Distances for the leader-line candidates. */
  rings: [30, 48, 72, 100],
} as const;

const HALF = LAYOUT.stoneWidth / 2 + 1;
export const labelWidth = (name: string): number => Math.ceil(name.length * LABEL.charW);
/** The box a stone fills, with its ring: what no label may cover. */
export const stoneBox = (x: number, y: number): Box => ({ x0: x - HALF - 3, y0: y - LAYOUT.stoneHeight - 5, x1: x + HALF + 3, y1: y + 3 });
export const intersects = (a: Box, b: Box, pad = 0): boolean => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
const within = (a: Box, bounds: Box): boolean => a.x0 >= bounds.x0 && a.x1 <= bounds.x1 && a.y0 >= bounds.y0 && a.y1 <= bounds.y1;

function boxFor(x: number, baseline: number, anchor: LabelPlacement['anchor'], w: number): Box {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x0, y0: baseline - LABEL.height + 3, x1: x0 + w, y1: baseline + 3 };
}
interface Candidate {
  x: number;
  y: number;
  anchor: LabelPlacement['anchor'];
  leader: boolean;
}
function candidates(item: LabelItem): Candidate[] {
  const mid = item.y - LAYOUT.stoneHeight / 2;
  const near = (x: number, y: number, anchor: LabelPlacement['anchor']): Candidate => ({ x, y, anchor, leader: false });
  const out: Candidate[] = [
    near(item.x + HALF + 6, mid + 4, 'start'),
    near(item.x - HALF - 6, mid + 4, 'end'),
    near(item.x, item.y - LAYOUT.stoneHeight - 9, 'middle'),
    near(item.x, item.y + 17, 'middle'),
  ];
  // Farther out, on a leader line: the four diagonals, then shallower and steeper slants, then straight right, left, up and down.
  // Straight up and down come last: a vertical leader can sit on the FCC line and hide there.
  const dirs = [1, -0.7, -1, -0.7, 1, 0.7, -1, 0.7, 1, -0.25, -1, -0.25, 1, 0.25, -1, 0.25, 1, 0, -1, 0, 0, -1, 0, 1];
  for (const r of LABEL.rings) {
    for (let k = 0; k < dirs.length; k += 2) {
      const [dx, dy] = [dirs[k]!, dirs[k + 1]!];
      const len = Math.hypot(dx, dy);
      out.push({ x: item.x + (dx / len) * r, y: mid + (dy / len) * r + 4, anchor: dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', leader: true });
    }
  }
  return out;
}
/**
 * Places every label. `stones` is every stone and bone that is drawn (not only the named ones). `bounds` is the
 * plot. Labels are placed in NORAD order, so the same input always gives the same result. A label that fits
 * nowhere is put on the candidate that overlaps least, and `unplaced` lists it.
 */
export function placeLabels(items: readonly LabelItem[], stones: readonly { x: number; y: number }[], bounds: Box): { placements: Map<number, LabelPlacement>; unplaced: number[] } {
  const obstacles: Box[] = stones.map((s) => stoneBox(s.x, s.y));
  const placements = new Map<number, LabelPlacement>();
  const unplaced: number[] = [];
  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    const w = labelWidth(item.name);
    const mid = item.y - LAYOUT.stoneHeight / 2;
    let best: LabelPlacement | null = null;
    let bestHits = Infinity;
    for (const c of candidates(item)) {
      const box = boxFor(c.x, c.y, c.anchor, w);
      if (!within(box, bounds)) continue;
      const hits = obstacles.filter((o) => intersects(box, o, LABEL.clear)).length;
      if (hits >= bestHits) continue;
      const lx = c.anchor === 'start' ? c.x - 2 : c.anchor === 'end' ? c.x + 2 : c.x;
      best = { id: item.id, x: c.x, y: c.y, anchor: c.anchor, box, leader: c.leader ? { x1: item.x, y1: mid, x2: lx, y2: c.y + (c.y < mid ? 2 : -6) } : null };
      bestHits = hits;
      if (hits === 0) break;
    }
    if (best === null || bestHits > 0) unplaced.push(item.id);
    best ??= { id: item.id, x: item.x, y: item.y, anchor: 'start', box: boxFor(item.x, item.y, 'start', w), leader: null };
    placements.set(item.id, best);
    obstacles.push(best.box);
  }
  return { placements, unplaced };
}
