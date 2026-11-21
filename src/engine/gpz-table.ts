// GPZ status table HTML to { norad, status } rows (design 2.1, 2.4, R1.3).
// String scanning, not a DOM. Tags are matched in lower case, as CelesTrak writes them.
// Pure. Never throws.
import { resolveDuplicates, sortRejections, unexpectedError } from './csv.ts';
import type { Rejection } from './types.ts';
import { parsePositiveInteger } from './values.ts';

export const GPZ_TABLE_SOURCE = 'table-gpz.csv';
const NORAD_HEADER = 'NORAD Catalog Number';
const STATUS_HEADER = 'Latest Data';

export interface GpzTableRow {
  norad: number;
  line: number;
  raw: string;
  /** First word of the "Latest Data" cell, for example "PAY-". Mapping is done in merge. */
  status: string;
}

export interface GpzTableParse {
  rows: GpzTableRow[];
  rejections: Rejection[];
}

const fileRejection = (reason: string): GpzTableParse => ({
  rows: [],
  rejections: [{ source: GPZ_TABLE_SOURCE, line: 0, reason }],
});

function cellText(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf('<', i);
    if (open < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open);
    const close = html.indexOf('>', open);
    if (close < 0) break;
    i = close + 1;
  }
  return out.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Text of each <tag ...>...</tag> in the chunk. An unclosed tag ends the scan. */
function cells(chunk: string, tag: string): string[] {
  const out: string[] = [];
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let i = 0;
  while (i < chunk.length) {
    const start = chunk.indexOf(open, i);
    if (start < 0) break;
    const next = chunk[start + open.length];
    if (next !== '>' && next !== ' ' && next !== '\n' && next !== '\t' && next !== '\r') {
      i = start + open.length;
      continue;
    }
    const gt = chunk.indexOf('>', start);
    if (gt < 0) break;
    const end = chunk.indexOf(close, gt);
    if (end < 0) break;
    out.push(cellText(chunk.slice(gt + 1, end)));
    i = end + close.length;
  }
  return out;
}

export function parseGpzTable(html: string): GpzTableParse {
  const rejections: Rejection[] = [];
  try {
    const headStart = html.indexOf('<thead');
    const headEnd = headStart < 0 ? -1 : html.indexOf('</thead>', headStart);
    if (headEnd < 0) return fileRejection('no table header found');
    const columns = cells(html.slice(headStart, headEnd), 'th');
    const iNorad = columns.indexOf(NORAD_HEADER);
    const iStatus = columns.indexOf(STATUS_HEADER);
    if (iNorad < 0 || iStatus < 0) {
      const missing = [iNorad < 0 ? NORAD_HEADER : '', iStatus < 0 ? STATUS_HEADER : ''].filter((s) => s !== '');
      return fileRejection(`missing required header: ${missing.join(', ')}`);
    }
    const bodyStart = html.indexOf('<tbody', headEnd);
    const bodyEnd = bodyStart < 0 ? -1 : html.indexOf('</tbody>', bodyStart);
    if (bodyEnd < 0) return fileRejection('no table body found');

    const body = html.slice(bodyStart, bodyEnd);
    const bodyOffset = bodyStart;
    const good: GpzTableRow[] = [];
    const rowTag = /<tr(?=[\s>])/g;
    const starts: number[] = [];
    for (let m = rowTag.exec(body); m !== null; m = rowTag.exec(body)) starts.push(m.index);
    let line = 1;
    let lineAt = 0;
    for (let k = 0; k < starts.length; k++) {
      const start = starts[k]!;
      const end = k + 1 < starts.length ? starts[k + 1]! : body.length;
      // Line number of the <tr in the whole file.
      const absolute = bodyOffset + start;
      for (let p = lineAt; p < absolute; p++) if (html[p] === '\n') line++;
      lineAt = absolute;
      const raw = body.slice(start, end).trim();
      try {
        const tds = cells(raw, 'td');
        if (tds.length !== columns.length) {
          rejections.push({
            source: GPZ_TABLE_SOURCE,
            line,
            reason: `wrong cell count: ${tds.length}, header has ${columns.length}`,
          });
          continue;
        }
        const norad = parsePositiveInteger(tds[iNorad]!);
        if (norad === null) {
          rejections.push({ source: GPZ_TABLE_SOURCE, line, reason: 'NORAD Catalog Number is missing or not a positive whole number' });
          continue;
        }
        const status = tds[iStatus]!.split(' ')[0]!;
        if (status === '') {
          rejections.push({ source: GPZ_TABLE_SOURCE, line, reason: 'Latest Data is empty' });
          continue;
        }
        good.push({ norad, line, raw, status });
      } catch (error) {
        rejections.push({ ...unexpectedError(GPZ_TABLE_SOURCE, error), line });
      }
    }
    // Duplicates: the smaller raw line wins.
    const rows = resolveDuplicates(good, GPZ_TABLE_SOURCE, (a, b) => a.raw < b.raw, rejections);
    return { rows, rejections: sortRejections(rejections) };
  } catch (error) {
    return { rows: [], rejections: [unexpectedError(GPZ_TABLE_SOURCE, error)] };
  }
}
