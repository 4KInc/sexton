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
import { filtersHtml, wireFilters } from './filters.ts';
import { bandsOf } from '../svg/bands.ts';
import { stoneBody, stoneDefs } from '../svg/headstone.ts';
import { placeLabels } from '../svg/labels.ts';
import type { LabelPlacement } from '../svg/labels.ts';
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
function bandsSvg(config: Config, cols: Columns, narrow: boolean): string {
  const x = cols.gutter;
  const w = cols.width - cols.gutter - LAYOUT.right;
  const plotTop = LAYOUT.top;
  const plotBottom = LAYOUT.top + plotHeight();
  const out: string[] = [];
  // Night sky behind the ground above the wall, and a faint moon glow over the high ground. Atmosphere, not data.
  const skyBottom = yOf(config.thresholdHighKm);
  out.push(`<rect class="sky" x="${f(x)}" y="${f(plotTop)}" width="${f(w)}" height="${f(skyBottom - plotTop)}"/>`);
  out.push(`<ellipse class="moon-glow" cx="${f(x + w * 0.16)}" cy="${f(yBreak() - 30)}" rx="${f(w * 0.2)}" ry="95"/>`);
  for (const band of bandsOf(config)) {
    // The top band reaches up into the strip for off-scale stones, and the bottom band down into its strip.
    const y1 = band.toKm >= SCALE.maxKm ? plotTop : yOf(band.toKm);
    const y0 = band.fromKm <= SCALE.minKm ? plotBottom : yOf(band.fromKm);
    const copy = bandCopy(band.id, config);
    out.push(`<rect class="band band--${band.id}" x="${f(x)}" y="${f(y1)}" width="${f(w)}" height="${f(y0 - y1)}"/>`);
    if (band.id === 'road') {
      // A crisp edge on both sides of the road, so the protected zone reads at a glance.
      out.push(`<line class="road-edge" x1="${f(x)}" x2="${f(x + w)}" y1="${f(y1)}" y2="${f(y1)}"/><line class="road-edge" x1="${f(x)}" x2="${f(x + w)}" y1="${f(y0)}" y2="${f(y0)}"/>`);
    }
    if (!narrow) {
      // The name sits in the linear part of its band.
      const ly1 = band.toKm > SCALE.linearMaxKm ? yBreak() : y1;
      const ly0 = band.fromKm <= SCALE.minKm ? yOf(SCALE.minKm) : y0;
      out.push(`<text class="band-name" x="8" y="${f((ly0 + ly1) / 2 + 4)}">${esc(copy.short)}</text>`);
    }
  }
  // Edge lines and tick numbers. 0 is GEO. +400 is the break. Ticks above it are on the compressed scale.
  const zone = config.protectedZoneKm;
  const ticks = [...HIGH_TICKS_KM, SCALE.linearMaxKm, config.thresholdHighKm, config.thresholdLowKm, zone, 0, -zone, SCALE.minKm];
  for (const km of ticks) {
    const y = f(yOf(km));
    const high = km > SCALE.linearMaxKm;
    // Lines at the real edges and limits only. Interior high-ground ticks are just labels.
    if (km !== SCALE.linearMaxKm && !(high && km !== SCALE.maxKm)) {
      out.push(`<line class="${km === 0 ? 'edge edge--geo' : 'edge'}" x1="${f(x)}" x2="${f(x + w)}" y1="${y}" y2="${y}"/>`);
    }
    out.push(`<text class="${high ? 'tick tick--high' : 'tick'}" x="${f(x - 6)}" y="${f(yOf(km) + 4)}" text-anchor="end">${esc(formatSigned(km, 0))}</text>`);
    if (km === 0) out.push(`<text class="tick tick--geo" x="${f(x + 4)}" y="${f(yOf(km) - 4)}">${esc(CHART.geoLabel)}</text>`);
  }
  out.push(breakMark(x, x + w, yBreak()));
  if (!narrow) out.push(`<text class="break-label" x="8" y="${f(yBreak() - 8)}">${esc(CHART.highGround)}</text>`);
  return out.join('');
}
function yearAxisSvg(cols: Columns): string {
  const y = LAYOUT.top + plotHeight() + 18;
  const out: string[] = [];
  for (const c of cols.list) {
    const cx = f(c.x + c.width / 2);
    if (c.from === null) {
      out.push(`<text class="tick" x="${cx}" y="${f(y)}" text-anchor="middle"><title>${esc(CHART.unknownYearTitle)}</title>${esc(CHART.unknownYear)}</text>`);
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
    : `<text class="fcc-label" x="${f(flip ? x - 5 : x + 5)}" y="${f(y0 - 10)}" text-anchor="${flip ? 'end' : 'start'}">${esc(CHART.fccLine)}</text>`;
  return `<g class="fcc"><line class="fcc-line" x1="${f(x)}" x2="${f(x)}" y1="${f(y0)}" y2="${f(y1)}"/><title>${esc(CHART.fccLine)}</title>${label}</g>`;
}

interface Pos {
  x: number;
  y: number;
}
/** Launched on or after the rule date, and below the IADC disposal threshold under the stated assumptions. */
export function isFlagged(r: RetiredRecord): boolean {
  const v = r.verdict;
  return v.era === null && (v.verdict === 'fallen' || v.verdict === 'unquiet' || v.verdict === 'shallow grave');
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
  const body = stoneBody({ verdict: v.verdict, moss: mossStep(v.yearsSinceLaunch) });
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
  const flagged = isFlagged(r);
  const cls = `stone-link${selected === r.norad ? ' selected' : ''}`;
  const posCls = `stone-pos${early ? ' stone-pos--early' : ''}${flagged ? ' stone-pos--ring' : ''}`;
  const ring = flagged
    ? `<rect class="flag-ring" x="${-hw - 2}" y="${-LAYOUT.stoneHeight - 4}" width="${2 * hw + 4}" height="${LAYOUT.stoneHeight + 7}" rx="5"/>`
    : '';
  return (
    `<a class="${cls}" href="#/sat/${r.norad}" data-norad="${r.norad}" tabindex="${tabStop === r.norad ? 0 : -1}" aria-label="${esc(label)}">` +
    `<title>${esc(label)}</title>` +
    `<g class="${posCls}" transform="translate(${f(pos.x)} ${f(pos.y)})">` +
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
    `<g class="bone" data-norad="${r.norad}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>` +
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
function edgeLabelsSvg(model: ChartModel): string {
  const counts = offScaleCounts([...model.stones, ...model.bones].map((r) => r.pKm));
  const x = model.cols.gutter + 6;
  const out: string[] = [];
  if (counts.above > 0) {
    out.push(`<text class="edge-label" x="${f(x)}" y="${f(LAYOUT.top + 14)}">${esc(offScaleEdgeText('above', counts.above, SCALE.maxKm))}</text>`);
  }
  if (counts.below > 0) {
    out.push(`<text class="edge-label" x="${f(x)}" y="${f(LAYOUT.top + plotHeight() - 8)}">${esc(offScaleEdgeText('below', counts.below, SCALE.minKm))}</text>`);
  }
  return out.join('');
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
  const width = Math.max(cols.width, cols.gutter + 120);
  const height = LAYOUT.top + plotHeight() + LAYOUT.bottom;
  const stop = tabStop !== null && model.nav.some((n) => n.id === tabStop) ? tabStop : (model.nav[0]?.id ?? null);
  const size = narrow ? ` width="${f(width)}" height="${f(height)}"` : '';
  const parts = [
    `<svg class="chart${narrow ? ' chart--natural' : ''}" viewBox="0 0 ${f(width)} ${f(height)}"${size} role="group" aria-labelledby="chart-title chart-desc" focusable="false">`,
    `<title id="chart-title">${esc(CHART.title)}</title>`,
    `<desc id="chart-desc">${esc(chartDescription(config))}</desc>`,
    `<defs>${stoneDefs()}<linearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1"><stop class="sky-stop-top" offset="0"/><stop class="sky-stop-bottom" offset="1"/></linearGradient><radialGradient id="moon-fade"><stop class="moon-stop-in" offset="0"/><stop class="moon-stop-out" offset="1"/></radialGradient><linearGradient id="wall-shade" x1="0" y1="1" x2="0" y2="0"><stop class="wall-stop-low" offset="0"/><stop class="wall-stop-high" offset="1"/></linearGradient></defs>`,
    `<g aria-hidden="true">`,
    bandsSvg(config, cols, narrow),
    `<text class="axis-title" x="8" y="18">${esc(CHART.axisTitle)}</text>`,
    yearAxisSvg(cols),
    fccLineSvg(config, cols, narrow),
    `</g>`,
    edgeLabelsSvg(model),
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
      label: range === null ? HERO.validation.labelNoRange : HERO.validation.label(range[0], range[1]),
      sub: HERO.validation.sub(d.afterLaunchYear),
    },
  ];
}
/** Digits, and a percent sign after them, in the sans: the serif draws old-style figures. */
const sansFigure = (text: string): string => esc(text).replace(/\d+%?/g, '<span class="num">$&</span>');
export function heroHtml(reg: UiRegister): string {
  const config = reg.config;
  const stats = heroStats(reg);
  const tiles = stats
    .map(
      (t) =>
        `<li class="tile tile--${t.id}"><a class="tile-link" href="#/census"><span class="tile-figure">${sansFigure(t.value)}${t.of === null ? '' : `<span class="tile-of">${withSansDigits(t.of)}</span>`}</span>` +
        `<span class="tile-label">${esc(t.label)}</span><span class="tile-sub">${esc(t.sub)}</span></a></li>`,
    )
    .join('');
  const d = disposalRate(reg.records, config);
  const fine = fineHtml(reg.snapshot.set, config, [
    assumptionsLine(config),
    CHURCHYARD_INTRO.blindSpot,
    CHURCHYARD_INTRO.voluntary,
    CHURCHYARD_INTRO.noRetirementDate,
    VALIDATION.intro(d.afterLaunchYear),
  ]);
  return (
    `<div class="hero"><ul class="tiles" aria-label="${esc(HERO.tilesLabel)}">${tiles}</ul>` +
    `${fine}</div>`
  );
}
/** The verdict words with their stone shapes, in one row beside the chart. The meanings are in the guide below. */
export function compactLegendHtml(config: Config): string {
  const items = VERDICT_ORDER.map(
    (v) => `<li>${glyphSvg(v)}<span>${esc(verdictCopy(v, config).word)}</span></li>`,
  ).join('');
  return `<div class="legend-strip"><ul class="legend-strip-list" aria-label="${esc(HERO.legendLabel)}">${items}</ul></div>`;
}

export function introHtml(reg: UiRegister): string {
  const n = retiredPayloads(reg.records).length;
  return (
    `<div class="intro"><div class="intro-col"><p>${esc(CHURCHYARD_INTRO.lead)}</p>` +
    `<ul class="terms"><li>${esc(TERMS.geo)}</li><li>${esc(TERMS.perigee)}</li><li>${esc(TERMS.eccentricity)}</li></ul></div>` +
    `<div class="intro-col"><p>${esc(CHURCHYARD_INTRO.voluntary)} ${esc(CHURCHYARD_INTRO.noRetirementDate)}</p>` +
    `<p class="count">${esc(countLine(n, reg.snapshot.set))} ${esc(CHURCHYARD_INTRO.blindSpot)}</p></div></div>`
  );
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
  root.innerHTML =
    heroHtml(reg) +
    `<section class="stage" aria-label="${esc(PAGE_TITLES.churchyard)}">` +
    `<div class="toolbar">` +
    filtersHtml(reg.records, state.filters, config, hasFilters(state.filters)) +
    `<p class="status" id="chart-status" role="status"></p>` +
    (hasStones ? `<a class="skip-link skip-link--inline" id="skip-table" href="#/table">${esc(SITE.skipToTable)}</a>` : '') +
    `<button type="button" class="button button--quiet toolbar-guide" data-open-guide>${esc(HERO.guideHint)}</button>` +
    `</div>` +
    (hasStones
      ? `<div class="stage-head"><div class="stage-lead"><p class="stage-caption">${esc(HERO.caption)}</p>` +
        `<p class="stage-terms">${HERO.terms.map(esc).join(' ')}</p></div>${compactLegendHtml(config)}</div>` +
        (narrow ? `<p class="chart-note">${esc(CHART.scrollNote)} <a id="scroll-table" href="#/table">${esc(CHART.scrollLink)}</a>.</p>` : '') +
        `<div class="plot"><div class="chart-wrap${narrow ? ' chart-wrap--scroll' : ''}" id="chart-host"${narrow ? ` role="region" aria-label="${esc(CHART.scrollRegion)}"` : ''}></div>` +
        `<div class="tip" id="stone-tip" hidden aria-hidden="true"></div>` +
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
  /** The card floats over one corner of the chart. It takes the side away from the selected stone. */
  const placeCard = (): void => {
    if (card === null || host === null) return;
    const stone = host.querySelector<SVGAElement>('a.stone-link.selected');
    if (stone === null) {
      card.classList.remove('card--left');
      return;
    }
    const box = host.getBoundingClientRect();
    const at = stone.getBoundingClientRect();
    card.classList.toggle('card--left', at.left + at.width / 2 > box.left + box.width / 2);
  };
  const draw = (): void => {
    const shown = applyFilters(reg.records, state.filters);
    const drawn = drawnInChurchyard(shown);
    // A selected stone that the filters hide is cleared.
    if (selected !== null && !drawn.some((r) => r.norad === selected)) {
      selected = null;
      remembered = null;
    }
    status.textContent = !hasFilters(state.filters)
      ? FILTERS.drawnUnfiltered(drawn.length)
      : drawn.length === 0
        ? FILTERS.none
        : `${FILTERS.count(shown.length, reg.records.length)} ${FILTERS.drawn(drawn.length)}`;
    if (host !== null) {
      host.innerHTML = chartSvg(reg, narrow, selected, drawn, tabStop ?? selected);
      const model = chartModel(reg, narrow, shown);
      nav = model.nav;
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
  return () => {
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
