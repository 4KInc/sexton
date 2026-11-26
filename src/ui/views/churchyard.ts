// The churchyard view (design 5.4, R6). The chart is a string of SVG, built by pure functions,
// so tests can read it without a DOM. Colours come only from CSS classes.
import type { Config } from '../../engine/config.ts';
import type { SatRecord, VerdictName } from '../../engine/types.ts';
import {
  TIP,
  assumptionsLine,
  bandCopy,
  CARD,
  CHART,
  CHURCHYARD_INTRO,
  chartDescription,
  countLine,
  dataAge,
  COMPARISONS,
  FILTERS,
  HERO,
  LEGEND,
  MOSS_STEPS,
  offScaleEdgeText,
  PAGE_TITLES,
  SITE,
  snapshotLabel,
  VALIDATION,
  stoneLabel,
  TERMS,
  VERDICT_ORDER,
  verdictCopy,
} from '../copy.ts';
import { disposalRate, postRuleSummary } from '../../engine/headline.ts';
import { formatCount, formatP, formatSigned, MINUS, spokenKm } from '../format.ts';
import { esc, withSansDigits } from '../html.ts';
import type { UiRegister } from '../register.ts';
import { applyFilters, drawnInChurchyard, hasFilters, hashFor, NO_FILTERS, parseState } from '../state.ts';
import type { ViewState } from '../state.ts';
import { badgeHtml, glyphSvg } from './badge.ts';
import { fineHtml } from './fine.ts';
import { ECHOSTAR_7, moveStep, rememberSkip, tourHtml, tourSkipped, tourSteps } from './tour.ts';
import { filtersHtml, wireFilters } from './filters.ts';
import { emptyFiltersHtml } from '../messages.ts';
import { introPlayed, lanternOrder, rememberIntro, runIntro, shouldAnimate } from '../intro.ts';
import type { IntroHandle } from '../intro.ts';
import { axisText, zoneNames } from '../svg/axis.ts';
import type { AxisText } from '../svg/axis.ts';
import { bandsOf } from '../svg/bands.ts';
import { stoneBody } from '../svg/headstone.ts';
import { placeLabels } from '../svg/labels.ts';
import type { Box, LabelPlacement } from '../svg/labels.ts';
import { layoutStones, nextInNav, NAV_KEYS, navSort } from '../svg/layout.ts';
import type { NavItem, Placed } from '../svg/layout.ts';
import {
  baseYOf,
  buildColumns,
  HIGH_TICKS_KM,
  LAYOUT,
  mossStep,
  offScale,
  offScaleCounts,
  plotHeight,
  SCALE,
  swayAngle,
  yBreak,
  yearFraction,
  yOf,
} from '../svg/scale.ts';
import type { Columns } from '../svg/scale.ts';

export type RetiredRecord = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };

export const retiredPayloads = (records: readonly SatRecord[]): RetiredRecord[] =>
  records.filter((r): r is RetiredRecord => r.verdict.kind === 'verdict').sort((a, b) => a.norad - b.norad);

const edgesOf = (config: Config): number[] => [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];
const pText = (r: SatRecord, config: Config): string => formatP(r.pKm, r.orbitSource.kind, edgesOf(config));
const f = (n: number): string => String(Math.round(n * 100) / 100);

/** A zigzag across the plot at +400 km. It tells the reader the scale above is compressed. */
function breakMark(x0: number, x1: number, y: number): string {
  const step = 8;
  let d = `M ${f(x0)} ${f(y)}`;
  for (let x = x0, up = true; x < x1; x += step, up = !up) {
    d += ` L ${f(Math.min(x + step / 2, x1))} ${f(y + (up ? -3 : 3))}`;
  }
  return `<path class="break-mark" d="${d}"/>`;
}
/**
 * Fog on the road: two soft layers of puffs, clipped to the protected zone, low in the band. Each layer is two
 * copies of one period side by side, so sliding it by one period (a CSS transform, 40 s and 90 s) loops without
 * a seam. It only lives inside the zone's own band, so it reads as the zone, not as a mark. Atmosphere: no data.
 */
function fogSvg(x: number, w: number, top: number, bottom: number): string {
  const h = bottom - top;
  const period = Math.max(300, Math.round(w));
  const layer = (cls: string, n: number, lift: number): string => {
    let puffs = '';
    for (let i = 0; i < 2 * n; i++) {
      const k = i % n; // the same puffs in both copies, so a slide of one period loops without a seam
      puffs += `<ellipse cx="${f(x + ((i + 0.5 + (k % 3) * 0.2) * period) / n)}" cy="${f(bottom - h * (lift + (k % 4) * 0.03))}" rx="${f(period / n)}" ry="${f(h * (0.2 + (k % 3) * 0.03))}"/>`;
    }
    return `<g class="fog-layer ${cls}" style="--fog-period:${period}px">${puffs}</g>`;
  };
  return `<g class="fog" clip-path="url(#fog-clip)" aria-hidden="true"><clipPath id="fog-clip"><rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(h)}"/></clipPath>${layer('fog-layer--a', 6, 0.2)}${layer('fog-layer--b', 4, 0.12)}</g>`;
}
function bandsSvg(config: Config, cols: Columns, narrow: boolean, stones: readonly Pos[], edges: readonly Box[]): string {
  const x = cols.gutter;
  const w = cols.width - cols.gutter - LAYOUT.right;
  const plotTop = LAYOUT.top;
  const plotBottom = LAYOUT.top + plotHeight();
  const out: string[] = [];
  // Night sky behind the ground above the wall, and a faint moon glow over the high ground. Atmosphere, not data.
  const skyBottom = yOf(config.thresholdHighKm);
  out.push(`<rect class="sky" x="${f(x)}" y="${f(plotTop)}" width="${f(w)}" height="${f(skyBottom - plotTop)}"/>`);
  out.push(`<ellipse class="moon-glow" cx="${f(x + w * 0.86)}" cy="${f(plotTop + 70)}" rx="${f(w * 0.13)}" ry="110"/>`);
  const zone = config.protectedZoneKm;
  const ticks = [...HIGH_TICKS_KM, SCALE.linearMaxKm, config.thresholdHighKm, config.thresholdLowKm, zone, 0, -zone, SCALE.minKm];
  const tickTexts = ticks.map((km) => axisText(formatSigned(km, 0), x - 6, yOf(km) + 4, 'end', 'tick'));
  const geo = axisText(CHART.geoLabel, x + 4, yOf(0) - 4, 'start', 'tick');
  const roadText = CHART.zoneLabel(zone);
  const roadTop = yOf(zone);
  const road = axisText(roadText, x + 8, roadTop + 14, 'start', 'name');
  const names = narrow ? [] : zoneNames(config, x, [...tickTexts.map((t) => t.box), geo.box, road.box, ...edges], stones, CHART.highGround);
  for (const band of bandsOf(config)) {
    // The top band reaches up into the strip for off-scale stones, and the bottom band down into its strip.
    const y1 = band.toKm >= SCALE.maxKm ? plotTop : yOf(band.toKm);
    const y0 = band.fromKm <= SCALE.minKm ? plotBottom : yOf(band.fromKm);
    out.push(`<rect class="band band--${band.id}" x="${f(x)}" y="${f(y1)}" width="${f(w)}" height="${f(y0 - y1)}"/>`);
    if (band.id === 'road') {
      out.push(fogSvg(x, w, y1, y0));
      // A crisp edge on both sides of the road, so the protected zone reads at a glance.
      out.push(`<line class="road-edge" x1="${f(x)}" x2="${f(x + w)}" y1="${f(y1)}" y2="${f(y1)}"/><line class="road-edge" x1="${f(x)}" x2="${f(x + w)}" y1="${f(y0)}" y2="${f(y0)}"/>`);
      out.push(`<text class="zone-label" x="${f(road.x)}" y="${f(road.y)}">${esc(roadText)}</text>`);
    }
  }
  // Edge lines and tick numbers. 0 is GEO. +400 is the break. Ticks above it are on the compressed scale.
  for (const [i, km] of ticks.entries()) {
    const y = f(yOf(km));
    const high = km > SCALE.linearMaxKm;
    // Lines at the real edges and limits only. Interior high-ground ticks are just labels.
    if (km !== SCALE.linearMaxKm && !(high && km !== SCALE.maxKm)) {
      out.push(`<line class="${km === 0 ? 'edge edge--geo' : 'edge'}" x1="${f(x)}" x2="${f(x + w)}" y1="${y}" y2="${y}"/>`);
    }
    out.push(`<text class="${high ? 'tick tick--high' : 'tick'}" x="${f(x - 6)}" y="${f(yOf(km) + 4)}" text-anchor="end">${esc(tickTexts[i]!.text)}</text>`);
    if (km === 0) out.push(`<text class="tick tick--geo" x="${f(geo.x)}" y="${f(geo.y)}">${esc(geo.text)}</text>`);
  }
  // The y axis as an instrument scale: a rule, a mark at every labelled tick, and a minor mark every 50 km in the linear part.
  out.push(`<line class="scale-line" x1="${f(x)}" x2="${f(x)}" y1="${f(plotTop)}" y2="${f(plotBottom)}"/>`);
  for (let km = SCALE.minKm; km <= SCALE.linearMaxKm; km += 50) {
    const major = ticks.includes(km);
    out.push(`<line class="${major ? 'scale-mark' : 'scale-minor'}" x1="${f(x - (major ? 6 : 3))}" x2="${f(x)}" y1="${f(yOf(km))}" y2="${f(yOf(km))}"/>`);
  }
  out.push(breakMark(x, x + w, yBreak()));
  for (const [i, t] of names.entries()) out.push(`<text class="${i === 0 ? 'break-label' : 'band-name'}" x="${f(t.x)}" y="${f(t.y)}">${esc(t.text)}</text>`);
  return out.join('');
}
function yearAxisSvg(cols: Columns): string {
  const y = LAYOUT.top + plotHeight() + 18;
  const base = LAYOUT.top + plotHeight();
  const out: string[] = [`<line class="scale-line" x1="${f(cols.gutter)}" x2="${f(cols.width - LAYOUT.right)}" y1="${f(base)}" y2="${f(base)}"/>`];
  for (const c of cols.list) {
    out.push(`<line class="${c.from !== null && c.from % 5 === 0 ? 'scale-mark' : 'scale-minor'}" x1="${f(c.x + c.width / 2)}" x2="${f(c.x + c.width / 2)}" y1="${f(base)}" y2="${f(base + (c.from !== null && c.from % 5 === 0 ? 6 : 3))}"/>`);
    const cx = f(c.x + c.width / 2);
    if (c.from === null) {
      out.push(`<text class="tick" x="${cx}" y="${f(y)}" text-anchor="middle">${esc(CHART.unknownYear)}</text>`);
    } else if (c.from % 5 === 0) {
      out.push(`<text class="tick" x="${cx}" y="${f(y)}" text-anchor="middle">${c.from}</text>`);
    }
  }
  out.push(`<text class="axis-title" x="${f(cols.gutter)}" y="${f(y + 20)}">${esc(CHART.yearAxisTitle)}</text>`);
  return out.join('');
}

function fccLineSvg(config: Config, cols: Columns, narrow: boolean): string {
  const year = Number(config.fccRuleDate.slice(0, 4));
  const x = cols.xOfYear(year, yearFraction(config.fccRuleDate));
  if (x === null) return '';
  const y0 = LAYOUT.top - 6;
  const y1 = LAYOUT.top + plotHeight();
  // The label sits in the top margin, clear of the stones. It flips to the left of the line near the right edge.
  const flip = x + 340 > cols.width;
  const label = narrow
    ? ''
    : `<text class="fcc-label" x="${f(flip ? x - 5 : x + 5)}" y="${f(y0 - 10)}" text-anchor="${flip ? 'end' : 'start'}">${esc(CHART.fccLabel)}</text>`;
  return `<g class="fcc"><line class="fcc-line" x1="${f(x)}" x2="${f(x)}" y1="${f(y0)}" y2="${f(y1)}"/>${label}</g>`;
}

interface Pos {
  x: number;
  y: number;
}
/**
 * A story stone: launched on or after the rule date, and unquiet or in a shallow grave (below the IADC disposal
 * threshold under the stated assumptions). These are the 36 in the headline, and the only stones drawn in lantern.
 */
export function isStory(r: RetiredRecord): boolean {
  const v = r.verdict;
  return v.era === null && (v.verdict === 'unquiet' || v.verdict === 'shallow grave');
}
/** The text of the tooltip: name, NORAD id, perigee with the mean-element uncertainty, verdict word. */
export function tipHtml(r: RetiredRecord, config: Config): string {
  const text = pText(r, config);
  const below = text.startsWith(MINUS);
  return (
    `<strong>${withSansDigits(r.name)}</strong> <span class="tip-id">NORAD ${r.norad}</span>` +
    `<br>${esc(TIP.perigee(text.replace(/^[+\u2212]/, ''), below, config.uncertaintyKm))}` +
    `<br>${esc(verdictCopy(r.verdict.verdict, config).word)}` +
    `<br><span class="tip-hint">${esc(TIP.open)}</span>`
  );
}
function stoneSvg(r: RetiredRecord, config: Config, pos: Pos, selected: number | null, tabStop: number | null): string {
  const off = offScale(r.pKm);
  const v = r.verdict;
  const text = pText(r, config);
  const label = stoneLabel(r.name, v.verdict, spokenKm(text), off, v.borderline);
  const story = isStory(r);
  // A story stone draws only in lantern, so it carries no moss (green). Its years since launch are on its card.
  const body = stoneBody({ verdict: v.verdict, moss: story ? 0 : mossStep(v.yearsSinceLaunch) });
  
  const angle = swayAngle(r.e, config);
  const delay = -((r.norad % 80) / 10);
  const shape =
    angle === null
      ? body
      : `<g class="sway" style="--sway-angle:${angle}deg;--sway-delay:${delay}s">${body}</g>`;
  let whisker = '';
  if (v.borderline) {
    const top = yOf(r.pKm + config.uncertaintyKm) - pos.y;
    const bottom = yOf(r.pKm - config.uncertaintyKm) - pos.y;
    const wx = LAYOUT.stoneWidth / 2 + 2.5;
    whisker =
      `<g class="whisker"><line x1="${wx}" x2="${wx}" y1="${f(top)}" y2="${f(bottom)}"/>` +
      `<line x1="${wx - 2}" x2="${wx + 2}" y1="${f(top)}" y2="${f(top)}"/>` +
      `<line x1="${wx - 2}" x2="${wx + 2}" y1="${f(bottom)}" y2="${f(bottom)}"/></g>`;
  }
  const hw = LAYOUT.stoneWidth / 2 + 1;
  const early = v.era === 'before FCC rule';
  const cls = `stone-link${selected === r.norad ? ' selected' : ''}`;
  // The story stones (launched on or after the rule date, unquiet or in a shallow grave) are drawn in lantern, with a
  // halo and a slow flicker. Stones launched before the rule date are moss, faint. The rest are muted bone.
  const posCls = `stone-pos${early ? ' stone-pos--early' : ''}${story ? ' stone-pos--story' : ' stone-pos--quiet'}`;
  // Flicker: 3 to 6 s, staggered by NORAD id, so no two neighbours light together.
  const flick = story ? ` style="--flicker:${(3 + ((r.norad * 7) % 7) / 2).toFixed(1)}s;--flicker-delay:-${(((r.norad * 13) % 50) / 10).toFixed(1)}s"` : '';
  const ring = story ? `<circle class="story-halo" cx="0" cy="${-LAYOUT.stoneHeight / 2}" r="${LAYOUT.stoneHeight * 1.5}"/>` : '';
  return (
    `<a class="${cls}" href="#/sat/${r.norad}" data-norad="${r.norad}" tabindex="${tabStop === r.norad ? 0 : -1}" aria-label="${esc(label)}">` +
    `<g class="${posCls}"${flick} transform="translate(${f(pos.x)} ${f(pos.y)})">` +
    `<rect class="hit" x="${-hw}" y="${-LAYOUT.stoneHeight - 2}" width="${2 * hw}" height="${LAYOUT.stoneHeight + 3}"/>` +
    ring +
    shape +
    whisker +
    `</g></a>`
  );
}
/** An unmarked-bones marker: a small plain diamond, no inscription, not a link. */
function boneSvg(r: SatRecord, config: Config, pos: Pos): string {
  const off = offScale(r.pKm);
  const text = pText(r, config);
  const label = `${r.name}, unmarked bones (${r.status}), perigee ${spokenKm(text)} kilometres${spokenKm(text).startsWith('minus') ? ', below GEO' : ' above GEO'}${off === null ? '' : ', off the drawn scale'}`;
  // The diamond is centred on the stone's base line, so it sits at the object's own height.
  return (
    `<g class="bone" data-norad="${r.norad}" role="img" aria-label="${esc(label)}">` +
    `<g transform="translate(${f(pos.x)} ${f(pos.y - 4)})"><path class="bone-mark" d="M 0 -4 L 4 0 L 0 4 L -4 0 Z"/></g></g>`
  );
}
export interface ChartModel {
  cols: Columns;
  stones: RetiredRecord[];
  bones: SatRecord[];
  /** Where each drawn stone and bone stands: x is the middle of its base. */
  pos: Map<number, Pos>;
  /** The stones in keyboard order. */
  nav: NavItem[];
  placed: Map<number, Placed>;
  /** Where each case-file name goes. It never overlaps a stone or another name. */
  labels: Map<number, LabelPlacement>;
}
/**
 * Columns and positions for the chart. `shown` is the filtered set. The layout covers all retired
 * payloads, not only the shown ones, so filtering never moves a stone.
 */
export function chartModel(reg: UiRegister, narrow: boolean, shown: readonly SatRecord[] = applyFilters(reg.records, NO_FILTERS)): ChartModel {
  const stones = retiredPayloads(shown);
  const bones = shown.filter((r) => r.verdict.kind === 'unmarked bones').sort((a, b) => a.norad - b.norad);
  const everyStone = retiredPayloads(reg.records);
  const laidOut = [...everyStone, ...bones];
  const { placed, widths } = layoutStones(laidOut.map((r) => ({ id: r.norad, column: r.launchYear, y: baseYOf(r.pKm) })));
  const cols = buildColumns(laidOut.map((r) => r.launchYear), narrow, widths);
  const pos = new Map<number, Pos>();
  const nav: NavItem[] = [];
  for (const r of [...stones, ...bones]) {
    const col = cols.find(r.launchYear);
    const p = placed.get(r.norad);
    if (col === undefined || p === undefined) continue;
    pos.set(r.norad, { x: col.x + col.width / 2 + p.dx, y: p.y });
  }
  for (const r of stones) {
    const col = cols.find(r.launchYear);
    const p = placed.get(r.norad);
    if (col !== undefined && p !== undefined) nav.push({ id: r.norad, col: cols.list.indexOf(col), y: p.y, dx: p.dx });
  }
  const named = stones.filter((r) => r.caseFile).map((r) => ({ id: r.norad, name: r.name, x: pos.get(r.norad)!.x, y: pos.get(r.norad)!.y }));
  const plot = { x0: cols.gutter, y0: LAYOUT.top, x1: cols.width - LAYOUT.right, y1: LAYOUT.top + plotHeight() };
  const labels = placeLabels(named, [...pos.values()], plot).placements;
  return { cols, stones, bones, pos, nav: navSort(nav), placed, labels };
}
/** The case-file names. Each has its own place, set by placeLabels, and a leader line when it stands apart. The stone's own label says the name to screen readers. */
function labelsSvg(model: ChartModel): string {
  const out = model.stones
    .filter((r) => model.labels.has(r.norad))
    .map((r) => {
      const l = model.labels.get(r.norad)!;
      const leader = l.leader === null ? '' : `<line class="stone-leader" x1="${f(l.leader.x1)}" y1="${f(l.leader.y1)}" x2="${f(l.leader.x2)}" y2="${f(l.leader.y2)}"/>`;
      return `<g class="stone-label">${leader}<text class="stone-name" x="${f(l.x)}" y="${f(l.y)}" text-anchor="${l.anchor}">${esc(r.name)}</text></g>`;
    });
  return out.length === 0 ? '' : `<g aria-hidden="true" pointer-events="none">${out.join('')}</g>`;
}
/** One label per edge: how many objects stand beyond the limit. Exact values are on the card and in the ledger. */
function edgeLabels(model: ChartModel): AxisText[] {
  const counts = offScaleCounts([...model.stones, ...model.bones].map((r) => r.pKm));
  const x = model.cols.gutter + 6;
  const out: AxisText[] = [];
  if (counts.above > 0) out.push(axisText(offScaleEdgeText('above', counts.above, SCALE.maxKm), x, LAYOUT.top + 14, 'start', 'tick'));
  if (counts.below > 0) out.push(axisText(offScaleEdgeText('below', counts.below, SCALE.minKm), x, LAYOUT.top + plotHeight() - 8, 'start', 'tick'));
  return out;
}
/**
 * The whole chart as an SVG string. `shown` is the filtered set (default: no filters, so no unmarked bones).
 * `tabStop` is the one stone that is in the Tab order (roving tabindex): the selected stone, or the first.
 * On a narrow screen the SVG has its natural width, and its container scrolls sideways.
 */
export function chartSvg(
  reg: UiRegister,
  narrow: boolean,
  selected: number | null = null,
  shown: readonly SatRecord[] = applyFilters(reg.records, NO_FILTERS),
  tabStop: number | null = selected,
): string {
  const config = reg.config;
  const model = chartModel(reg, narrow, shown);
  const { cols } = model;
  const edges = edgeLabels(model);
  const width = Math.max(cols.width, cols.gutter + 120);
  const height = LAYOUT.top + plotHeight() + LAYOUT.bottom;
  const stop = tabStop !== null && model.nav.some((n) => n.id === tabStop) ? tabStop : (model.nav[0]?.id ?? null);
  const size = narrow ? ` width="${f(width)}" height="${f(height)}"` : '';
  const parts = [
    `<svg class="chart${narrow ? ' chart--natural' : ''}" viewBox="0 0 ${f(width)} ${f(height)}"${size} role="group" aria-label="${esc(CHART.title)}" aria-describedby="chart-desc" focusable="false">`,
    `<desc id="chart-desc">${esc(chartDescription(config))}</desc>`,
    `<g aria-hidden="true">`,
    bandsSvg(config, cols, narrow, [...model.pos.values()], edges.map((t) => t.box)),
    `<text class="axis-title" x="8" y="18">${esc(CHART.axisTitle)}</text>`,
    yearAxisSvg(cols),
    fccLineSvg(config, cols, narrow),
    `</g>`,
    edges.map((t) => `<text class="edge-label" x="${f(t.x)}" y="${f(t.y)}">${esc(t.text)}</text>`).join(''),
    model.bones.map((r) => boneSvg(r, config, model.pos.get(r.norad)!)).join(''),
    model.stones.map((r) => stoneSvg(r, config, model.pos.get(r.norad)!, selected, stop)).join(''),
    labelsSvg(model),
    `</svg>`,
  ];
  return parts.join('');
}
export function legendHtml(config: Config): string {
  const bands = bandsOf(config)
    .map((b) => `<li><span class="swatch swatch--${b.id}" aria-hidden="true"></span>${esc(bandCopy(b.id, config).full)}</li>`)
    .join('');
  const verdicts = VERDICT_ORDER.map((v) => `<li>${glyphSvg(v)}<span>${esc(verdictCopy(v, config).pair)}</span></li>`).join('');
  const moss = MOSS_STEPS.map((label, i) => `<li>${glyphSvg('buried', (i + 1) as 1 | 2 | 3 | 4)}<span>${esc(label)}</span></li>`).join('');
  return (
    `<section class="legend" aria-labelledby="legend-title"><h2 id="legend-title">${esc(CHART.legendTitle)}</h2>` +
    `<h3>The ground</h3><ul class="legend-list">${bands}</ul>` +
    `<h3>The stones</h3><ul class="legend-list legend-list--glyphs">${verdicts}</ul>` +
    `<h3>${esc(LEGEND.moss)}</h3><ul class="legend-list legend-list--glyphs">${moss}</ul>` +
    `<ul class="legend-list legend-notes">` +
    `<li>${esc(LEGEND.sway(config))}</li><li>${esc(LEGEND.whisker(config))}</li>` +
    `<li>${esc(LEGEND.early)}</li><li>${esc(LEGEND.ring)}</li><li>${esc(LEGEND.named)}</li>` +
    `<li>${esc(LEGEND.fccLine)}</li><li>${esc(LEGEND.bones)}</li><li>${esc(LEGEND.offScale)}</li><li>${esc(LEGEND.unevenYears)}</li></ul></section>`
  );
}

export function cardHtml(r: RetiredRecord | undefined, config: Config): string {
  if (r === undefined) return `<p class="card-empty">${esc(CARD.empty)}</p>`;
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const rows: [string, string][] = [
    [CARD.perigee, `${pText(r, config)} km`],
    [CARD.apogee, `${formatSigned(r.qKm, decimals)} km`],
    [CARD.eccentricity, r.e.toFixed(5)],
    [CARD.dataAge, dataAge(r)],
  ];
  const notes: string[] = [assumptionsLine(config)];
  if (v.borderline) notes.push(CARD.borderline(config));
  if (v.era === 'before FCC rule') notes.push(CARD.beforeRule);
  if (r.launchDate === null) notes.push(r.launchYearSource === 'designator' ? CHART.designatorNote : CHART.mossUnknown);
  else if (v.yearsSinceLaunch !== null) notes.push(`${CARD.yearsSinceLaunch(v.yearsSinceLaunch)}. Launched ${r.launchDate}.`);
  return (
    `<h2 class="card-name">${withSansDigits(r.name)} <span class="card-id">NORAD ${r.norad}</span></h2>` +
    badgeHtml(v.verdict, config) +
    `<dl class="card-data">${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>` +
    `<ul class="card-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` +
    `<p class="card-actions"><a class="button button--primary" href="#/sat/${r.norad}">${esc(CARD.ledger)}</a> <button type="button" class="button button--quiet" data-clear>${esc(CARD.close)}</button></p>`
  );
}

/** What Enter does on a focused stone: select it, or open its ledger when it is already selected. */
export const enterAction = (selected: number | null, norad: number): 'select' | 'open' => (selected === norad ? 'open' : 'select');
export interface HeroStat {
  id: 'post-rule' | 'zone' | 'validation';
  /** The big figure. */
  value: string;
  /** Said after the figure, on the same line. */
  of: string | null;
  label: string;
  sub: string;
}
/**
 * The three tiles. Every figure comes from the engine's own summaries (the same ones the census page
 * shows), so a tile can never differ from the census. The ESA range appears only when it was checked in its source.
 */
export function heroStats(reg: Pick<UiRegister, 'records' | 'config'>, comparisons = COMPARISONS): HeroStat[] {
  const s = postRuleSummary(reg.records);
  const d = disposalRate(reg.records, reg.config);
  const esa = comparisons.find((c) => c.id === 'esa' && c.verified && c.where !== null && c.range !== null);
  const range = esa?.range ?? null;
  return [
    { id: 'post-rule', value: formatCount(s.postRule), of: null, label: HERO.postRule.label, sub: HERO.postRule.sub },
    { id: 'zone', value: formatCount(s.inOrNearZone), of: HERO.zone.of(s.postRule), label: HERO.zone.label, sub: HERO.zone.sub },
    {
      id: 'validation',
      value: d.n === 0 ? '\u2013' : `${Math.round((100 * d.central) / d.n)}%`,
      of: null,
      label: HERO.validation.label(range),
      sub: HERO.validation.sub(d.afterLaunchYear),
    },
  ];
}
/**
 * The churchyard's hero: a kicker, one headline sentence with the two post-rule figures (the only place the
 * churchyard says "131"; the full tile grid, including the ESA comparison, moved to the census so the number
 * is said once per figure, not duplicated across views), and a one-line reading with the rest of the
 * disclosures one click away behind "Limits". The headline is a link to the census, where both figures are
 * broken down further.
 */
export function heroHtml(reg: UiRegister): string {
  const config = reg.config;
  const s = postRuleSummary(reg.records);
  const fine = fineHtml(
    reg.snapshot.set,
    config,
    [
      assumptionsLine(config),
      CHURCHYARD_INTRO.blindSpot,
      CHURCHYARD_INTRO.voluntary,
      CHURCHYARD_INTRO.noRetirementDate,
      FILTERS.drawnUnfiltered(retiredPayloads(reg.records).length),
    ],
    undefined,
    true,
  );
  return (
    `<div class="hero"><p class="kicker">${esc(HERO.kicker)}</p>` +
    `<p class="headline"><a class="headline-link" href="#/census">` +
    `<span class="headline-figure">${esc(HERO.headlineFigure(s.inOrNearZone, s.postRule))}</span> ` +
    `<span class="headline-label">${esc(HERO.headlineLabel)}</span></a></p>` +
    `<p class="headline-sub">${esc(HERO.headlineSub)}</p>${fine}</div>`
  );
}
/**
 * True only when the hash query carries `cover=1`. Used solely to draw the cover capture (a compact title over
 * the bare chart, with the header, readings strip and controls hidden), for screenshots such as the Devpost
 * cover image. It never changes the page when the flag is absent.
 */
export function isCoverCapture(query: URLSearchParams): boolean {
  return query.get('cover') === '1';
}
/** "Sexton: 36 of 131 retired GEO payloads launched since the 2002 FCC rule sit in or near the protected zone", for the cover capture only. */
export function coverTitle(reg: Pick<UiRegister, 'records'>): string {
  const s = postRuleSummary(reg.records);
  return `${SITE.title}: ${formatCount(s.inOrNearZone)} of ${formatCount(s.postRule)} retired GEO payloads launched since the 2002 FCC rule sit in or near the protected zone`;
}
/** The verdict words with their stone shapes, in one row beside the chart. The meanings are in the guide below. */
export function compactLegendHtml(config: Config): string {
  const items = VERDICT_ORDER.map(
    (v) => `<li title="${esc(verdictCopy(v, config).meaning)}">${glyphSvg(v)}<span>${esc(verdictCopy(v, config).word)}</span></li>`,
  ).join('');
  return `<div class="legend-strip"><ul class="legend-strip-list">${items}</ul></div>`;
}

export function introHtml(reg: UiRegister): string {
  const n = retiredPayloads(reg.records).length;
  return (
    `<div class="intro"><div class="intro-col"><p>${esc(CHURCHYARD_INTRO.lead)}</p>` +
    `<ul class="terms"><li>${esc(TERMS.eccentricity)}</li></ul></div>` +
    `<div class="intro-col"><p>${esc(CHURCHYARD_INTRO.voluntary)} ${esc(CHURCHYARD_INTRO.noRetirementDate)}</p>` +
    `<p class="count">${esc(countLine(n, reg.snapshot.set))} ${esc(CHURCHYARD_INTRO.blindSpot)}</p></div></div>`
  );
}

/** sessionStorage, or null where it is blocked. */
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
/** The selected stone survives a redraw (for example when the screen crosses the phone width). */
let remembered: number | null = null;
/**
 * Draws the churchyard into `root` and wires filters and selection. `query` is the hash query.
 * Returns a function that removes the listeners.
 */
export function mountChurchyard(root: HTMLElement, reg: UiRegister, narrow: boolean, query: URLSearchParams): () => void {
  const config = reg.config;
  const byId = new Map(retiredPayloads(reg.records).map((r) => [r.norad, r]));
  let state: ViewState = parseState(query);
  let selected: number | null = remembered !== null && byId.has(remembered) ? remembered : null;
  const hasStones = byId.size > 0;
  // `?cover=1` draws the bare chart with a compact title in place of the header, the readings strip and the
  // controls, for a screenshot (the Devpost cover). It changes nothing else: the chart, selection and filters
  // still work as drawn, and the flag is read nowhere but here.
  const cover = isCoverCapture(query);
  root.classList.toggle('cover-capture', cover);
  root.innerHTML =
    (cover ? `<p class="cover-title">${esc(coverTitle(reg))}</p>` : heroHtml(reg)) +
    `<section class="stage" aria-label="${esc(PAGE_TITLES.churchyard)}">` +
    `<div class="toolbar">` +
    filtersHtml(reg.records, state.filters, config, false) +
    `<p class="status visually-hidden" id="chart-status" role="status"></p>` +
    (hasStones ? `<a class="skip-link skip-link--inline" id="skip-table" href="#/table">${esc(SITE.skipToTable)}</a>${compactLegendHtml(config)}` : '') +
    (hasStones ? `<div id="tour-start-host" class="toolbar-tour-start"></div>` : '') +
    `<button type="button" class="button button--quiet toolbar-guide" data-open-guide>${esc(HERO.guideHint)}</button>` +
    `</div>` +
    (hasStones
      ? `<div class="stage-head"><div class="stage-lead"><div id="tour-host"></div><p class="stage-caption">${esc(HERO.caption)}</p></div></div>` +
        (narrow ? `<p class="chart-note">${esc(CHART.scrollNote)} <a id="scroll-table" href="#/table">${esc(CHART.scrollLink)}</a>.</p>` : '') +
        `<div class="plot"><div class="chart-wrap${narrow ? ' chart-wrap--scroll' : ''}" id="chart-host"${narrow ? ` role="region" aria-label="${esc(CHART.scrollRegion)}"` : ''}></div>` +
        `<div class="tip" id="stone-tip" hidden aria-hidden="true"></div>` +
        emptyFiltersHtml('chart-empty') +
        `<section class="card" id="stone-card" aria-live="polite" aria-label="Selected stone"></section></div>`
      : `<p class="empty">${esc(CHART.empty)}</p>`) +
    `</section>` +
    `<details class="guide" id="guide"><summary>${esc(HERO.guide)}</summary><div class="guide-body">${introHtml(reg)}${legendHtml(config)}</div></details>`;
  const form = root.querySelector<HTMLFormElement>('#filters')!;
  const status = root.querySelector<HTMLElement>('#chart-status')!;
  const host = root.querySelector<HTMLElement>('#chart-host');
  const card = root.querySelector<HTMLElement>('#stone-card');
  const plot = root.querySelector<HTMLElement>('.plot');
  const skip = root.querySelector<HTMLAnchorElement>('#skip-table');
  const scrollLink = root.querySelector<HTMLAnchorElement>('#scroll-table');
  // The one stone in the Tab order (roving tabindex). It follows focus, and survives a redraw.
  let tabStop: number | null = null;
  let nav: NavItem[] = [];
  /** The card floats over one corner of the chart. It takes the side away from the selected stone, and swaps if it would still cover the stone or the FCC line. */
  const placeCard = (): void => {
    if (card === null || host === null) return;
    const stone = host.querySelector<SVGAElement>('a.stone-link.selected');
    card.classList.remove('card--left');
    if (stone === null) return;
    const box = host.getBoundingClientRect();
    const at = stone.getBoundingClientRect();
    const fcc = host.querySelector('.fcc-line')?.getBoundingClientRect();
    const hits = (): number => {
      const c = card.getBoundingClientRect();
      return [at, fcc].filter((r) => r !== undefined && c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom).length;
    };
    card.classList.toggle('card--left', at.left + at.width / 2 > box.left + box.width / 2);
    const first = hits();
    if (first === 0) return;
    card.classList.toggle('card--left');
    if (hits() > first) card.classList.toggle('card--left');
  };
  let scrolled = false;
  const draw = (): void => {
    const shown = applyFilters(reg.records, state.filters);
    const drawn = drawnInChurchyard(shown);
    // A selected stone that the filters hide is cleared.
    if (selected !== null && !drawn.some((r) => r.norad === selected)) {
      selected = null;
      remembered = null;
    }
    const fineDrawn = root.querySelector<HTMLElement>('#fine-drawn');
    if (fineDrawn !== null) fineDrawn.textContent = FILTERS.drawnShort(drawn.length);
    status.textContent = !hasFilters(state.filters)
      ? FILTERS.drawnUnfiltered(drawn.length)
      : drawn.length === 0
        ? FILTERS.none
        : `${FILTERS.count(shown.length, reg.records.length)} ${FILTERS.drawn(drawn.length)}`;
    // The filters hide every stone: say so over the empty ground, with a way out.
    const empty = root.querySelector<HTMLElement>('#chart-empty');
    if (empty !== null) empty.hidden = drawn.length > 0 || !hasFilters(state.filters);
    if (host !== null) {
      host.innerHTML = chartSvg(reg, narrow, selected, drawn, tabStop ?? selected);
      const model = chartModel(reg, narrow, shown);
      nav = model.nav;
      // On a phone the chart opens with the FCC line near the left edge, so the lantern stones are in view.
      const line = host.querySelector('.fcc-line');
      if (narrow && !scrolled && line !== null) host.scrollLeft = Number(line.getAttribute('x1')) - 24; // the FCC line starts 24 px from the left edge
      scrolled = true;
      // The card floats inside the plot, clear of the axis column: tell the stylesheet where the plot starts and ends.
      const vb = host.querySelector('svg')?.viewBox.baseVal;
      if (plot !== null && vb !== undefined && vb.width > 0 && vb.height > 0) {
        const vars: [string, number, number][] = [['--axis', model.cols.gutter, vb.width], ['--plot-right', LAYOUT.right, vb.width], ['--plot-top', LAYOUT.top, vb.height], ['--plot-bottom', LAYOUT.bottom, vb.height]];
        for (const [name, n, of] of vars) plot.style.setProperty(name, `${(n / of) * 100}%`);
      }
      const stop = host.querySelector<HTMLElement>('a.stone-link[tabindex="0"]');
      tabStop = stop === null ? null : Number(stop.dataset['norad']);
    }
    if (card !== null) {
      card.innerHTML = cardHtml(selected === null ? undefined : byId.get(selected), config);
      placeCard();
    }
    if (skip !== null) skip.href = hashFor('table', state);
    if (scrollLink !== null) scrollLink.href = hashFor('table', state);
  };
  draw();
  const unwire = wireFilters(
    form,
    () => state,
    (next) => {
      state = next;
    },
    draw,
    { records: reg.records, config },
  );
  const select = (norad: number | null): void => {
    selected = norad;
    remembered = norad;
    for (const a of root.querySelectorAll<SVGAElement>('a.stone-link')) {
      a.classList.toggle('selected', a.dataset['norad'] === String(norad));
    }
    if (card !== null) {
      card.innerHTML = cardHtml(norad === null ? undefined : byId.get(norad), config);
      placeCard();
    }
  };
  // The guided tour: four steps, then free exploration. It can be skipped, and it remembers that.
  const steps = tourSteps(reg);
  const tourHost = root.querySelector<HTMLElement>('#tour-host');
  const tourStartHost = root.querySelector<HTMLElement>('#tour-start-host');
  // `?demo=1` (K1): the opening plays every time, the tour stays out of the way, and EchoStar 7 is selected at the end.
  const demo = query.get('demo') === '1' && !cover;
  let tourStep: number | null = demo || steps.length === 0 || tourSkipped() ? null : 0;
  const showTour = (focus: string | null): void => {
    if (tourHost === null) return;
    // In free mode the single "Take the tour" button sits in the toolbar, beside the filters, so no row holds
    // only that link. The step bar (count, text, actions) still stands above the caption, full width.
    tourHost.innerHTML = tourStep === null ? '' : tourHtml(tourStep, steps);
    if (tourStartHost !== null) tourStartHost.innerHTML = tourStep === null && !demo ? tourHtml(null, steps) : '';
    if (plot !== null) {
      if (tourStep === null) delete plot.dataset['tour'];
      else plot.dataset['tour'] = String(tourStep + 1);
    }
    if (focus !== null) (tourHost.querySelector<HTMLElement>(focus) ?? tourStartHost?.querySelector<HTMLElement>(focus))?.focus();
  };
  const goTour = (to: number | null, focus: string | null): void => {
    const before = tourStep === null ? null : steps[tourStep]!.select;
    tourStep = to;
    const want = to === null ? null : steps[to]!.select;
    if (want !== null) select(want);
    else if (before !== null && selected === before) select(null);
    showTour(focus);
  };
  showTour(null);
  // The opening (C1): the story lanterns light one by one in launch order while the headline counts up. Any key,
  // click or scroll skips to the end. Reduced motion shows the end at once. Screen readers get only the final headline:
  // the counting figure is hidden from them, and a hidden copy of the final figure stands beside it.
  let intro: IntroHandle | null = null;
  const skipEvents = ['keydown', 'pointerdown', 'wheel', 'touchstart', 'scroll'] as const;
  const onSkip = (): void => intro?.skip();
  const afterIntro = (): void => {
    if (demo && byId.has(ECHOSTAR_7)) select(ECHOSTAR_7);
  };
  const startIntro = (): void => {
    if (cover || host === null || plot === null) return;
    const storage = sessionStore();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shouldAnimate({ reduced, demo, played: introPlayed(storage) })) {
      afterIntro();
      return;
    }
    rememberIntro(storage);
    const order = lanternOrder(reg.records).filter((n) => host.querySelector(`a[data-norad="${n}"] .stone-pos--story`) !== null);
    const s = postRuleSummary(reg.records);
    const figure = root.querySelector<HTMLElement>('.headline-figure');
    const final = figure?.textContent ?? '';
    const spoken = document.createElement('span');
    spoken.className = 'visually-hidden';
    spoken.textContent = final;
    if (figure !== null) {
      figure.setAttribute('aria-hidden', 'true');
      figure.after(spoken);
      figure.textContent = HERO.headlineFigure(0, s.postRule);
    }
    plot.dataset['intro'] = '';
    const stoneOf = (n: number): Element | null => host.querySelector(`a[data-norad="${n}"] .stone-pos--story`);
    let lit = 0;
    intro = runIntro(
      order.length,
      { now: () => performance.now(), frame: (cb) => window.requestAnimationFrame(cb), cancel: (id) => window.cancelAnimationFrame(id) },
      (k) => {
        for (; lit < k; lit++) stoneOf(order[lit]!)?.classList.add('is-lit');
        if (figure !== null) figure.textContent = HERO.headlineFigure(Math.round((k * s.inOrNearZone) / Math.max(order.length, 1)), s.postRule);
      },
      () => {
        for (const e of skipEvents) window.removeEventListener(e, onSkip, true);
        delete plot.dataset['intro'];
        for (const el of host.querySelectorAll('.is-lit')) el.classList.remove('is-lit');
        if (figure !== null) {
          figure.textContent = final;
          figure.removeAttribute('aria-hidden');
        }
        spoken.remove();
        intro = null;
        afterIntro();
      },
    );
    if (intro !== null) for (const e of skipEvents) window.addEventListener(e, onSkip, { capture: true, passive: true });
  };
  // A click or tap on a stone selects it and shows its card. A double-click, Enter on the selected stone, or the
  // card's button opens the ledger. A click with a modifier key keeps the link's own behaviour.
  const openLedger = (norad: number): void => {
    remembered = norad;
    window.location.hash = `#/sat/${norad}`;
  };
  const onClick = (event: MouseEvent): void => {
    const target = event.target as Element;
    const link = target.closest<SVGAElement>('a.stone-link');
    if (link !== null) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      select(Number(link.dataset['norad']));
      return;
    }
    if (target.closest('[data-clear]') !== null) select(null);
    if (target.closest('[data-empty-clear]') !== null) form.querySelector<HTMLButtonElement>('[data-clear-filters]')?.click();
    const tourBtn = target.closest<HTMLElement>('[data-tour], [data-tour-start]');
    if (tourBtn !== null && tourStep !== null) {
      const act = tourBtn.dataset['tour'];
      if (act === 'next') goTour(moveStep(tourStep, 1, steps.length), '[data-tour="next"], [data-tour="done"]');
      else if (act === 'back') goTour(moveStep(tourStep, -1, steps.length), tourStep === 1 ? '[data-tour="next"]' : '[data-tour="back"]');
      else {
        if (act === 'skip') rememberSkip();
        goTour(null, '[data-tour-start]');
      }
    } else if (tourBtn !== null) goTour(0, '[data-tour="next"]');
    if (target.closest('[data-open-guide]') !== null) {
      const guide = root.querySelector<HTMLDetailsElement>('#guide');
      if (guide !== null) {
        guide.open = true;
        guide.querySelector('summary')?.focus();
        guide.scrollIntoView({ block: 'start' });
      }
    }
  };
  const onDblClick = (event: MouseEvent): void => {
    const link = stoneOf(event.target);
    if (link !== null) openLedger(Number(link.dataset['norad']));
  };
  // The tooltip shows on hover and on keyboard focus, and Escape closes it. It stays while the pointer is over it.
  const tip = root.querySelector<HTMLElement>('#stone-tip');
  let tipTimer: number | undefined;
  const hideTip = (): void => {
    window.clearTimeout(tipTimer);
    if (tip !== null) tip.hidden = true;
  };
  const showTip = (link: SVGAElement): void => {
    const r = byId.get(Number(link.dataset['norad']));
    if (tip === null || r === undefined) return;
    window.clearTimeout(tipTimer);
    tip.innerHTML = tipHtml(r, config);
    tip.hidden = false;
    const box = link.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(Math.max(8, box.left + box.width / 2 - w / 2), Math.max(8, window.innerWidth - w - 8));
    const above = box.top - h - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${above >= 8 ? above : box.bottom + 8}px`;
  };
  const delayHide = (): void => {
    window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(hideTip, 150);
  };
  const onOver = (event: Event): void => {
    const link = stoneOf(event.target);
    if (link !== null) showTip(link);
    else if (event.target instanceof Element && event.target.closest('#stone-tip') !== null) window.clearTimeout(tipTimer);
  };
  const onOut = (event: Event): void => {
    if (stoneOf(event.target) !== null || (event.target instanceof Element && event.target.closest('#stone-tip') !== null)) delayHide();
  };
  function stoneOf(target: EventTarget | null): SVGAElement | null {
    return target instanceof Element ? target.closest<SVGAElement>('a.stone-link') : null;
  }
  /** Moves the Tab stop to one stone. */
  const setTabStop = (norad: number): void => {
    if (host === null || tabStop === norad) return;
    host.querySelector('a.stone-link[tabindex="0"]')?.setAttribute('tabindex', '-1');
    host.querySelector(`a.stone-link[data-norad="${norad}"]`)?.setAttribute('tabindex', '0');
    tabStop = norad;
  };
  const onFocusIn = (event: Event): void => {
    const link = stoneOf(event.target);
    if (link !== null) {
      setTabStop(Number(link.dataset['norad']));
      showTip(link);
    }
  };
  const onFocusOut = (event: Event): void => {
    if (stoneOf(event.target) !== null) hideTip();
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      hideTip();
      if (selected !== null && event.target instanceof Element && event.target.closest('.plot') !== null) {
        const back = host?.querySelector<SVGAElement>(`a.stone-link[data-norad="${selected}"]`);
        select(null);
        // Focus stays on the stone if the card was the thing that had it.
        if (back !== null && back !== undefined && !(event.target instanceof SVGElement)) back.focus();
      }
      return;
    }
    const link = stoneOf(event.target);
    if (link === null || event.altKey || event.ctrlKey || event.metaKey) return;
    const norad = Number(link.dataset['norad']);
    if (event.key === 'Enter') {
      // Enter selects. Enter on the stone that is already selected opens its ledger.
      event.preventDefault();
      if (enterAction(selected, norad) === 'open') openLedger(norad);
      else select(norad);
      return;
    }
    if (!(NAV_KEYS as readonly string[]).includes(event.key)) return;
    event.preventDefault();
    const next = nextInNav(nav, norad, event.key);
    if (next === null || next === norad) return;
    setTabStop(next);
    host?.querySelector<SVGAElement>(`a.stone-link[data-norad="${next}"]`)?.focus();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('dblclick', onDblClick);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('keydown', onKeydown);
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerout', onOut);
  startIntro();
  return () => {
    intro?.stop();
    for (const e of skipEvents) window.removeEventListener(e, onSkip, true);
    hideTip();
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerout', onOut);
    unwire();
    root.removeEventListener('click', onClick);
    root.removeEventListener('dblclick', onDblClick);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('keydown', onKeydown);
  };
}
