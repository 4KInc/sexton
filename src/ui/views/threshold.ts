// The threshold maths as a picture: one horizontal bar of perigee above GEO, with the edge of the protected
// zone, the two ends of the IADC threshold band, p, and the mean-element uncertainty around p.
// The geometry is pure (percentages of the bar), so tests can read it without a DOM.
import type { Config } from '../../engine/config.ts';
import { LEDGER } from '../copy.ts';
import { formatP } from '../format.ts';
import { esc } from '../html.ts';
import { edgesOf, marginsSentence } from '../ledger-text.ts';
import type { Retired } from '../ledger-text.ts';

/** How far past the outer edges the bar reaches, in km, and how far p may be before it is drawn at the end of the bar. */
export const BAR = { padKm: 60, reachKm: 200 } as const;
export interface BarGeometry {
  /** The bar covers loKm to hiKm above GEO. */
  loKm: number;
  hiKm: number;
  /** Where each edge stands, 0 to 100 (percent of the bar). */
  zone: number;
  low: number;
  high: number;
  /** Where p stands, 0 to 100. `off` says p is beyond the bar, so the mark is held at that end. */
  p: number;
  off: 'below' | 'above' | null;
  /** The ±uncertainty band around p, clamped to the bar. */
  bandFrom: number;
  bandTo: number;
}
const pct = (km: number, lo: number, hi: number): number => Math.min(100, Math.max(0, ((km - lo) / (hi - lo)) * 100));
/**
 * The bar spans the three edges with room either side. When p is near them the bar grows to hold p and its
 * uncertainty. When p is far away (a stone high in the graveyard, or a fallen one) it stays put and the mark is
 * held at its end, with `off` set, because stretching the bar would squash the three edges into a line.
 */
export function barGeometry(pKm: number, config: Config): BarGeometry {
  const [zone, low, high] = edgesOf(config);
  const u = config.uncertaintyKm;
  let lo = zone! - BAR.padKm;
  let hi = high! + BAR.padKm;
  const near = pKm >= zone! - BAR.reachKm && pKm <= high! + BAR.reachKm;
  if (near) {
    lo = Math.min(lo, Math.floor((pKm - u - 10) / 10) * 10);
    hi = Math.max(hi, Math.ceil((pKm + u + 10) / 10) * 10);
  }
  const off = pKm < lo ? 'below' : pKm > hi ? 'above' : null;
  return {
    loKm: lo,
    hiKm: hi,
    zone: pct(zone!, lo, hi),
    low: pct(low!, lo, hi),
    high: pct(high!, lo, hi),
    p: pct(pKm, lo, hi),
    off,
    bandFrom: pct(pKm - u, lo, hi),
    bandTo: pct(pKm + u, lo, hi),
  };
}
const r2 = (n: number): string => String(Math.round(n * 100) / 100);
/** The bar as HTML. The picture is described once, in words, for screen readers; the key under it is real text. */
export function thresholdBarHtml(r: Retired, config: Config): string {
  const g = barGeometry(r.pKm, config);
  const B = LEDGER.bar;
  const [zone, low, high] = edgesOf(config);
  const pText = formatP(r.pKm, r.orbitSource.kind, edgesOf(config));
  const label = `${marginsSentence(r, config)} ${B.bandWords(config.uncertaintyKm)}${g.off === null ? '' : ` ${B.offWords(g.off)}`}`;
  const mark =
    `<span class="pbar-mark${g.off === null ? '' : ' pbar-mark--off'}" style="left:${r2(g.p)}%"></span>` +
    `<span class="pbar-band" style="left:${r2(g.bandFrom)}%;width:${r2(Math.max(0, g.bandTo - g.bandFrom))}%"></span>`;
  const seg = (cls: string, from: number, to: number): string => `<span class="pbar-seg pbar-seg--${cls}" style="left:${r2(from)}%;width:${r2(to - from)}%"></span>`;
  const ticks = [zone!, low!, high!]
    .map((km, i) => `<span class="pbar-tick" style="left:${r2([g.zone, g.low, g.high][i]!)}%">${esc(String(km))}</span>`)
    .join('');
  const key = [
    B.zone(zone!),
    B.low(low!, config.iadc.crAmMin),
    B.high(high!, config.iadc.crAmMax),
    B.p(pText),
    B.band(config.uncertaintyKm),
  ]
    .map((t) => `<li>${esc(t)}</li>`)
    .join('');
  return (
    `<figure class="pbar" role="img" aria-label="${esc(label)}">` +
    `<div class="pbar-label" aria-hidden="true" style="left:${r2(g.p)}%"><span>${esc(B.pLabel(pText, g.off))}</span></div>` +
    `<div class="pbar-track" aria-hidden="true">${seg('zone', 0, g.zone)}${seg('shallow', g.zone, g.low)}${seg('wall', g.low, g.high)}${seg('above', g.high, 100)}${mark}</div>` +
    `<div class="pbar-ticks" aria-hidden="true">${ticks}</div>` +
    `<figcaption class="pbar-unit">${esc(B.unit)}</figcaption></figure><ul class="pbar-key">${key}</ul>`
  );
}
