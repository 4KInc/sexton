// Task 19 analysis for docs/spike.md section f. Reads only data/raw/2026-11-22/. No network, no writes.
// Run: node scripts/spike-2026-11-22.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/engine/config.ts';
import { parseGp } from '../src/engine/gp.ts';
import { parseGpzTable } from '../src/engine/gpz-table.ts';
import { inNearGeo, kindFromSatcat, kindFromTableStatus } from '../src/engine/merge.ts';
import { orbitFromMeanMotion } from '../src/engine/orbit.ts';
import { parseSatcat } from '../src/engine/satcat.ts';
import type { SatcatRow } from '../src/engine/satcat.ts';
import { runEngine } from '../src/engine/engine.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw', '2026-11-22');
const read = (f: string): string => readFileSync(join(DIR, f), 'utf8');
const GEO = CONFIG.geoAltitudeKm;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const quantile = (xs: number[], q: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;
const sgn = (x: number, d = 1): string => (x >= 0 ? '+' : '') + x.toFixed(d);
const tally = <T>(xs: readonly T[], key: (x: T) => string): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const show = (title: string, rows: unknown): void => console.log(`\n## ${title}\n${typeof rows === 'string' ? rows : JSON.stringify(rows)}`);

const satcat = parseSatcat(read('satcat.csv'));
const gp = parseGp(read('gpz.csv'));
const table = parseGpzTable(read('table-gpz.csv'));
show('parse', {
  satcatRows: satcat.rows.length,
  satcatRejections: satcat.rejections.length,
  noOrbitData: satcat.noOrbitDataCount,
  rejectionSample: satcat.rejections.slice(0, 5),
  gpRows: gp.rows.length,
  gpRejections: gp.rejections.length,
  tableRows: table.rows.length,
  tableRejections: table.rejections.length,
});
const byId = new Map<number, SatcatRow>(satcat.rows.map((r) => [r.norad, r]));

// 1. SATCAT against GP, for every GPZ object that is in SATCAT with orbit data.
{
  const dp: number[] = [];
  const dq: number[] = [];
  const de: number[] = [];
  const worst: string[] = [];
  let missing = 0;
  const missingIds: number[] = [];
  for (const g of gp.rows) {
    const s = byId.get(g.norad);
    if (s === undefined) {
      missing++;
      missingIds.push(g.norad);
      continue;
    }
    const o = orbitFromMeanMotion(g.meanMotion, g.e, CONFIG);
    dp.push(s.perigeeKm - o.perigeeKm);
    dq.push(s.apogeeKm - o.apogeeKm);
    const eS = (s.apogeeKm - s.perigeeKm) / (s.apogeeKm + s.perigeeKm + 2 * CONFIG.earth.radiusKm);
    de.push(eS - o.e);
    if (Math.abs(s.perigeeKm - o.perigeeKm) > 5) worst.push(`${g.norad} ${g.name}: SATCAT ${s.perigeeKm}, GP ${o.perigeeKm.toFixed(1)}, decay=${s.decayDate}, center=${s.orbitCenter}`);
  }
  const ap = dp.map(Math.abs);
  const aq = dq.map(Math.abs);
  show('SATCAT minus GP, GPZ objects found in SATCAT', {
    gpzObjects: gp.rows.length,
    inSatcatWithOrbit: dp.length,
    gpzNotInSatcatWithOrbit: missing,
    missingIds: missingIds.slice(0, 20),
    perigee: { maxAbs: Math.max(...ap), median: median(ap), p95: quantile(ap, 0.95), p99: quantile(ap, 0.99), meanSigned: dp.reduce((a, b) => a + b, 0) / dp.length, over1: ap.filter((x) => x > 1).length, over5: ap.filter((x) => x > 5).length, over10: ap.filter((x) => x > 10).length, over25: ap.filter((x) => x > 25).length },
    apogee: { maxAbs: Math.max(...aq), median: median(aq), p95: quantile(aq, 0.95), meanSigned: dq.reduce((a, b) => a + b, 0) / dq.length, over5: aq.filter((x) => x > 5).length, over25: aq.filter((x) => x > 25).length },
    eccentricity: { maxAbs: Math.max(...de.map(Math.abs)), median: median(de.map(Math.abs)) },
    perigeeOver5: worst.slice(0, 30),
  });
}

// 2. Near-GEO filter.
const inFilter = satcat.rows.filter((r) => inNearGeo(r));
show('near-GEO filter (current config, +-2000 km, EA, not decayed)', {
  rows: inFilter.length,
  byObjectType: tally(inFilter, (r) => r.objectType),
  byOpsStatus: tally(inFilter, (r) => `${r.objectType}/${r.opsStatusCode || '(blank)'}`),
  gpzInFilter: gp.rows.filter((g) => { const s = byId.get(g.norad); return s !== undefined && inNearGeo(s); }).length,
  gpzNotInFilter: gp.rows
    .filter((g) => { const s = byId.get(g.norad); return s === undefined || !inNearGeo(s); })
    .map((g) => { const s = byId.get(g.norad); return `${g.norad} ${g.name}: ${s === undefined ? 'not in SATCAT' : `SATCAT ${s.perigeeKm}x${s.apogeeKm} ${s.orbitCenter} decay=${s.decayDate}`}`; }),
});
const wide = (lo: number, hi: number, f: (r: SatcatRow) => boolean = () => true): number =>
  satcat.rows.filter((r) => r.decayDate === null && r.orbitCenter === 'EA' && r.apogeeKm >= GEO + lo && r.apogeeKm <= GEO + hi && r.perigeeKm >= GEO + lo && r.perigeeKm <= GEO + hi && f(r)).length;
const retiredPay = (r: SatcatRow): boolean => kindFromSatcat(r) === 'retired payload';
show('sensitivity of the window (all objects / retired payloads)', [250, 500, 1000, 2000, 3000, 5000, 10000].map((w) => ({ window: w, all: wide(-w, w), retired: wide(-w, w, retiredPay) })));
{
  // Retired payloads by perigee, in 100 km steps above GEO, for undecayed EA objects with apogee within a wide window.
  const rp = satcat.rows.filter((r) => r.decayDate === null && r.orbitCenter === 'EA' && retiredPay(r) && r.perigeeKm >= GEO - 20000 && r.perigeeKm <= GEO + 20000);
  const bins = tally(rp, (r) => String(Math.floor((r.perigeeKm - GEO) / 250) * 250)).sort((a, b) => Number(a[0]) - Number(b[0]));
  show('retired payloads (undecayed, EA) by perigee above GEO, 250 km steps, -20000..+20000', bins.filter(([k]) => Number(k) >= -1500 && Number(k) <= 4000));
  const nearbyOut = satcat.rows.filter(
    (r) => r.decayDate === null && r.orbitCenter === 'EA' && retiredPay(r) && !inNearGeo(r) && r.perigeeKm >= GEO - 2000 && r.perigeeKm <= GEO + 2000,
  );
  show('retired payloads with perigee inside +-2000 but apogee outside (excluded by the filter)', {
    count: nearbyOut.length,
    sample: nearbyOut.slice(0, 15).map((r) => `${r.norad} ${r.name}: p ${r.perigeeKm - GEO}, q ${r.apogeeKm - GEO}`),
  });
  const gso = satcat.rows.filter((r) => r.decayDate === null && retiredPay(r) && r.orbitCenter !== 'EA' && r.apogeeKm >= GEO - 2000 && r.perigeeKm <= GEO + 2000);
  show('non-EA orbit centre inside the window', gso.length);
  const noDecayButDecayed = satcat.rows.filter((r) => r.decayDate !== null && r.apogeeKm >= GEO - 2000 && r.perigeeKm >= GEO - 2000 && r.apogeeKm <= GEO + 2000);
  show('decayed rows that would otherwise pass', noDecayButDecayed.length);
}

// 3. Luch/Olymp.
{
  const s = byId.get(40258);
  show('Luch/Olymp 40258', s === undefined ? 'not in SATCAT' : { ...s, raw: undefined, pAboveGeo: s.perigeeKm - GEO, qAboveGeo: s.apogeeKm - GEO, inFilter: inNearGeo(s), kind: kindFromSatcat(s), inGp: gp.rows.some((g) => g.norad === 40258), inTable: table.rows.some((t) => t.norad === 40258) });
  show('names matching OLYMP / LUCH', satcat.rows.filter((r) => /OLYMP|LUCH/i.test(r.name)).map((r) => `${r.norad} ${r.name} ${r.objectType}/${r.opsStatusCode} ${r.perigeeKm - GEO}..${r.apogeeKm - GEO} decay=${r.decayDate}`));
}

// 4. Status agreement.
{
  const pairs: string[] = [];
  const diffs: string[] = [];
  let both = 0;
  let notInSatcat = 0;
  for (const t of table.rows) {
    const s = byId.get(t.norad);
    if (s === undefined) { notInSatcat++; continue; }
    both++;
    const a = kindFromSatcat(s);
    const b = kindFromTableStatus(t.status);
    const norm = (k: string): string => (k === 'unknown payload' ? 'unknown' : k);
    pairs.push(`${t.status} | ${s.objectType}/${s.opsStatusCode || '(blank)'}`);
    if (norm(a) !== norm(b)) diffs.push(`${t.norad} ${byId.get(t.norad)!.name}: table ${t.status}, SATCAT ${s.objectType}/${s.opsStatusCode || '(blank)'} -> ${a}`);
  }
  show('status agreement, GPZ table against SATCAT', { tableRows: table.rows.length, inSatcat: both, notInSatcat, disagreements: diffs.length, crosstab: tally(pairs, (x) => x), diffs: diffs.slice(0, 40) });
}

// 5. The engine on the complete set.
const result = runEngine({ satcatCsv: read('satcat.csv'), gpzCsv: read('gpz.csv'), gpzTableHtml: read('table-gpz.csv'), snapshotDate: '2026-11-22' });
const recs = result.records;
show('engine', { records: recs.length, rejections: result.rejections.length, noOrbitData: result.noOrbitDataCount, census: { population: result.census.population, byType: result.census.byType, retired: { total: result.census.retired.total, byVerdict: result.census.retired.byVerdict, borderline: result.census.retired.borderline, era: result.census.retired.era, orbitSource: result.census.retired.orbitSource }, disagreements: result.census.disagreements } });
{
  const ret = recs.filter((r) => r.status === 'retired payload');
  const p = (r: { pKm: number }): number => r.pKm;
  const band = (r: { pKm: number }): string => (p(r) <= 200 ? '<= +200' : p(r) < 247 ? '+200..+247' : p(r) < 280 ? '+247..+280' : '>= +280');
  show('retired payloads by perigee band', tally(ret, band));
  show('retired payloads by band and orbit source', tally(ret, (r) => `${band(r)} / ${r.orbitSource.kind}`));
  const hi = ret.filter((r) => p(r) >= 247);
  show('of those at or above +247', { total: hi.length, eAbove003: hi.filter((r) => r.e > 0.003).length });
  const near = (km: number) => ret.filter((r) => Math.abs(p(r) - km) <= CONFIG.uncertaintyKm);
  show('within 25 km of an edge', { of200: near(200).length, of247: near(247).length, of280: near(280).length, any: ret.filter((r) => [200, 247, 280].some((k) => Math.abs(p(r) - k) <= 25)).length });
  show('orbit source of verdicts (retired payloads)', tally(ret, (r) => r.orbitSource.kind));
  const withVerdict = recs.filter((r) => r.verdict.kind === 'verdict');
  show('orbit source of all records with a verdict', tally(withVerdict, (r) => r.orbitSource.kind));
  const sorted = [...ret].sort((a, b) => p(b) - p(a));
  show('top 15 retired payloads by perigee above GEO', sorted.slice(0, 15).map((r) => `${r.norad} ${r.name} p=${p(r).toFixed(0)} q=${r.qKm.toFixed(0)} e=${r.e.toFixed(5)} src=${r.orbitSource.kind} launch=${r.launchDate}`));
  show('retired payloads by perigee, coarse', tally(ret, (r) => (p(r) < -2000 ? '< -2000' : p(r) < -200 ? '-2000..-200' : p(r) <= 200 ? '-200..+200' : p(r) < 247 ? '200..247' : p(r) < 280 ? '247..280' : p(r) < 400 ? '280..400' : p(r) < 1000 ? '400..1000' : p(r) < 2000 ? '1000..2000' : '>= 2000')));
  show('verdict counts', result.census.retired.byVerdict);
  // Oddities.
  const odd = {
    emptyOwner: ret.filter((r) => r.owner === null).length,
    noLaunchDate: ret.filter((r) => r.launchDate === null).length,
    launchBefore1957: ret.filter((r) => r.launchDate !== null && r.launchDate < '1957').length,
    eAbove003Overall: ret.filter((r) => r.e > 0.003).length,
    inclinationAbove20: ret.filter((r) => (r.inclinationDeg ?? 0) > 20).length,
    inclinationMax: Math.max(...ret.map((r) => r.inclinationDeg ?? 0)),
    negativeApogeeBelowPerigee: recs.filter((r) => r.qKm < r.pKm).length,
    satcatWithBigE: ret.filter((r) => r.orbitSource.kind === 'SATCAT' && r.e > 0.05).map((r) => `${r.norad} ${r.name} p=${r.pKm} q=${r.qKm}`).slice(0, 10),
    unquietGpEpochOld: ret.filter((r) => r.orbitSource.kind === 'GP' && Date.parse('2026-11-22') - Date.parse((r.orbitSource as { epoch: string }).epoch) > 30 * 86400000).length,
  };
  show('oddities', odd);
  const mixed = recs.filter((r) => r.orbitSource.kind === 'SATCAT' && r.verdict.kind === 'verdict' && r.verdict.borderline);
  show('SATCAT-sourced verdicts that are borderline', { count: mixed.length, sample: mixed.slice(0, 10).map((r) => `${r.norad} ${r.name} p=${r.pKm}`) });
  show('SATCAT-sourced with an altitude within 1 km of an edge', ret.filter((r) => r.orbitSource.kind === 'SATCAT' && [200, 247, 280].some((k) => Math.abs(p(r) - k) <= 1)).map((r) => `${r.norad} ${r.name} p=${p(r)}`));
}

// 6. Extra checks for the write-up.
{
  const gpIds = new Set(gp.rows.map((g) => g.norad));
  const big = gp.rows.filter((g) => { const s = byId.get(g.norad)!; return Math.abs(s.perigeeKm - orbitFromMeanMotion(g.meanMotion, g.e, CONFIG).perigeeKm) > 5; });
  show('GP objects whose SATCAT perigee differs by more than 5 km', big.map((g) => { const s = byId.get(g.norad)!; return `${g.norad} ${s.name} ${s.objectType}/${s.opsStatusCode || '(blank)'} gpEpoch=${g.epoch}`; }));
  const retiredGp = gp.rows.filter((g) => kindFromSatcat(byId.get(g.norad)!) === 'retired payload');
  const dRet = retiredGp.map((g) => Math.abs(byId.get(g.norad)!.perigeeKm - orbitFromMeanMotion(g.meanMotion, g.e, CONFIG).perigeeKm));
  show('retired payloads that have both', { n: retiredGp.length, maxAbs: Math.max(...dRet), median: median(dRet), over1: dRet.filter((x) => x > 1).length, over5: dRet.filter((x) => x > 5).length });
  const ret = result.records.filter((r) => r.status === 'retired payload');
  const satOnly = ret.filter((r) => r.orbitSource.kind === 'SATCAT');
  show('SATCAT-only retired payloads: e within 0.0005 of the 0.003 limit', satOnly.filter((r) => Math.abs(r.e - 0.003) <= 0.0005).map((r) => `${r.norad} ${r.name} e=${r.e.toFixed(5)} p=${r.pKm}`));
  show('SATCAT-only retired payloads: stored quantisation', { whole: satOnly.length, max_e_error_from_half_km: (1 / (2 * (GEO + CONFIG.earth.radiusKm))).toExponential(2) });
  show('GP ids that are not in the filter', [...gpIds].filter((id) => !inNearGeo(byId.get(id)!)));
  const nonEa = satcat.rows.filter((r) => r.decayDate === null && retiredPay(r) && r.orbitCenter !== 'EA' && r.apogeeKm >= GEO - 2000 && r.perigeeKm <= GEO + 2000);
  show('retired, non-EA centre, inside the window', nonEa.map((r) => `${r.norad} ${r.name} centre=${r.orbitCenter} ${r.perigeeKm - GEO}..${r.apogeeKm - GEO}`));
  const nonEaAll = satcat.rows.filter((r) => r.decayDate === null && r.orbitCenter !== 'EA' && r.apogeeKm >= GEO - 2000 && r.perigeeKm >= GEO - 2000 && r.apogeeKm <= GEO + 2000 && r.perigeeKm <= GEO + 2000);
  show('any type, non-EA centre, inside the window', nonEaAll.map((r) => `${r.norad} ${r.name} ${r.objectType}/${r.opsStatusCode} centre=${r.orbitCenter}`));
  const dec = satcat.rows.filter((r) => r.decayDate !== null && r.apogeeKm >= GEO - 2000 && r.perigeeKm >= GEO - 2000 && r.apogeeKm <= GEO + 2000);
  show('decayed rows inside the window', dec.map((r) => `${r.norad} ${r.name} ${r.objectType}/${r.opsStatusCode} decay=${r.decayDate} ${r.perigeeKm - GEO}..${r.apogeeKm - GEO}`));
  const add = satcat.rows.filter((r) => r.decayDate === null && r.orbitCenter === 'EA' && retiredPay(r) && !inNearGeo(r) && r.apogeeKm >= GEO - 10000 && r.apogeeKm <= GEO + 10000 && r.perigeeKm >= GEO - 10000 && r.perigeeKm <= GEO + 10000);
  show('retired payloads added by a +-10000 window', add.map((r) => `${r.norad} ${r.name} p=${r.perigeeKm - GEO} q=${r.apogeeKm - GEO}`));
  const farHigh = satcat.rows.filter((r) => r.decayDate === null && r.orbitCenter === 'EA' && retiredPay(r) && r.perigeeKm - GEO > 2000 && r.perigeeKm - GEO < 60000 && r.apogeeKm - r.perigeeKm < 2000);
  show('retired payloads on near-circular orbits with perigee above +2000 (any height)', farHigh.map((r) => `${r.norad} ${r.name} p=${r.perigeeKm - GEO} q=${r.apogeeKm - GEO}`).slice(0, 40));
  show('GP epoch spread', { min: gp.rows.map((g) => g.epoch).sort()[0], max: gp.rows.map((g) => g.epoch).sort().at(-1) });
  const oldIds = new Set(parseGp(readFileSync(join(DIR, '..', '2026-11-20', 'gpz.csv'), 'utf8')).rows.map((g) => g.norad));
  show('GPZ ids today that were not in the 2026-11-20 file', { oldCount: oldIds.size, new: gp.rows.filter((g) => !oldIds.has(g.norad)).map((g) => `${g.norad} ${g.name} ${byId.get(g.norad)!.objectType}/${byId.get(g.norad)!.opsStatusCode}`), gone: [...oldIds].filter((id) => !gpIds.has(id)) });
}
