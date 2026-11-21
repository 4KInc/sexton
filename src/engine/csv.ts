// RFC 4180 CSV reader (design 2.1). Quoted fields, "" escapes, CRLF and LF.
// Never throws. Pure.
import type { Rejection } from './types.ts';

export interface CsvRow {
  /** 1-based physical line where the row starts. */
  line: number;
  /** The row's source text, without its line break. */
  raw: string;
  fields: string[];
}

/** Splits text into rows. Fully blank lines are skipped. A leading BOM is ignored. */
export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let atFieldStart = true;
  let rowStart = 0;
  let rowLine = 1;
  let line = 1;

  const endRow = (end: number): void => {
    fields.push(field);
    const raw = text.slice(rowStart, end);
    if (!(fields.length === 1 && fields[0] === '' && raw.trim() === '')) {
      rows.push({ line: rowLine, raw, fields });
    }
    fields = [];
    field = '';
    atFieldStart = true;
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
      i++;
      continue;
    }
    if (c === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
      i++;
    } else if (c === ',') {
      fields.push(field);
      field = '';
      atFieldStart = true;
      i++;
    } else if (c === '\n' || c === '\r') {
      endRow(i);
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
      line++;
      rowStart = i;
      rowLine = line;
    } else {
      field += c;
      atFieldStart = false;
      i++;
    }
  }
  if (rowStart < text.length) endRow(text.length);
  return rows;
}

export type ColumnLookup = { ok: true; index: Record<string, number> } | { ok: false; missing: string[] };

/** Finds required columns by header name (trimmed, first match wins). */
export function findColumns(header: string[], required: readonly string[]): ColumnLookup {
  const names = header.map((h) => h.trim());
  const index: Record<string, number> = {};
  const missing: string[] = [];
  for (const name of required) {
    const at = names.indexOf(name);
    if (at < 0) missing.push(name);
    else index[name] = at;
  }
  return missing.length > 0 ? { ok: false, missing } : { ok: true, index };
}

/** The one file-level rejection for a missing header (design 2.4). */
export function missingHeaderRejection(source: string, line: number, missing: string[]): Rejection {
  return { source, line, reason: `missing required header: ${missing.join(', ')}` };
}

export interface Candidate {
  norad: number;
  line: number;
  raw: string;
}

/**
 * Keeps one candidate per NORAD id, by a rule that doesn't depend on row order.
 * `isBetter(a, b)` must be a strict order. Ties on `raw` fall back to the lower line.
 * Losers become "duplicate NORAD id" rejections. Winners come back sorted by NORAD id.
 */
export function resolveDuplicates<T extends Candidate>(
  items: T[],
  source: string,
  isBetter: (a: T, b: T) => boolean,
  rejections: Rejection[],
): T[] {
  const best = new Map<number, T>();
  const lost: T[] = [];
  for (const item of items) {
    const current = best.get(item.norad);
    if (current === undefined) {
      best.set(item.norad, item);
    } else if (isBetter(item, current) || (!isBetter(current, item) && item.line < current.line)) {
      best.set(item.norad, item);
      lost.push(current);
    } else {
      lost.push(item);
    }
  }
  for (const item of lost) {
    rejections.push({ source, line: item.line, reason: `duplicate NORAD id ${item.norad}` });
  }
  return [...best.values()].sort((a, b) => a.norad - b.norad);
}

export function sortRejections(rejections: Rejection[]): Rejection[] {
  return rejections.sort((a, b) => a.line - b.line || (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0));
}

export function unexpectedError(source: string, error: unknown): Rejection {
  return { source, line: 0, reason: `unexpected error: ${error instanceof Error ? error.message : String(error)}` };
}
