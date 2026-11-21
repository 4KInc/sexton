import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { parseCsv } from '../src/engine/csv.ts';
import { parseGp } from '../src/engine/gp.ts';
import { parseGpzTable } from '../src/engine/gpz-table.ts';
import { parseSatcat } from '../src/engine/satcat.ts';
import { isIsoDate, parseNumber } from '../src/engine/values.ts';

const FIX = new URL('./fixtures/snapshot/', import.meta.url);
const read = (f: string): string => readFileSync(new URL(f, FIX), 'utf8');

const SATCAT_HEADER =
  'OBJECT_NAME,OBJECT_ID,NORAD_CAT_ID,OBJECT_TYPE,OPS_STATUS_CODE,OWNER,LAUNCH_DATE,LAUNCH_SITE,DECAY_DATE,PERIOD,INCLINATION,APOGEE,PERIGEE,RCS,DATA_STATUS_CODE,ORBIT_CENTER,ORBIT_TYPE';
const satcatRow = (o: Record<string, string> = {}): string => {
  const v = {
    name: 'TEST', des: '2000-001A', norad: '100', type: 'PAY', ops: '-', owner: 'US', launch: '2000-01-01',
    decay: '', apogee: '36100', perigee: '36090', center: 'EA', ...o,
  };
  return `${v.name},${v.des},${v.norad},${v.type},${v.ops},${v.owner},${v.launch},SITE,${v.decay},1436,0.5,${v.apogee},${v.perigee},,,${v.center},GEO`;
};
const satcat = (...rows: string[]): string => [SATCAT_HEADER, ...rows].join('\n') + '\n';

const GP_HEADER =
  'OBJECT_NAME,OBJECT_ID,EPOCH,MEAN_MOTION,ECCENTRICITY,INCLINATION,RA_OF_ASC_NODE,ARG_OF_PERICENTER,MEAN_ANOMALY,EPHEMERIS_TYPE,CLASSIFICATION_TYPE,NORAD_CAT_ID,ELEMENT_SET_NO,REV_AT_EPOCH,BSTAR,MEAN_MOTION_DOT,MEAN_MOTION_DDOT';
const gpRow = (o: Record<string, string> = {}): string => {
  const v = { epoch: '2026-11-20T12:00:00.000000', n: '1.00270000', e: '.0005', norad: '100', ...o };
  return `TEST,2000-001A,${v.epoch},${v.n},${v.e},0.5,0,0,0,0,U,${v.norad},999,1,0,0,0`;
};
const gp = (...rows: string[]): string => [GP_HEADER, ...rows].join('\n') + '\n';

describe('csv', () => {
  it('reads quoted commas, escaped quotes, CRLF and a BOM', () => {
    const rows = parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n');
    expect(rows.map((r) => r.fields)).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
    expect(rows[1]!.line).toBe(2);
  });
  it('keeps a newline inside quotes in one row and counts physical lines', () => {
    const rows = parseCsv('a,b\n"x\ny",z\nc,d\n');
    expect(rows.map((r) => r.fields)).toEqual([['a', 'b'], ['x\ny', 'z'], ['c', 'd']]);
    expect(rows[2]!.line).toBe(4);
  });
  it('skips blank lines and survives an unterminated quote', () => {
    expect(parseCsv('a\n\n\nb\n').length).toBe(2);
    expect(() => parseCsv('a,"b')).not.toThrow();
  });
});

describe('values', () => {
  it('parseNumber is strict', () => {
    expect(parseNumber('.00061392')).toBe(0.00061392);
    expect(parseNumber('-.22E-6')).toBe(-0.22e-6);
    for (const bad of ['', ' ', 'abc', 'NaN', 'Infinity', '0x10', '1,5', '1 2']) expect(parseNumber(bad)).toBeNull();
  });
  it('isIsoDate checks the calendar', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    for (const bad of ['2023-02-29', '2002-13-01', '2002-00-10', '2002/03/18', '02-03-18', '']) expect(isIsoDate(bad)).toBe(false);
  });
});

describe('SATCAT parser: rejections, one example per reason', () => {
  const reasonFor = (row: string): string => {
    const out = parseSatcat(satcat(row));
    expect(out.rows).toEqual([]);
    expect(out.rejections.length).toBe(1);
    expect(out.rejections[0]!.source).toBe('satcat.csv');
    expect(out.rejections[0]!.line).toBe(2);
    return out.rejections[0]!.reason;
  };
  it('wrong field count', () => expect(reasonFor('TEST,2000-001A,100,PAY')).toMatch(/wrong field count/));
  it('missing NORAD id', () => expect(reasonFor(satcatRow({ norad: '' }))).toMatch(/NORAD_CAT_ID/));
  it('non-numeric NORAD id', () => expect(reasonFor(satcatRow({ norad: '12ab' }))).toMatch(/NORAD_CAT_ID/));
  it('non-numeric APOGEE', () => expect(reasonFor(satcatRow({ apogee: 'high' }))).toMatch(/APOGEE is not a number/));
  it('non-numeric PERIGEE', () => expect(reasonFor(satcatRow({ perigee: 'low' }))).toMatch(/PERIGEE is not a number/));
  it('APOGEE below PERIGEE', () => expect(reasonFor(satcatRow({ apogee: '36000', perigee: '36100' }))).toMatch(/below PERIGEE/));
  it('bad LAUNCH_DATE', () => expect(reasonFor(satcatRow({ launch: '2000/01/01' }))).toMatch(/LAUNCH_DATE/));
  it('bad DECAY_DATE', () => expect(reasonFor(satcatRow({ decay: '2020-02-30' }))).toMatch(/DECAY_DATE/));
  it('eccentricity out of range', () =>
    expect(reasonFor(satcatRow({ apogee: '100', perigee: '-7000' }))).toMatch(/eccentricity/));
  it('duplicate NORAD id: the smaller raw line wins, whatever the order', () => {
    const a = satcatRow({ name: 'AAA', apogee: '36100' });
    const b = satcatRow({ name: 'BBB', apogee: '36200' });
    for (const text of [satcat(a, b), satcat(b, a)]) {
      const out = parseSatcat(text);
      expect(out.rows.map((r) => r.name)).toEqual(['AAA']);
      expect(out.rejections.map((r) => r.reason)).toEqual(['duplicate NORAD id 100']);
    }
  });
  it('a missing header gives one file-level rejection and no rows', () => {
    const out = parseSatcat(SATCAT_HEADER.replace('PERIGEE', 'PERI') + '\n' + satcatRow() + '\n');
    expect(out.rows).toEqual([]);
    expect(out.rejections).toHaveLength(1);
    expect(out.rejections[0]!.reason).toMatch(/missing required header: PERIGEE/);
  });
  it('an empty file gives one rejection', () => {
    expect(parseSatcat('').rejections).toHaveLength(1);
  });
});

describe('SATCAT parser: accepted rows', () => {
  it('reads the quoted name with a comma', () => {
    const out = parseSatcat(satcat(satcatRow({ name: '"QUOTED, NAME"' })));
    expect(out.rejections).toEqual([]);
    expect(out.rows[0]!.name).toBe('QUOTED, NAME');
  });
  it('finds columns by header name, not position', () => {
    const swapped = SATCAT_HEADER.replace('APOGEE,PERIGEE', 'PERIGEE,APOGEE');
    const out = parseSatcat(`${swapped}\n${satcatRow({ apogee: '36100', perigee: '36090' })}\n`);
    // Header order now says the first number is PERIGEE: 36100, second is APOGEE: 36090.
    expect(out.rows).toEqual([]);
    expect(out.rejections[0]!.reason).toMatch(/below PERIGEE/);
  });
  it('blank APOGEE or PERIGEE counts as no orbit data and is not rejected', () => {
    const out = parseSatcat(satcat(satcatRow({ norad: '1', apogee: '' }), satcatRow({ norad: '2', perigee: '' }), satcatRow({ norad: '3' })));
    expect(out.noOrbitDataCount).toBe(2);
    expect(out.rejections).toEqual([]);
    expect(out.rows.map((r) => r.norad)).toEqual([3]);
  });
  it('blank dates become null', () => {
    const out = parseSatcat(satcat(satcatRow({ launch: '' })));
    expect(out.rows[0]!.launchDate).toBeNull();
    expect(out.rows[0]!.decayDate).toBeNull();
  });
});

describe('SATCAT parser on the fixture', () => {
  const out = parseSatcat(read('satcat.csv'));
  it('counts rows, rejections and no-orbit-data rows', () => {
    expect(out.rows).toHaveLength(36);
    expect(out.noOrbitDataCount).toBe(2);
    expect(out.rejections.map((r) => r.reason.split(/[:\s]/)[0])).toHaveLength(6);
  });
  it('keeps the first of the duplicate NORAD ids', () => {
    expect(out.rows.find((r) => r.norad === 90002)!.name).toBe('FIXTURE BURIED');
    expect(out.rejections.filter((r) => /duplicate NORAD id 90002/.test(r.reason))).toHaveLength(1);
  });
  it('reads the quoted comma name', () => {
    expect(out.rows.find((r) => r.norad === 90020)!.name).toBe('FIXTURE QUOTED, NAME');
  });
  it('keeps the blank-launch-date 2002-006A row with a null launch date', () => {
    const row = out.rows.find((r) => r.norad === 90033)!;
    expect(row.launchDate).toBeNull();
    expect(row.intlDes).toBe('2002-006A');
  });
});

describe('GP parser', () => {
  const reasonFor = (row: string): string => {
    const out = parseGp(gp(row));
    expect(out.rows).toEqual([]);
    expect(out.rejections).toHaveLength(1);
    expect(out.rejections[0]!.line).toBe(2);
    return out.rejections[0]!.reason;
  };
  it('reads a row', () => {
    const out = parseGp(gp(gpRow()));
    expect(out.rows[0]).toMatchObject({ norad: 100, meanMotion: 1.0027, e: 0.0005, epoch: '2026-11-20T12:00:00.000000' });
  });
  it('wrong field count', () => expect(reasonFor('TEST,2000-001A,2026-11-20T12:00:00')).toMatch(/wrong field count/));
  it('bad NORAD id', () => expect(reasonFor(gpRow({ norad: 'x' }))).toMatch(/NORAD_CAT_ID/));
  it('bad EPOCH', () => expect(reasonFor(gpRow({ epoch: '2026-11-20' }))).toMatch(/EPOCH/));
  it('non-numeric MEAN_MOTION', () => expect(reasonFor(gpRow({ n: 'fast' }))).toMatch(/MEAN_MOTION is not a number/));
  it('MEAN_MOTION of 0 or below', () => {
    expect(reasonFor(gpRow({ n: '0' }))).toMatch(/not above 0/);
    expect(reasonFor(gpRow({ n: '-1' }))).toMatch(/not above 0/);
  });
  it('non-numeric ECCENTRICITY', () => expect(reasonFor(gpRow({ e: '' }))).toMatch(/ECCENTRICITY is not a number/));
  it('ECCENTRICITY below 0 or at 1', () => {
    expect(reasonFor(gpRow({ e: '-0.1' }))).toMatch(/ECCENTRICITY is outside/);
    expect(reasonFor(gpRow({ e: '1' }))).toMatch(/ECCENTRICITY is outside/);
  });
  it('duplicate NORAD id: the newer EPOCH wins, whatever the order', () => {
    const older = gpRow({ epoch: '2026-11-19T12:00:00.000000', n: '1.0020' });
    const newer = gpRow({ epoch: '2026-11-20T12:00:00.000000', n: '1.0030' });
    for (const text of [gp(older, newer), gp(newer, older)]) {
      const out = parseGp(text);
      expect(out.rows.map((r) => r.meanMotion)).toEqual([1.003]);
      expect(out.rejections.map((r) => r.reason)).toEqual(['duplicate NORAD id 100']);
    }
  });
  it('duplicate NORAD id with the same EPOCH: the smaller raw line wins', () => {
    const a = gpRow({ n: '1.0020' });
    const b = gpRow({ n: '1.0030' });
    for (const text of [gp(a, b), gp(b, a)]) expect(parseGp(text).rows.map((r) => r.meanMotion)).toEqual([1.002]);
  });
  it('missing header', () => {
    const out = parseGp(GP_HEADER.replace('ECCENTRICITY', 'ECC') + '\n' + gpRow() + '\n');
    expect(out.rows).toEqual([]);
    expect(out.rejections[0]!.reason).toMatch(/missing required header: ECCENTRICITY/);
  });
  it('reads the committed GPZ file with no rejections', () => {
    const out = parseGp(readFileSync(new URL('../data/raw/2026-11-20/gpz.csv', import.meta.url), 'utf8'));
    expect(out.rejections).toEqual([]);
    expect(out.rows).toHaveLength(863);
  });
});

const tableHtml = (rows: string[], head = ['International Designator', 'NORAD Catalog Number', 'Name', 'Latest Data']): string =>
  `<html><table id="tableID">\n<thead>\n<tr class=header>\n${head.map((h) => `<th class=small>${h}</th>`).join('\n')}\n</tr>\n</thead>\n<tbody>\n${rows.join('\n')}\n</tbody></table></html>`;
const tableRow = (norad: string, status: string, des = '2000-001A'): string =>
  `<tr align=center>\n<td class=small>${des} <a href="x">i</a></td> <td class=small>${norad}</td>\n<td class=small>NAME</td>\n<td class=small>${status} <a href="y">file</a> <a>*G</a></td>\n</tr>`;

describe('GPZ table parser', () => {
  it('reads the NORAD id and the first word of Latest Data', () => {
    const out = parseGpzTable(tableHtml([tableRow('634', 'PAY-'), tableRow('1317', 'R/B'), tableRow('5', 'DEB'), tableRow('6', 'PAY+')]));
    expect(out.rejections).toEqual([]);
    expect(out.rows.map((r) => [r.norad, r.status])).toEqual([[5, 'DEB'], [6, 'PAY+'], [634, 'PAY-'], [1317, 'R/B']]);
  });
  it('finds columns by header name', () => {
    const html = tableHtml(
      ['<tr><td>PAY+ <a>x</a></td><td>777</td></tr>'],
      ['Latest Data', 'NORAD Catalog Number'],
    );
    expect(parseGpzTable(html).rows.map((r) => [r.norad, r.status])).toEqual([[777, 'PAY+']]);
  });
  it('wrong cell count', () => {
    const out = parseGpzTable(tableHtml(['<tr><td>a</td><td>1</td></tr>']));
    expect(out.rows).toEqual([]);
    expect(out.rejections[0]!.reason).toMatch(/wrong cell count/);
  });
  it('bad NORAD id', () => {
    const out = parseGpzTable(tableHtml([tableRow('abc', 'PAY-')]));
    expect(out.rejections[0]!.reason).toMatch(/NORAD Catalog Number/);
  });
  it('empty Latest Data', () => {
    const out = parseGpzTable(tableHtml(['<tr><td>1999-001A</td><td>9</td><td>N</td><td> </td></tr>']));
    expect(out.rejections[0]!.reason).toMatch(/Latest Data is empty/);
  });
  it('rejection line is the line of the row in the file', () => {
    const html = tableHtml([tableRow('1', 'PAY-'), tableRow('x', 'PAY-')]);
    const bad = parseGpzTable(html).rejections[0]!;
    expect(html.split('\n')[bad.line - 1]).toMatch(/^<tr/);
    expect(bad.line).toBe(html.split('\n').findLastIndex((l) => l.startsWith('<tr')) + 1);
  });
  it('duplicate NORAD id: the smaller raw line wins, whatever the order', () => {
    const a = tableRow('9', 'PAY-', '1999-001A');
    const b = tableRow('9', 'PAY+', '2000-001A');
    for (const rows of [[a, b], [b, a]]) {
      const out = parseGpzTable(tableHtml(rows));
      expect(out.rows.map((r) => r.status)).toEqual(['PAY-']);
      expect(out.rejections.map((r) => r.reason)).toEqual(['duplicate NORAD id 9']);
    }
  });
  it('missing header or no table gives one file-level rejection', () => {
    expect(parseGpzTable(tableHtml([], ['Name'])).rejections[0]!.reason).toMatch(/missing required header/);
    expect(parseGpzTable('<p>maintenance</p>').rejections[0]!.reason).toMatch(/no table header/);
  });
  it('reads the committed table: 863 rows, no rejections, all four codes', () => {
    const out = parseGpzTable(readFileSync(new URL('../data/raw/2026-11-20/table-gpz.csv', import.meta.url), 'utf8'));
    expect(out.rejections).toEqual([]);
    expect(out.rows).toHaveLength(863);
    const counts: Record<string, number> = {};
    for (const r of out.rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    expect(counts).toEqual({ 'PAY+': 542, 'PAY-': 238, 'R/B': 70, DEB: 13 });
  });
});

describe('fixtures', () => {
  it('manifest has the real sha256 of each fixture file', () => {
    const manifest = JSON.parse(read('manifest.json')) as { complete: boolean; entries: { file: string; sha256: string; bytes: number }[] };
    expect(manifest.complete).toBe(true);
    expect(manifest.entries.map((e) => e.file).sort()).toEqual(['gpz.csv', 'satcat.csv', 'table-gpz.csv']);
    for (const e of manifest.entries) {
      const bytes = readFileSync(new URL(e.file, FIX));
      expect(createHash('sha256').update(bytes).digest('hex'), e.file).toBe(e.sha256);
      expect(bytes.length).toBe(e.bytes);
    }
  });
  it('GPZ fixture and table fixture hold the same seven objects', () => {
    const g = parseGp(read('gpz.csv'));
    const t = parseGpzTable(read('table-gpz.csv'));
    expect(g.rejections).toEqual([]);
    expect(t.rejections).toEqual([]);
    expect(g.rows.map((r) => r.norad)).toEqual(t.rows.map((r) => r.norad));
    expect(g.rows).toHaveLength(7);
  });
});

describe('parsers never throw on arbitrary strings', () => {
  const noise = fc.oneof(
    fc.string(),
    fc.string({ unit: 'binary' }),
    fc.array(fc.constantFrom('a', ',', '"', '\n', '\r', ' ', '1', '.', '-', '<tr>', '<td>', '</td>', '<th>', '</th>', '<thead>', '</thead>', '<tbody>', '</tbody>', 'NORAD Catalog Number', 'Latest Data', '2000-01-01', 'T'))
      .map((a) => a.join('')),
  );
  const run = (parse: (s: string) => { rejections: unknown[] }) => (s: string) => {
    const out = parse(s);
    return Array.isArray(out.rejections);
  };
  it('SATCAT, with and without a valid header', () => {
    fc.assert(fc.property(noise, run((s) => parseSatcat(s))));
    fc.assert(fc.property(noise, run((s) => parseSatcat(`${SATCAT_HEADER}\n${s}`))));
  });
  it('GP, with and without a valid header', () => {
    fc.assert(fc.property(noise, run((s) => parseGp(s))));
    fc.assert(fc.property(noise, run((s) => parseGp(`${GP_HEADER}\n${s}`))));
  });
  it('GPZ table, with and without a valid head', () => {
    fc.assert(fc.property(noise, run((s) => parseGpzTable(s))));
    fc.assert(fc.property(noise, run((s) => parseGpzTable(tableHtml([s])))));
  });
  it('csv', () => {
    fc.assert(fc.property(noise, (s) => Array.isArray(parseCsv(s))));
  });
});
