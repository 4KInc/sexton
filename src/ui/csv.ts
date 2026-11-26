// The table as CSV (F4): every row of the current filtered and sorted set, all pages. Pure, so the quoting is tested.
import type { Config } from '../engine/config.ts';
import type { SatRecord } from '../engine/types.ts';
import { assumptionsLine, CHURCHYARD_INTRO, dataAge, TABLE, verdictCopy } from './copy.ts';
/** One CSV field (RFC 4180): quoted when it holds a comma, a quote, a line break or edge spaces; quotes doubled. */
export function csvField(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
/**
 * A text cell a spreadsheet might read as a formula (starting with =, +, -, @, tab or carriage return) gets a leading
 * apostrophe, so opening the file never runs anything. Numbers are written as plain numbers and are not touched.
 */
export function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
export const csvLine = (fields: readonly string[]): string => fields.map(csvField).join(',');
/** Plain numbers for a spreadsheet: an ASCII minus, no plus sign, no grouping. */
const num = (n: number, decimals: number): string => n.toFixed(decimals);
export const CSV_HEADER = [
  'Row',
  TABLE.columns.name,
  TABLE.columns.norad,
  TABLE.columns.owner,
  TABLE.columns.launch,
  TABLE.columns.verdict,
  TABLE.columns.borderline,
  TABLE.columns.p,
  TABLE.columns.q,
  TABLE.columns.e,
  TABLE.columns.source,
  TABLE.columns.age,
] as const;
/** The verdict word, or the reason there is none, as plain text. */
function verdictText(r: SatRecord, config: Config): string {
  const v = r.verdict;
  if (v.kind === 'verdict') return verdictCopy(v.verdict, config).word;
  if (v.kind === 'unmarked bones') return TABLE.bones(r.status);
  return TABLE.noVerdict(v.reason);
}
/**
 * The file: a first line with the snapshot date, the assumptions and the limits, then a header row, then one line per
 * object in the order given. Lines end in CRLF, as RFC 4180 asks.
 */
export function registerCsv(rows: readonly SatRecord[], config: Config, snapshot: string): string {
  const note = `Sexton register, CelesTrak snapshot ${snapshot}. ${assumptionsLine(config)} ${CHURCHYARD_INTRO.voluntary} ${CHURCHYARD_INTRO.blindSpot}`;
  const lines = [
    csvLine([note]),
    csvLine(CSV_HEADER),
    ...rows.map((r, i) => {
      const v = r.verdict;
      const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
      return csvLine([
        String(i + 1),
        safeText(r.name),
        String(r.norad),
        safeText(r.owner ?? TABLE.unknown),
        r.launchDate ?? TABLE.unknown,
        verdictText(r, config),
        v.kind === 'verdict' ? (v.borderline ? TABLE.yes : TABLE.no) : TABLE.notApplicable,
        num(r.pKm, decimals),
        num(r.qKm, decimals),
        r.e.toFixed(5),
        r.orbitSource.kind,
        dataAge(r),
      ]);
    }),
  ];
  return `${lines.join('\r\n')}\r\n`;
}
/** "sexton-register-2026-11-22.csv". */
export const csvFileName = (snapshot: string): string => `sexton-register-${snapshot.replace(/[^0-9A-Za-z-]/g, '')}.csv`;
