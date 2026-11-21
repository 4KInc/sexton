import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { CONFIG } from '../src/engine/config.ts';
import { eccentricityFromAltitudes, orbitFromAltitudes, orbitFromMeanMotion } from '../src/engine/orbit.ts';

const DIR = new URL('../data/raw/2026-11-20/', import.meta.url);

describe('thresholds', () => {
  it('are exactly 247 and 280', () => {
    expect(CONFIG.thresholdLowKm).toBe(247);
    expect(CONFIG.thresholdHighKm).toBe(280);
  });
});

describe('orbitFromMeanMotion', () => {
  it('a circular orbit at one rev per sidereal day sits at GEO', () => {
    const o = orbitFromMeanMotion(1.00273791, 0, CONFIG);
    expect(Math.abs(o.pKm)).toBeLessThan(1);
    expect(o.pKm).toBe(o.qKm);
  });
  it('p and q are perigee and apogee minus GEO', () => {
    const o = orbitFromMeanMotion(1.0, 0.01, CONFIG);
    expect(o.pKm).toBeCloseTo(o.perigeeKm - 35786, 9);
    expect(o.qKm).toBeCloseTo(o.apogeeKm - 35786, 9);
  });
  it('apogee − perigee = 2·a·e', () => {
    const o = orbitFromMeanMotion(1.0, 0.01, CONFIG);
    expect(o.apogeeKm - o.perigeeKm).toBeCloseTo(2 * o.semiMajorAxisKm * 0.01, 6);
    expect(o.apogeeKm).toBeGreaterThan(o.perigeeKm);
  });
  it('property: perigee ≤ apogee', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        (n, e) => {
          const o = orbitFromMeanMotion(n, e, CONFIG);
          return o.perigeeKm <= o.apogeeKm && o.pKm <= o.qKm;
        },
      ),
    );
  });
});

describe('SATCAT altitudes', () => {
  it('equal altitudes give e = 0', () => {
    expect(eccentricityFromAltitudes(35786, 35786, CONFIG)).toBe(0);
  });
  it('matches (ra − rp) / (ra + rp)', () => {
    const e = eccentricityFromAltitudes(36000, 35800, CONFIG);
    expect(e).toBeCloseTo(200 / (36000 + 35800 + 2 * 6378.135), 12);
  });
  it('property: perigee ≤ apogee and e in [0, 1)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (x, y) => {
          const o = orbitFromAltitudes(Math.max(x, y), Math.min(x, y), CONFIG);
          return o.perigeeKm <= o.apogeeKm && o.e >= 0 && o.e < 1;
        },
      ),
    );
  });
});

// Minimal reader for the committed files. The real parsers arrive in task 3.
function readGpz(): Map<number, { n: number; e: number }> {
  const lines = readFileSync(new URL('gpz.csv', DIR), 'utf8').trim().split(/\r?\n/);
  const head = lines[0]!.split(',');
  const [iId, iN, iE] = ['NORAD_CAT_ID', 'MEAN_MOTION', 'ECCENTRICITY'].map((c) => head.indexOf(c)) as [number, number, number];
  const out = new Map<number, { n: number; e: number }>();
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    out.set(Number(f[iId]), { n: Number(f[iN]), e: Number(f[iE]) });
  }
  return out;
}

function readTablePerigees(): Map<number, number> {
  const html = readFileSync(new URL('table-gpz.csv', DIR), 'utf8');
  const start = html.indexOf('<table id="tableID"');
  const columns = [...html.slice(start, html.indexOf('</thead>', start)).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].length;
  const tbody = html.slice(html.indexOf('<tbody>', start), html.indexOf('</tbody>', start));
  const out = new Map<number, number>();
  for (const tr of tbody.split('<tr').slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!.replace(/<[^>]*>/g, '').trim());
    expect(cells.length).toBe(columns);
    out.set(Number(cells[1]!.replace(/,/g, '')), Number(cells[6]!.replace(/,/g, '')));
  }
  return out;
}

describe('golden: committed GPZ files', () => {
  const gpz = readGpz();
  const table = readTablePerigees();
  it('has the same objects in both files', () => {
    expect(gpz.size).toBe(863);
    expect([...table.keys()].sort()).toEqual([...gpz.keys()].sort());
  });
  it('every perigee is within 1 km of the table', () => {
    for (const [norad, { n, e }] of gpz) {
      const o = orbitFromMeanMotion(n, e, CONFIG);
      expect(Math.abs(o.perigeeKm - table.get(norad)!), `NORAD ${norad}`).toBeLessThan(1);
    }
  });
});
