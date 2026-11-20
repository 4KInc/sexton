// Throwaway spike analysis for docs/spike.md. Reads only data/raw/2026-11-20/.
// No network. Run: node scripts/spike-2026-11-20.ts

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw', '2026-11-20');
const MU = 398600.8; // km^3/s^2, WGS-72
const RE = 6378.135; // km, WGS-72
const GEO = 35786; // km

interface Omm {
  name: string;
  norad: number;
  epoch: string;
  n: number; // rev/day
  e: number;
}

function readOmm(file: string): Omm[] {
  const lines = readFileSync(join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const head = lines[0]!.split(',');
  const col = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`${file}: no column ${name}`);
    return i;
  };
  const iName = col('OBJECT_NAME'), iId = col('NORAD_CAT_ID'), iEp = col('EPOCH'), iN = col('MEAN_MOTION'), iE = col('ECCENTRICITY');
  return lines.slice(1).map((line) => {
    const f = line.split(','); // no quoted commas in these files; checked below
    if (f.length !== head.length) throw new Error(`${file}: bad row ${line}`);
    return { name: f[iName]!, norad: Number(f[iId]), epoch: f[iEp]!, n: Number(f[iN]), e: Number(f[iE]) };
  });
}

function orbit(o: Omm) {
  const nRad = (o.n * 2 * Math.PI) / 86400;
  const a = Math.cbrt(MU / (nRad * nRad));
  const perigee = a * (1 - o.e) - RE;
  const apogee = a * (1 + o.e) - RE;
  return { a, perigee, apogee, perigeeAboveGeo: perigee - GEO, apogeeAboveGeo: apogee - GEO };
}

interface TableRow {
  norad: number;
  name: string;
  apogee: number;
  perigee: number;
  ecc: number;
  status: string;
  gpAge: number;
}

function readTable(): { columns: string[]; rows: TableRow[] } {
  const html = readFileSync(join(DIR, 'table-gpz.csv'), 'utf8');
  const tableStart = html.indexOf('<table id="tableID"');
  const thead = html.slice(tableStart, html.indexOf('</thead>', tableStart));
  const columns = [...thead.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]!.trim());
  const tbody = html.slice(html.indexOf('<tbody>', tableStart), html.indexOf('</tbody>', tableStart));
  const rows: TableRow[] = [];
  for (const tr of tbody.split('<tr').slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!.replace(/<[^>]*>/g, '').trim());
    if (cells.length !== columns.length) throw new Error(`table: row with ${cells.length} cells`);
    const num = (s: string) => Number(s.replace(/,/g, ''));
    rows.push({
      norad: num(cells[1]!),
      name: cells[2]!,
      apogee: num(cells[5]!),
      perigee: num(cells[6]!),
      ecc: num(cells[7]!),
      status: cells[8]!.split(/\s+/)[0]!,
      gpAge: num(cells[9]!),
    });
  }
  return { columns, rows };
}

const fmt = (x: number, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const gpz = readOmm('gpz.csv');
const plus = readOmm('gpz-plus.csv');
const table = readTable();

// a. formula vs table
console.log('## a');
const gpzById = new Map(gpz.map((o) => [o.norad, o]));
const diffs: { norad: number; name: string; dp: number; da: number }[] = [];
const missing: number[] = [];
for (const row of table.rows) {
  const o = gpzById.get(row.norad);
  if (!o) { missing.push(row.norad); continue; }
  const r = orbit(o);
  diffs.push({ norad: row.norad, name: row.name, dp: r.perigee - row.perigee, da: r.apogee - row.apogee });
}
const absP = diffs.map((d) => Math.abs(d.dp));
const absA = diffs.map((d) => Math.abs(d.da));
const worst = diffs.reduce((w, d) => (Math.abs(d.dp) > Math.abs(w.dp) ? d : w));
console.log({
  gpzRows: gpz.length,
  tableRows: table.rows.length,
  matched: diffs.length,
  tableNotInGpz: missing,
  gpzNotInTable: gpz.filter((o) => !table.rows.some((r) => r.norad === o.norad)).map((o) => o.norad),
  maxAbsPerigeeDiff: Math.max(...absP).toFixed(3),
  medianAbsPerigeeDiff: median(absP).toFixed(3),
  maxAbsApogeeDiff: Math.max(...absA).toFixed(3),
  meanSignedPerigeeDiff: (diffs.reduce((s, d) => s + d.dp, 0) / diffs.length).toFixed(3),
  over1km: absP.filter((x) => x > 1).length,
  worst,
});

// b, c. named objects
for (const [label, id] of [['b EchoStar-7', 27378], ['c Intelsat 511', 15873]] as const) {
  console.log(`## ${label}`);
  for (const [src, set] of [['GPZ', gpz], ['GPZ-PLUS', plus]] as const) {
    const o = set.find((x) => x.norad === id);
    if (!o) { console.log(src, 'absent'); continue; }
    const r = orbit(o);
    console.log(src, o.name, o.epoch, 'n', o.n, 'e', o.e, 'a', r.a.toFixed(3), 'perigee', fmt(r.perigeeAboveGeo), 'apogee', fmt(r.apogeeAboveGeo));
  }
  const t = table.rows.find((r) => r.norad === id);
  console.log('table', t, t && { perigeeAboveGeo: t.perigee - GEO, apogeeAboveGeo: t.apogee - GEO });
}

// d. overlap
console.log('## d');
const plusIds = new Set(plus.map((o) => o.norad));
const gpzIds = new Set(gpz.map((o) => o.norad));
const both = [...gpzIds].filter((id) => plusIds.has(id));
const merged = new Set([...gpzIds, ...plusIds]);
const dupInFile = (set: Omm[]) => set.length - new Set(set.map((o) => o.norad)).size;
const epochMismatch = both.filter((id) => gpzById.get(id)!.epoch !== plus.find((o) => o.norad === id)!.epoch).length;
const range = (set: Omm[], key: 'perigeeAboveGeo' | 'apogeeAboveGeo') => {
  const xs = set.map((o) => orbit(o)[key]);
  return [Math.min(...xs).toFixed(1), Math.max(...xs).toFixed(1)];
};
const plusOnly = plus.filter((o) => !gpzIds.has(o.norad));
console.log({
  gpz: gpz.length, plus: plus.length, both: both.length, gpzOnly: gpz.length - both.length, plusOnly: plusOnly.length,
  merged: merged.size, dupInGpz: dupInFile(gpz), dupInPlus: dupInFile(plus), epochMismatchInOverlap: epochMismatch,
  gpzPerigeeAboveGeo: range(gpz, 'perigeeAboveGeo'), gpzApogeeAboveGeo: range(gpz, 'apogeeAboveGeo'),
  plusPerigeeAboveGeo: range(plus, 'perigeeAboveGeo'), plusApogeeAboveGeo: range(plus, 'apogeeAboveGeo'),
  plusOnlyPerigeeAboveGeo: range(plusOnly, 'perigeeAboveGeo'), plusOnlyApogeeAboveGeo: range(plusOnly, 'apogeeAboveGeo'),
  plusOnlyPerigeeBelowMinus1000: plusOnly.filter((o) => orbit(o).perigeeAboveGeo < -1000).length,
  luch40258: { gpz: gpzIds.has(40258), plus: plusIds.has(40258), table: table.rows.some((r) => r.norad === 40258) },
});
const gpzPerigee = gpz.map((o) => orbit(o).perigeeAboveGeo);
{
  const bins: Record<string, number> = {};
  for (const o of plusOnly) {
    const r = orbit(o);
    const key =
      r.perigeeAboveGeo < -1000 ? 'perigee < -1000' :
      r.perigeeAboveGeo < -200 ? 'perigee -1000..-200' :
      r.apogeeAboveGeo > 200 ? 'perigee in ±200, apogee > +200' : 'perigee and apogee in ±200';
    bins[key] = (bins[key] ?? 0) + 1;
  }
  console.log('plusOnly bins', bins);
  const top = plus.map((o) => ({ o, r: orbit(o) })).sort((x, y) => y.r.perigeeAboveGeo - x.r.perigeeAboveGeo).slice(0, 3);
  console.log('plus top perigee', top.map(({ o, r }) => `${o.norad} ${o.name} p ${fmt(r.perigeeAboveGeo)} a ${fmt(r.apogeeAboveGeo)} e ${o.e}`));
}
const incl = (file: string) => {
  const lines = readFileSync(join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const i = lines[0]!.split(',').indexOf('INCLINATION');
  const xs = lines.slice(1).map((l) => Number(l.split(',')[i]));
  return [Math.min(...xs), Math.max(...xs)];
};
console.log('inclination range gpz', incl('gpz.csv'), 'plus', incl('gpz-plus.csv'));
console.log('gpz perigee above +150:', gpzPerigee.filter((x) => x > 150).length, 'above +190:', gpzPerigee.filter((x) => x > 190).length);

// e. status counts
console.log('## e');
console.log('columns', table.columns);
const counts: Record<string, number> = {};
for (const r of table.rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log(counts);
const ages = table.rows.map((r) => r.gpAge);
console.log('gpAge median', median(ages), 'max', Math.max(...ages), '>30 days', ages.filter((x) => x > 30).length);
