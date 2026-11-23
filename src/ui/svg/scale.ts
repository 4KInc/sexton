// Churchyard scale and layout numbers. These are UI layout, not thresholds (design 5.4):
// every threshold comes from register.config.
import type { Config } from '../../engine/config.ts';

/**
 * The drawn range of p, in km above GEO (design 5.4). From minKm to linearMaxKm the scale is linear.
 * From linearMaxKm to maxKm ("high ground") it is compressed, with a break mark at linearMaxKm.
 * Objects above maxKm or below minKm are off-scale.
 */
export const SCALE = {
  minKm: -300,
  linearMaxKm: 400,
  maxKm: 1000,
  pxPerKm: 0.8,
  /** Height of the whole high-ground section. */
  highPx: 140,
  /** Log knee of the high-ground curve: y grows as ln(1 + d / highKneeKm), d km above linearMaxKm. */
  highKneeKm: 100,
  /** Height of the strip above maxKm and the strip below minKm, where off-scale stones stand. */
  edgePx: 44,
} as const;
/** Tick labels in the high ground, besides the break itself (+400) and the top limit. */
export const HIGH_TICKS_KM: readonly number[] = [500, 600, 800, 1000];
export const LAYOUT = {
  top: 40,
  bottom: 40,
  right: 16,
  gutterWide: 150,
  gutterNarrow: 46,
  /** Narrowest a year column gets. Columns grow with the lanes their stones need. */
  yearColumnMin: 12,
  unknownColumn: 56,
  stoneWidth: 10,
  stoneHeight: 14,
} as const;
const LOW_PX = (SCALE.linearMaxKm - SCALE.minKm) * SCALE.pxPerKm;
export const plotHeight = (): number => SCALE.edgePx + SCALE.highPx + LOW_PX + SCALE.edgePx;
/** Share 0..1 of the high-ground height reached by d km above the break. Strictly increasing. */
function highFraction(d: number): number {
  return Math.log(1 + d / SCALE.highKneeKm) / Math.log(1 + (SCALE.maxKm - SCALE.linearMaxKm) / SCALE.highKneeKm);
}
/** y of the +maxKm line, the top of the scale proper. */
export const yTopLimit = (): number => LAYOUT.top + SCALE.edgePx;
/** y of the break at linearMaxKm. */
export const yBreak = (): number => LAYOUT.top + SCALE.edgePx + SCALE.highPx;
/** y of p, clamped to the drawn range. Linear up to linearMaxKm, compressed above it. */
export function yOf(p: number): number {
  const clamped = Math.min(SCALE.maxKm, Math.max(SCALE.minKm, p));
  if (clamped >= SCALE.linearMaxKm) return yBreak() - highFraction(clamped - SCALE.linearMaxKm) * SCALE.highPx;
  return yBreak() + (SCALE.linearMaxKm - clamped) * SCALE.pxPerKm;
}
export function offScale(p: number): 'above' | 'below' | null {
  if (p > SCALE.maxKm) return 'above';
  if (p < SCALE.minKm) return 'below';
  return null;
}
/** How many of these perigees are off the drawn scale, per edge. */
export function offScaleCounts(ps: readonly number[]): { above: number; below: number } {
  let above = 0;
  let below = 0;
  for (const p of ps) {
    const side = offScale(p);
    if (side === 'above') above++;
    else if (side === 'below') below++;
  }
  return { above, below };
}
/** y of the base of a stone standing in an edge strip. */
export function edgeBaseY(side: 'above' | 'below'): number {
  return side === 'above' ? LAYOUT.top + SCALE.edgePx - 6 : LAYOUT.top + plotHeight() - SCALE.edgePx + 6 + LAYOUT.stoneHeight;
}
/** y of the stone's base for a perigee: its scale position, or the edge strip when off-scale. */
export function baseYOf(p: number): number {
  const side = offScale(p);
  return side === null ? yOf(p) : edgeBaseY(side);
}
/** Sway angle in degrees: 1 at e = eccentricityMax, 4 at e = 0.03, in proportion (design 5.4). */
export const SWAY = { fromE: 0.003, toE: 0.03, fromDeg: 1, toDeg: 4, seconds: 8 } as const;
export function swayAngle(e: number, config: Config): number | null {
  if (!(e > config.iadc.eccentricityMax)) return null;
  const t = (e - SWAY.fromE) / (SWAY.toE - SWAY.fromE);
  const deg = SWAY.fromDeg + t * (SWAY.toDeg - SWAY.fromDeg);
  return Math.min(SWAY.toDeg, Math.max(SWAY.fromDeg, Math.round(deg * 100) / 100));
}

/** Moss step 0 to 4 from whole years since launch. 0 is no moss (launch date unknown). */
export function mossStep(yearsSinceLaunch: number | null): 0 | 1 | 2 | 3 | 4 {
  if (yearsSinceLaunch === null) return 0;
  if (yearsSinceLaunch < 10) return 1;
  if (yearsSinceLaunch < 20) return 2;
  if (yearsSinceLaunch < 30) return 3;
  return 4;
}
/** Share of the stone's height that moss covers, by step. */
export const MOSS_COVERAGE = [0, 0.15, 0.3, 0.5, 0.75] as const;

export interface Column {
  /** First year in the column, or null for the "launch year unknown" column. */
  from: number | null;
  /** Last year in the column. */
  to: number | null;
  x: number;
  width: number;
}

export interface Columns {
  list: Column[];
  gutter: number;
  width: number;
  find: (year: number | null) => Column | undefined;
  /** x for a date inside a year: fraction 0..1 of the way through that year. */
  xOfYear: (year: number, fraction: number) => number | null;
}

/**
 * Year columns from the first to the last launch year. `widths` gives the width a column needs for its
 * stones (from the layout); a column with no entry gets the minimum.
 */
export function buildColumns(years: readonly (number | null)[], narrow: boolean, widths: ReadonlyMap<number | null, number> = new Map()): Columns {
  const known = years.filter((y): y is number => y !== null);
  const hasUnknown = years.some((y) => y === null);
  const gutter = narrow ? LAYOUT.gutterNarrow : LAYOUT.gutterWide;
  const list: Column[] = [];
  let x = gutter;
  if (hasUnknown) {
    const w = Math.max(LAYOUT.unknownColumn, widths.get(null) ?? 0);
    list.push({ from: null, to: null, x, width: w });
    x += w;
  }
  if (known.length > 0) {
    const min = Math.min(...known);
    const max = Math.max(...known);
    // One empty column at each end, so stones in the first and last year don't touch the edge.
    for (let year = min - 1; year <= max + 1; year++) {
      const w = Math.max(LAYOUT.yearColumnMin, widths.get(year) ?? 0);
      list.push({ from: year, to: year, x, width: w });
      x += w;
    }
  }
  const find = (year: number | null): Column | undefined =>
    list.find((c) => (year === null ? c.from === null : c.from !== null && year >= c.from && year <= c.to!));
  const xOfYear = (year: number, fraction: number): number | null => {
    const c = find(year);
    if (c === undefined || c.from === null) return null;
    const span = c.to! - c.from + 1;
    return c.x + ((year - c.from + fraction) / span) * c.width;
  };
  return { list, gutter, width: x + LAYOUT.right, find, xOfYear };
}

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;
/** How far through its year an ISO date is, 0..1. Day of the year in a non-leap year, over 365. */
export function yearFraction(isoDate: string): number {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return (DAYS_BEFORE_MONTH[month - 1]! + (day - 1)) / 365;
}
