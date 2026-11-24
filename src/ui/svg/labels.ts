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
  /** The label's text size, in chart units. */
  fontPx: 11,
  /** Width of one character, with room to spare. IM Fell English capitals run about 7 units at 11 px (measured in a browser: ECHOSTAR 7 is 70 units). */
  charW: 7.4,
  height: 12,
  /** How far outside a stone's own box a label must stay. */
  clear: 2,
  /** Distances for the leader-line candidates. */
  rings: [30, 46, 66, 92],
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
  const out: Candidate[] = [
    { x: item.x + HALF + 6, y: mid + 4, anchor: 'start', leader: false },
    { x: item.x - HALF - 6, y: mid + 4, anchor: 'end', leader: false },
    { x: item.x, y: item.y - LAYOUT.stoneHeight - 9, anchor: 'middle', leader: false },
    { x: item.x, y: item.y + 17, anchor: 'middle', leader: false },
  ];
  // Farther out, on a leader line: the four diagonals, then shallower and steeper slants, then straight up, down, right and left.
  // Straight up and down come last: a vertical leader can sit on the FCC line and hide there.
  const dirs: [number, number][] = [[1, -0.7], [-1, -0.7], [1, 0.7], [-1, 0.7], [1, -0.25], [-1, -0.25], [1, 0.25], [-1, 0.25], [1, -1.6], [-1, -1.6], [1, 1.6], [-1, 1.6], [1, 0], [-1, 0], [0, -1], [0, 1]];
  for (const r of LABEL.rings) {
    for (const [dx, dy] of dirs) {
      const len = Math.hypot(dx, dy);
      const x = item.x + (dx / len) * r;
      const y = mid + (dy / len) * r;
      out.push({ x, y: y + 4, anchor: dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', leader: true });
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
  const obstacles = stones.map((s) => stoneBox(s.x, s.y));
  const placements = new Map<number, LabelPlacement>();
  const unplaced: number[] = [];
  const taken: Box[] = [];
  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    const w = labelWidth(item.name);
    let chosen: LabelPlacement | null = null;
    let fallback: { p: LabelPlacement; score: number } | null = null;
    for (const c of candidates(item)) {
      const box = boxFor(c.x, c.y, c.anchor, w);
      if (!within(box, bounds)) continue;
      const hits = obstacles.filter((o) => intersects(box, o, LABEL.clear)).length + taken.filter((t) => intersects(box, t, LABEL.clear)).length;
      const leader = c.leader
        ? { x1: item.x, y1: item.y - LAYOUT.stoneHeight / 2, x2: c.anchor === 'start' ? c.x - 2 : c.anchor === 'end' ? c.x + 2 : c.x, y2: c.y - (c.y < item.y - LAYOUT.stoneHeight / 2 ? -2 : 6) }
        : null;
      const p: LabelPlacement = { id: item.id, x: c.x, y: c.y, anchor: c.anchor, box, leader };
      if (hits === 0) {
        chosen = p;
        break;
      }
      if (fallback === null || hits < fallback.score) fallback = { p, score: hits };
    }
    if (chosen === null) {
      unplaced.push(item.id);
      chosen = fallback?.p ?? { id: item.id, x: item.x, y: item.y, anchor: 'start', box: boxFor(item.x, item.y, 'start', w), leader: null };
    }
    placements.set(item.id, chosen);
    taken.push(chosen.box);
  }
  return { placements, unplaced };
}
