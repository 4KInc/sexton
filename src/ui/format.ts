// Number formatting for the UI. Pure.
// Rounding happens only here (design 2.6): the register keeps full precision.

export const MINUS = '\u2212';

/** 1914 -> "1,914", 110.4 -> "110.4". Takes a non-negative number. */
function group(abs: number, decimals: number): string {
  const [whole, frac] = abs.toFixed(decimals).split('.') as [string, string | undefined];
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** "+110.4", "\u221289.6", "0.0". Uses the true minus sign. */
export function formatSigned(value: number, decimals: number): string {
  const text = group(Math.abs(value), decimals);
  const isZero = Number(Math.abs(value).toFixed(decimals)) === 0;
  if (isZero) return text;
  return (value < 0 ? MINUS : '+') + text;
}

/**
 * Perigee above GEO as text (design 5.6). GP orbits are shown to 0.1 km, SATCAT to whole km.
 * If rounding would put the shown value on the other side of a band edge, or on the edge itself
 * while the true value is not, it is shown to 2 decimals instead (199.96 is not shown as 200.0).
 */
export function formatP(p: number, source: 'GP' | 'SATCAT', edges: readonly number[]): string {
  const base = source === 'GP' ? 1 : 0;
  const crosses = (decimals: number): boolean => {
    const shown = Number(p.toFixed(decimals));
    return edges.some((edge) => (p < edge && shown >= edge) || (p > edge && shown <= edge));
  };
  return formatSigned(p, crosses(base) ? decimalsWhile(2, 6, crosses) : base);
}
/** The first number of decimals from `from` up to `max` for which `bad` is false (else `max`). */
function decimalsWhile(from: number, max: number, bad: (decimals: number) => boolean): number {
  let d = from;
  while (d < max && bad(d)) d++;
  return d;
}
/**
 * Eccentricity as text, to 5 decimals. If rounding would put the shown value on the other side of
 * the limit (0.003004 shown as 0.00300), more decimals are shown until it is on the right side.
 */
export function formatE(e: number, limit: number): string {
  const wrong = (decimals: number): boolean => {
    const shown = Number(e.toFixed(decimals));
    return e > limit ? shown <= limit : shown > limit;
  };
  return e.toFixed(decimalsWhile(5, 9, wrong));
}
/**
 * A distance from a band edge, always positive, for a sentence such as "136.6 km below 247 km".
 * A value that rounds to 0 but is not 0 is shown with more decimals, so it never reads as "on the edge".
 */
export function formatGap(margin: number, base: number): string {
  const abs = Math.abs(margin);
  const zero = (decimals: number): boolean => abs > 0 && Number(abs.toFixed(decimals)) === 0;
  return group(abs, zero(base) ? decimalsWhile(2, 8, zero) : base);
}
/** The same, for words: "plus 110.4", "minus 89.6". */
export function spokenKm(text: string): string {
  return text.replace('+', 'plus ').replace(MINUS, 'minus ');
}

/** 67607 -> "67,607". For counts. */
export function formatCount(n: number): string {
  return group(Math.abs(n), 0).replace(/^/, n < 0 ? MINUS : '');
}
/**
 * A share with its denominator, always: "280 of 696 (40.2%)". The percentage is to 0.1. A share that is
 * not 0 or 100 is never shown as 0.0% or 100.0% ("<0.1%", ">99.9%"), and an empty population shows no percentage.
 */
export function formatShare(n: number, of: number): string {
  const head = `${formatCount(n)} of ${formatCount(of)}`;
  if (of <= 0) return head;
  const pct = (100 * n) / of;
  const shown = pct.toFixed(1);
  if (n > 0 && n < of && Number(shown) === 0) return `${head} (<0.1%)`;
  if (n > 0 && n < of && Number(shown) === 100) return `${head} (>99.9%)`;
  return `${head} (${shown}%)`;
}
