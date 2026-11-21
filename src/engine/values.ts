// Strict value checks shared by the parsers. Pure.

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const INTEGER = /^\d+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/** A finite number, or null. Blank, "NaN", "Infinity" and hex are null. */
export function parseNumber(text: string): number | null {
  const t = text.trim();
  if (!NUMBER.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A positive safe integer made only of digits, or null. */
export function parsePositiveInteger(text: string): number | null {
  const t = text.trim();
  if (!INTEGER.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

/** True for a real calendar date written YYYY-MM-DD. No Date object, no clock. */
export function isIsoDate(text: string): boolean {
  const m = ISO_DATE.exec(text);
  return m !== null && validDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** True for YYYY-MM-DDTHH:MM:SS with optional fraction, as in the GP EPOCH field. */
export function isIsoDateTime(text: string): boolean {
  const m = ISO_DATETIME.exec(text);
  return m !== null && validDay(Number(m[1]), Number(m[2]), Number(m[3]));
}
