// Stone layout inside the year columns, and the keyboard order (design 5.4). Pure code, no DOM.
// A stone's height is its perigee, so the layout never moves a stone up or down. It only moves it
// sideways, into lanes inside its launch-year column. No randomness: the order is y, then NORAD id.
import { LAYOUT } from './scale.ts';
export const PACK = {
  /** Distance between lane centres. One unit more than a stone is wide, so neighbouring lanes do not touch. */
  pitch: LAYOUT.stoneWidth + 1,
  /** Most lanes in one column. A crowded year keeps the chart's width in check at the cost of some overlap. */
  maxLanes: 3,
  /** When every lane is taken, a stone shifts sideways by this much for each stone it overlaps in its lane. */
  overflowShift: 4,
  /** Space left in a column on each side of its stones. */
  pad: 0.5,
} as const;
export interface PlaceItem {
  id: number;
  /** The launch-year column: a year, or null for "launch year unknown". */
  column: number | null;
  /** y of the stone's base. */
  y: number;
}
export interface Placed {
  id: number;
  column: number | null;
  /** Offset from the middle of the column. */
  dx: number;
  y: number;
  lane: number;
}
export interface LayoutResult {
  placed: Map<number, Placed>;
  /** The width each column needs. */
  widths: Map<number | null, number>;
}
const SAME_SPOT_STEP = 1.5;
/** Places stones into lanes, column by column. Deterministic: the same items always give the same result. */
export function layoutStones(items: readonly PlaceItem[], height: number = LAYOUT.stoneHeight): LayoutResult {
  const groups = new Map<number | null, PlaceItem[]>();
  for (const item of items) {
    const g = groups.get(item.column);
    if (g === undefined) groups.set(item.column, [item]);
    else g.push(item);
  }
  const placed = new Map<number, Placed>();
  const widths = new Map<number | null, number>();
  for (const [column, group] of groups) {
    group.sort((a, b) => a.y - b.y || a.id - b.id);
    const lanes: number[][] = [];
    const rows: { item: PlaceItem; lane: number; shift: number }[] = [];
    const conflicts = (lane: number, y: number): number => lanes[lane]!.filter((ly) => Math.abs(ly - y) < height).length;
    for (const item of group) {
      let lane = -1;
      for (let l = 0; l < lanes.length; l++) {
        if (conflicts(l, item.y) === 0) {
          lane = l;
          break;
        }
      }
      let shift = 0;
      if (lane < 0 && lanes.length < PACK.maxLanes) {
        lane = lanes.length;
        lanes.push([]);
      } else if (lane < 0) {
        // Every lane is taken here: use the one with the fewest overlaps, and shift sideways.
        let best = 0;
        for (let l = 1; l < lanes.length; l++) if (conflicts(l, item.y) < conflicts(best, item.y)) best = l;
        lane = best;
        shift = conflicts(lane, item.y) * PACK.overflowShift;
      }
      lanes[lane]!.push(item.y);
      rows.push({ item, lane, shift });
    }
    const centre = (lanes.length - 1) / 2;
    const taken = new Set<string>();
    let reach = 0;
    for (const { item, lane, shift } of rows) {
      let dx = (lane - centre) * PACK.pitch + shift;
      // Two stones never share a position: nudge sideways until the spot is free.
      while (taken.has(`${dx.toFixed(2)}|${item.y.toFixed(2)}`)) dx += SAME_SPOT_STEP;
      taken.add(`${dx.toFixed(2)}|${item.y.toFixed(2)}`);
      reach = Math.max(reach, Math.abs(dx));
      placed.set(item.id, { id: item.id, column, dx, y: item.y, lane });
    }
    widths.set(column, 2 * reach + LAYOUT.stoneWidth + 2 * PACK.pad);
  }
  return { placed, widths };
}
export interface BoxPos {
  x: number;
  y: number;
}
/** Stones whose boxes (width × height, base at y) share area. Counts the stones touched and the pairs. */
export function countOverlaps(boxes: readonly BoxPos[], width: number = LAYOUT.stoneWidth, height: number = LAYOUT.stoneHeight): { stones: number; pairs: number } {
  const hit = new Set<number>();
  let pairs = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (Math.abs(a.x - b.x) < width && Math.abs(a.y - b.y) < height) {
        pairs++;
        hit.add(i);
        hit.add(j);
      }
    }
  }
  return { stones: hit.size, pairs };
}
// Keyboard order. The chart is one Tab stop; arrow keys move between stones.
export interface NavItem {
  id: number;
  /** Index of the column in the drawn column list. */
  col: number;
  y: number;
  dx: number;
}
/** Left to right by column, then top to bottom, then left to right. */
export function navSort(items: readonly NavItem[]): NavItem[] {
  return [...items].sort((a, b) => a.col - b.col || a.y - b.y || a.dx - b.dx || a.id - b.id);
}
export const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'] as const;
/**
 * The stone that `key` moves to from `current`, or null when the key does nothing.
 * `sorted` comes from navSort. Left and right go to the next column that has stones, to the stone
 * at the nearest height. Up and down move within the column. Home and End go to the first and last stone.
 */
export function nextInNav(sorted: readonly NavItem[], current: number | null, key: string): number | null {
  if (sorted.length === 0) return null;
  const at = current === null ? -1 : sorted.findIndex((n) => n.id === current);
  if (at < 0) return key === 'End' ? sorted[sorted.length - 1]!.id : sorted[0]!.id;
  const here = sorted[at]!;
  switch (key) {
    case 'Home':
      return sorted[0]!.id;
    case 'End':
      return sorted[sorted.length - 1]!.id;
    case 'ArrowDown': {
      const next = sorted[at + 1];
      return next !== undefined && next.col === here.col ? next.id : null;
    }
    case 'ArrowUp': {
      const prev = sorted[at - 1];
      return prev !== undefined && prev.col === here.col ? prev.id : null;
    }
    case 'ArrowRight':
    case 'ArrowLeft': {
      const dir = key === 'ArrowRight' ? 1 : -1;
      const cols = sorted.map((n) => n.col).filter((c) => (c - here.col) * dir > 0);
      if (cols.length === 0) return null;
      const target = dir === 1 ? Math.min(...cols) : Math.max(...cols);
      let best: NavItem | null = null;
      for (const n of sorted) {
        if (n.col !== target) continue;
        if (best === null || Math.abs(n.y - here.y) < Math.abs(best.y - here.y)) best = n;
      }
      return best === null ? null : best.id;
    }
    default:
      return null;
  }
}
