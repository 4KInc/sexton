// Redesign B: the ledger's header card, its two columns, and the threshold bar.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { LEDGER } from '../src/ui/copy.ts';
import { marginsSentence } from '../src/ui/ledger-text.ts';
import type { Retired } from '../src/ui/ledger-text.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { ledgerHtml } from '../src/ui/views/ledger.ts';
import { retiredPayloads } from '../src/ui/views/churchyard.ts';
import { barGeometry, BAR, thresholdBarHtml } from '../src/ui/views/threshold.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const config = real.config;
const retired = retiredPayloads(real.records) as Retired[];
const echostar = retired.find((r) => r.norad === 27378)!;
describe('barGeometry', () => {
  it('puts the three edges in order, inside the bar, whatever p is', () => {
    fc.assert(
      fc.property(fc.double({ min: -2000, max: 40000, noNaN: true }), (p) => {
        const g = barGeometry(p, config);
        expect(g.loKm).toBeLessThan(g.hiKm);
        expect(0).toBeLessThanOrEqual(g.zone);
        expect(g.zone).toBeLessThan(g.low);
        expect(g.low).toBeLessThan(g.high);
        expect(g.high).toBeLessThanOrEqual(100);
        expect(g.p).toBeGreaterThanOrEqual(0);
        expect(g.p).toBeLessThanOrEqual(100);
        expect(g.bandFrom).toBeLessThanOrEqual(g.p);
        expect(g.p).toBeLessThanOrEqual(g.bandTo);
      }),
    );
  });
  it('p moves right as it grows, and is flagged off the bar only when it is beyond the ends', () => {
    fc.assert(
      fc.property(fc.double({ min: -500, max: 900, noNaN: true }), fc.double({ min: 0.5, max: 50, noNaN: true }), (p, d) => {
        const a = barGeometry(p, config);
        // The bar can grow with p, so compare on the same bar: p inside the base range.
        const base = barGeometry(config.protectedZoneKm, config);
        const inside = (x: number): boolean => x >= base.loKm && x <= base.hiKm;
        if (inside(p) && inside(p + d)) expect(barGeometry(p + d, config).p).toBeGreaterThanOrEqual(a.p);
        expect(a.off === null).toBe(p >= a.loKm && p <= a.hiKm);
      }),
    );
  });
  it('places the edges where the config says, in km', () => {
    const g = barGeometry(config.thresholdLowKm, config);
    const km = (pc: number): number => g.loKm + (pc / 100) * (g.hiKm - g.loKm);
    expect(km(g.zone)).toBeCloseTo(config.protectedZoneKm, 6);
    expect(km(g.low)).toBeCloseTo(config.thresholdLowKm, 6);
    expect(km(g.high)).toBeCloseTo(config.thresholdHighKm, 6);
    expect(km(g.p)).toBeCloseTo(config.thresholdLowKm, 6);
    expect(km(g.bandTo) - km(g.bandFrom)).toBeCloseTo(2 * config.uncertaintyKm, 6);
  });
  it('a stone far above or below keeps the bar as it is and holds the mark at the end', () => {
    const base = barGeometry(config.protectedZoneKm, config);
    for (const p of [BAR.reachKm * -1 - 1, 1914, 36000]) {
      const g = barGeometry(p, config);
      expect(g.off).not.toBeNull();
      expect(g.loKm).toBe(base.loKm);
      expect(g.hiKm).toBe(base.hiKm);
      expect(g.p).toBe(p < 0 ? 0 : 100);
    }
  });
});
describe('thresholdBarHtml', () => {
  const html = thresholdBarHtml(echostar, config);
  it('is described once in words for screen readers, and its drawing is hidden from them', () => {
    expect(html).toContain('role="img"');
    expect(html).toContain(marginsSentence(echostar, config).replace(/&/g, '&amp;'));
    expect(html).toContain('±25 km, the mean-element uncertainty');
    expect(html.match(/aria-hidden="true"/g)!.length).toBeGreaterThanOrEqual(3);
  });
  it('shows p against 200, 247 and 280, with the ±25 km band, and a text key', () => {
    expect(html).toContain('p = +110.1 km');
    for (const km of ['200', '247', '280']) expect(html).toContain(`>${km}</span>`);
    expect(html).toContain('class="pbar-band"');
    expect(html).toContain('<li>200 km: the edge of the protected zone.</li>');
    expect(html).toContain('<li>247 km: the IADC threshold if C_R·A/m is 0.012 m²/kg.</li>');
    expect(html).toContain('<li>280 km: the IADC threshold if C_R·A/m is 0.045 m²/kg.</li>');
  });
  it('builds for all 696 retired payloads, says so when the mark is off the bar, and never uses a banned word', () => {
    let off = 0;
    for (const r of retired) {
      const h = thresholdBarHtml(r, config);
      expect(h, String(r.norad)).toContain('class="pbar-mark');
      if (barGeometry(r.pKm, config).off !== null) {
        off++;
        expect(h).toContain('The mark is held at the');
      }
      expect(findHits(h.replace(/<[^>]*>/g, ' '), `bar-${r.norad}`)).toEqual([]);
    }
    expect(off).toBeGreaterThan(0);
  });
  it('uses no colour of its own: positions are inline, colours come from the stylesheet', () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|color:/);
  });
});
describe('the ledger page layout', () => {
  const page = ledgerHtml(echostar, real);
  it('opens with a header card: name, NORAD id, verdict badge, snapshot date, data age and assumptions', () => {
    const head = page.slice(page.indexOf('<header class="ledger-head">'), page.indexOf('</header>'));
    expect(head).toContain('ECHOSTAR <span class="num">7</span>');
    expect(head).toContain('NORAD <span class="num">27378</span>');
    expect(head).toContain('<span class="badge-word">Unquiet</span>');
    expect(head).toContain('CelesTrak snapshot, 22 Nov 2026');
    expect(head).toContain('GP mean elements, epoch 2026-11-22');
    expect(head).toContain('±25 km');
  });
  it('has two columns: the verdict and maths on the left, the object, elements and Cite this on the right', () => {
    const main = page.slice(page.indexOf('ledger-col--main'), page.indexOf('ledger-col--side'));
    const side = page.slice(page.indexOf('ledger-col--side'));
    for (const id of ['verdict', 'maths']) expect(main).toContain(`id="ledger-${id}"`);
    for (const id of ['identity', 'orbit', 'cite']) expect(side).toContain(`id="ledger-${id}"`);
    expect(main).toContain('class="pbar"');
  });
  it('stacks to one column on a phone and in print, and the print rules use only paper and ink', () => {
    const css = read('src/ui/styles/ledger.css');
    expect(css).toMatch(/@media \(max-width: 900px\)\s*\{[\s\S]*\.ledger-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    const print = read('src/ui/styles/print.css');
    expect(print).toMatch(/\.ledger-grid\s*\{\s*display:\s*block/);
    expect(print).toMatch(/\.ledger-head\s*\{[^}]*background:\s*none/);
    expect(print).toMatch(/\.pbar-mark\s*\{\s*background:\s*var\(--ink\)/);
    expect(LEDGER.headings.cite).toBe('Cite this');
  });
});
