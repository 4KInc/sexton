// The table as CSV (F4): RFC 4180 quoting, a snapshot line, a header row, and every row of the current set, all pages.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { CSV_HEADER, csvField, csvFileName, csvLine, registerCsv, safeText } from '../src/ui/csv.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { parsePaging, parseState } from '../src/ui/state.ts';
import { orderRows, tablePage, viewOf } from '../src/ui/views/table.ts';
const ROOT = process.cwd();
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
/** A small RFC 4180 reader, for the round trip. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
describe('csvField', () => {
  it('leaves plain text alone and quotes commas, quotes, line breaks and edge spaces', () => {
    expect(csvField('ECHOSTAR 7')).toBe('ECHOSTAR 7');
    expect(csvField('INTELSAT 2-F2, A')).toBe('"INTELSAT 2-F2, A"');
    expect(csvField('ES\'HAIL "1"')).toBe('"ES\'HAIL ""1"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField(' lead')).toBe('" lead"');
    expect(csvField('')).toBe('');
  });
  it('property: any fields survive a write and a read', () => {
    fc.assert(fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 6 }), (fields) => {
      const fixed = fields.map((f) => f.replace(/\r/g, ''));
      expect(parseCsv(`${csvLine(fixed)}\r\n`)).toEqual([fixed]);
    }));
  });
  it('a text cell that a spreadsheet would read as a formula gets a leading apostrophe', () => {
    for (const s of ['=1+1', '+cmd', '-x', '@sum']) expect(safeText(s)).toBe(`'${s}`);
    expect(safeText('ECHOSTAR 7')).toBe('ECHOSTAR 7');
  });
});
describe('registerCsv', () => {
  const state = parseState(new URLSearchParams('bones=1&sort=name'));
  const { byDefault, shown } = viewOf(real.records, state.filters);
  const ordered = orderRows(shown, state.sort, byDefault && false);
  const text = registerCsv(ordered, real.config, real.snapshot.set);
  const rows = parseCsv(text);
  it('opens with the snapshot date, the assumptions and the limits, then the header row', () => {
    expect(rows[0]).toHaveLength(1);
    expect(rows[0]![0]).toMatch(/^Sexton register, CelesTrak snapshot 2026-11-22\. /);
    expect(rows[0]![0]).toContain('0.012');
    expect(rows[0]![0]).toContain('±25 km');
    expect(rows[0]![0]).toContain('The IADC guidelines are voluntary.');
    expect(rows[0]![0]).toContain('The register only sees objects still near GEO.');
    expect(rows[1]).toEqual([...CSV_HEADER]);
    expect(findHits(text, 'csv')).toEqual([]);
  });
  it('has every row of the set, all pages, in the order on screen, not only the current page', () => {
    expect(rows).toHaveLength(2 + 1764);
    expect(rows.slice(2).map((r) => Number(r[2]))).toEqual(ordered.map((r) => r.norad));
    expect(tablePage(shown, state.sort, false, parsePaging(new URLSearchParams('page=3'))).rows.length).toBe(50);
    expect(rows.slice(2).map((r) => r[0])).toEqual(ordered.map((_, i) => String(i + 1)));
    expect(text.endsWith('\r\n')).toBe(true);
  });
  it('quotes a name with a comma and keeps it whole; numbers are plain', () => {
    const r = real.records.find((x) => x.norad === 27378)!;
    const one = parseCsv(registerCsv([{ ...r, name: 'ECHOSTAR 7, "EAST"' }], real.config, '2026-11-22'));
    expect(one[2]![1]).toBe('ECHOSTAR 7, "EAST"');
    expect(one[2]!.slice(2, 12)).toEqual(['27378', 'US', '2002-02-21', 'Unquiet', 'No', '110.1', '137.1', '0.00032', 'GP', 'GP mean elements, epoch 2026-11-22 12:28 UTC']);
    expect(registerCsv([{ ...r, name: 'X, Y' }], real.config, 's')).toContain('"X, Y"');
    const neg = real.records.find((x) => x.pKm < 0 && x.orbitSource.kind === 'GP')!;
    const p = parseCsv(registerCsv([neg], real.config, 's'))[2]![7]!;
    expect(p).toMatch(/^-\d+\.\d$/);
  });
  it('is named after the snapshot', () => {
    expect(csvFileName('2026-11-22')).toBe('sexton-register-2026-11-22.csv');
  });
  it('the table\'s button downloads the current set in order, with a UTF-8 byte-order mark', () => {
    const src = readFileSync(join(ROOT, 'src/ui/views/table.ts'), 'utf8');
    expect(src).toContain('registerCsv(orderRows(shown, state.sort, byDefault && !sorted), config, reg.snapshot.set)');
    expect(src).toContain("new Blob(['\\uFEFF', text], { type: 'text/csv;charset=utf-8' })");
    expect(src).toContain('data-download-csv>${esc(TABLE.downloadCsv)}</button>');
  });
});
