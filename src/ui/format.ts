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
  const decimals = source === 'GP' ? 1 : 0;
  const shown = Number(p.toFixed(decimals));
  const crosses = edges.some((edge) => (p < edge && shown >= edge) || (p > edge && shown <= edge));
  return formatSigned(p, crosses ? 2 : decimals);
}

/** The same, for words: "plus 110.4", "minus 89.6". */
export function spokenKm(text: string): string {
  return text.replace('+', 'plus ').replace(MINUS, 'minus ');
}
