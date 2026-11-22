// Churchyard scale and layout numbers. These are UI layout, not thresholds (design 5.4):
// every threshold comes from register.config.
import type { Config } from '../../engine/config.ts';

/** The drawn range of p, in km above GEO. */
export const SCALE = { minKm: -300, maxKm: 450, pxPerKm: 0.8 } as const;

export const LAYOUT = {
  top: 40,
  bottom: 40,
  right: 16,
  gutterWide: 150,
  gutterNarrow: 46,
  yearColumnWide: 22,
  /** A column covers this many years on a narrow screen. */
  narrowYears: 5,
  narrowColumn: 40,
  unknownColumn: 56,
  stoneWidth: 14,
  stoneHeight: 19,
  /** Space above the stone for an off-scale label, and its depth. */
  offScaleInset: 24,
} as const;

export const plotHeight = (): number => (SCALE.maxKm - SCALE.minKm) * SCALE.pxPerKm;

/** y of p, clamped to the drawn range. */
export function yOf(p: number): number {
  const clamped = Math.min(SCALE.maxKm, Math.max(SCALE.minKm, p));
  return LAYOUT.top + (SCALE.maxKm - clamped) * SCALE.pxPerKm;
}

export function offScale(p: number): 'above' | 'below' | null {
  if (p > SCALE.maxKm) return 'above';
  if (p < SCALE.minKm) return 'below';
  return null;
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

/** Stones in one column are spread over this many lanes, by NORAD id. */
export function laneOf(norad: number, lanes: number): number {
  return norad % lanes;
}

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

/** Year columns from the first to the last launch year, 5-year columns when narrow. */
export function buildColumns(years: readonly (number | null)[], narrow: boolean): Columns {
  const known = years.filter((y): y is number => y !== null);
  const hasUnknown = years.some((y) => y === null);
  const gutter = narrow ? LAYOUT.gutterNarrow : LAYOUT.gutterWide;
  const list: Column[] = [];
  let x = gutter;
  if (hasUnknown) {
    list.push({ from: null, to: null, x, width: LAYOUT.unknownColumn });
    x += LAYOUT.unknownColumn;
  }
  if (known.length > 0) {
    const min = Math.min(...known);
    const max = Math.max(...known);
    if (narrow) {
      const step = LAYOUT.narrowYears;
      for (let start = Math.floor(min / step) * step; start <= max; start += step) {
        list.push({ from: start, to: start + step - 1, x, width: LAYOUT.narrowColumn });
        x += LAYOUT.narrowColumn;
      }
    } else {
      // One empty column at each end, so stones in the first and last year don't touch the edge.
      for (let year = min - 1; year <= max + 1; year++) {
        list.push({ from: year, to: year, x, width: LAYOUT.yearColumnWide });
        x += LAYOUT.yearColumnWide;
      }
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
