// The churchyard view (design 5.4, R6). The chart is a string of SVG, built by pure functions,
// so tests can read it without a DOM. Colours come only from CSS classes.
import type { Config } from '../../engine/config.ts';
import type { SatRecord, VerdictName } from '../../engine/types.ts';
import {
  assumptionsLine,
  bandCopy,
  CARD,
  CHART,
  CHURCHYARD_INTRO,
  chartDescription,
  countLine,
  dataAge,
  FILTERS,
  LEGEND,
  MOSS_STEPS,
  offScaleText,
  SITE,
  stoneLabel,
  TERMS,
  VERDICT_ORDER,
  verdictCopy,
} from '../copy.ts';
import { formatP, formatSigned, spokenKm } from '../format.ts';
import { esc, withSansDigits } from '../html.ts';
import type { UiRegister } from '../register.ts';
import { applyFilters, drawnInChurchyard, hasFilters, hashFor, NO_FILTERS, parseState } from '../state.ts';
import type { ViewState } from '../state.ts';
import { filtersHtml, wireFilters } from './filters.ts';
import { bandsOf } from '../svg/bands.ts';
import { stoneBody, stoneDefs } from '../svg/headstone.ts';
import { buildColumns, laneOf, LAYOUT, mossStep, offScale, plotHeight, SCALE, swayAngle, yearFraction, yOf } from '../svg/scale.ts';
import type { Columns } from '../svg/scale.ts';

export type RetiredRecord = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };

export const retiredPayloads = (records: readonly SatRecord[]): RetiredRecord[] =>
  records.filter((r): r is RetiredRecord => r.verdict.kind === 'verdict').sort((a, b) => a.norad - b.norad);

const edgesOf = (config: Config): number[] => [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];
const pText = (r: SatRecord, config: Config): string => formatP(r.pKm, r.orbitSource.kind, edgesOf(config));
const f = (n: number): string => String(Math.round(n * 100) / 100);

function bandsSvg(config: Config, cols: Columns, narrow: boolean): string {
  const x = cols.gutter;
  const w = cols.width - cols.gutter - LAYOUT.right;
  const out: string[] = [];
  for (const band of bandsOf(config)) {
    const y1 = yOf(band.toKm);
    const y0 = yOf(band.fromKm);
    const copy = bandCopy(band.id, config);
    out.push(`<rect class="band band--${band.id}" x="${f(x)}" y="${f(y1)}" width="${f(w)}" height="${f(y0 - y1)}"/>`);
    if (!narrow) {
      out.push(`<text class="band-name" x="8" y="${f((y0 + y1) / 2 + 4)}">${esc(copy.short)}</text>`);
    }
  }
  // Edge lines and tick numbers. 0 is GEO. The top tick has no edge line.
  const zone = config.protectedZoneKm;
  const topTick = SCALE.maxKm - 50;
  for (const km of [topTick, zone, -zone, config.thresholdLowKm, config.thresholdHighKm, 0]) {
    const y = f(yOf(km));
    if (km !== topTick) {
      out.push(`<line class="${km === 0 ? 'edge edge--geo' : 'edge'}" x1="${f(x)}" x2="${f(x + w)}" y1="${y}" y2="${y}"/>`);
    }
    out.push(`<text class="tick" x="${f(x - 6)}" y="${f(yOf(km) + 4)}" text-anchor="end">${esc(formatSigned(km, 0))}</text>`);
    if (km === 0) out.push(`<text class="tick tick--geo" x="${f(x + 4)}" y="${f(yOf(km) - 4)}">${esc(CHART.geoLabel)}</text>`);
  }
  return out.join('');
}

function yearAxisSvg(cols: Columns, narrow: boolean): string {
  const y = LAYOUT.top + plotHeight() + 18;
  const out: string[] = [];
  for (const c of cols.list) {
    const cx = f(c.x + c.width / 2);
    if (c.from === null) {
      out.push(`<text class="tick" x="${cx}" y="${f(y)}" text-anchor="middle"><title>${esc(CHART.unknownYearTitle)}</title>${esc(CHART.unknownYear)}</text>`);
    } else if (narrow ? true : c.from % 5 === 0) {
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

function stoneSvg(r: RetiredRecord, config: Config, cols: Columns, narrow: boolean, selected: number | null): string {
  const col = cols.find(r.launchYear);
  if (col === undefined) return '';
  const lanes = narrow ? 4 : 3;
  const gap = narrow ? 8 : 7;
  const cx = col.x + col.width / 2 + (laneOf(r.norad, lanes) - (lanes - 1) / 2) * gap;
  const off = offScale(r.pKm);
  const plotTop = LAYOUT.top;
  const plotBottom = LAYOUT.top + plotHeight();
  const baseY = off === 'above' ? plotTop + LAYOUT.offScaleInset + 14 : off === 'below' ? plotBottom - 20 : yOf(r.pKm);
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
    const top = yOf(r.pKm + config.uncertaintyKm) - baseY;
    const bottom = yOf(r.pKm - config.uncertaintyKm) - baseY;
    const wx = LAYOUT.stoneWidth / 2 + 5;
    whisker =
      `<g class="whisker"><line x1="${wx}" x2="${wx}" y1="${f(top)}" y2="${f(bottom)}"/>` +
      `<line x1="${wx - 2}" x2="${wx + 2}" y1="${f(top)}" y2="${f(top)}"/>` +
      `<line x1="${wx - 2}" x2="${wx + 2}" y1="${f(bottom)}" y2="${f(bottom)}"/></g>`;
  }
  const offLabel =
    off === null
      ? ''
      : `<text class="off-label" x="0" y="${off === 'above' ? -(LAYOUT.stoneHeight + 6) : 12}" text-anchor="middle">${esc(offScaleText(off, r.pKm))}</text>`;
  const cls = `stone-link${selected === r.norad ? ' selected' : ''}`;
  return (
    `<a class="${cls}" href="#/sat/${r.norad}" data-norad="${r.norad}" aria-label="${esc(label)}">` +
    `<title>${esc(label)}</title>` +
    `<g transform="translate(${f(cx)} ${f(baseY)})">` +
    `<rect class="hit" x="-12" y="-26" width="24" height="32"/>` +
    shape +
    whisker +
    offLabel +
    `</g></a>`
  );
}

/** An unmarked-bones marker: a small plain diamond, no inscription, not a link. */
function boneSvg(r: SatRecord, config: Config, cols: Columns, narrow: boolean): string {
  const col = cols.find(r.launchYear);
  if (col === undefined) return '';
  const lanes = narrow ? 4 : 3;
  const gap = narrow ? 8 : 7;
  const cx = col.x + col.width / 2 + (laneOf(r.norad, lanes) - (lanes - 1) / 2) * gap;
  const off = offScale(r.pKm);
  const cy = off === 'above' ? LAYOUT.top + LAYOUT.offScaleInset + 6 : off === 'below' ? LAYOUT.top + plotHeight() - 20 : yOf(r.pKm);
  const text = pText(r, config);
  const label = `${r.name}, unmarked bones (${r.status}), perigee ${spokenKm(text)} kilometres${spokenKm(text).startsWith('minus') ? ', below GEO' : ' above GEO'}${off === null ? '' : ', off the drawn scale'}`;
  const offLabel =
    off === null ? '' : `<text class="off-label" x="0" y="${off === 'above' ? -10 : 18}" text-anchor="middle">${esc(offScaleText(off, r.pKm))}</text>`;
  return (
    `<g class="bone" data-norad="${r.norad}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>` +
    `<g transform="translate(${f(cx)} ${f(cy)})"><path class="bone-mark" d="M 0 -4 L 4 0 L 0 4 L -4 0 Z"/>${offLabel}</g></g>`
  );
}
/**
 * The whole chart as an SVG string. `shown` is the filtered set (default: no filters, so no unmarked bones).
 * The columns come from all retired payloads, so filtering does not move the stones, plus the
 * unmarked bones that are shown.
 */
export function chartSvg(reg: UiRegister, narrow: boolean, selected: number | null = null, shown: readonly SatRecord[] = applyFilters(reg.records, NO_FILTERS)): string {
  const config = reg.config;
  const stones = retiredPayloads(shown);
  const bones = shown.filter((r) => r.verdict.kind === 'unmarked bones').sort((a, b) => a.norad - b.norad);
  const cols = buildColumns([...retiredPayloads(reg.records), ...bones].map((r) => r.launchYear), narrow);
  const width = Math.max(cols.width, cols.gutter + 120);
  const height = LAYOUT.top + plotHeight() + LAYOUT.bottom;
  const parts = [
    `<svg class="chart" viewBox="0 0 ${f(width)} ${f(height)}" role="group" aria-labelledby="chart-title chart-desc" focusable="false">`,
    `<title id="chart-title">${esc(CHART.title)}</title>`,
    `<desc id="chart-desc">${esc(chartDescription(config))}</desc>`,
    `<defs>${stoneDefs()}<linearGradient id="wall-shade" x1="0" y1="1" x2="0" y2="0"><stop class="wall-stop-low" offset="0"/><stop class="wall-stop-high" offset="1"/></linearGradient></defs>`,
    `<g aria-hidden="true">`,
    bandsSvg(config, cols, narrow),
    `<text class="axis-title" x="8" y="18">${esc(CHART.axisTitle)}</text>`,
    yearAxisSvg(cols, narrow),
    fccLineSvg(config, cols, narrow),
    `</g>`,
    bones.map((r) => boneSvg(r, config, cols, narrow)).join(''),
    stones.map((r) => stoneSvg(r, config, cols, narrow, selected)).join(''),
    `</svg>`,
  ];
  return parts.join('');
}
function glyphSvg(verdict: VerdictName, moss: 0 | 1 | 2 | 3 | 4 = 0): string {
  return `<svg class="glyph" viewBox="-14 -26 28 34" width="28" height="34" aria-hidden="true" focusable="false">${stoneBody({ verdict, moss })}</svg>`;
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
    `<li>${esc(LEGEND.fccLine)}</li><li>${esc(LEGEND.bones)}</li><li>${esc(LEGEND.offScale)}</li><li>${esc(CHART.fccLine)}</li></ul></section>`
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
    `<h3 class="card-name">${withSansDigits(r.name)} <span class="card-id">NORAD ${r.norad}</span></h3>` +
    `<p class="card-verdict">${esc(verdictCopy(v.verdict, config).pair)}</p>` +
    `<dl class="card-data">${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>` +
    `<ul class="card-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` +
    `<p class="card-actions"><a class="button" href="#/sat/${r.norad}">${esc(CARD.ledger)}</a> <button type="button" class="button" data-clear>${esc(CARD.close)}</button></p>`
  );
}

export function introHtml(reg: UiRegister): string {
  const n = retiredPayloads(reg.records).length;
  return (
    `<p>${esc(CHURCHYARD_INTRO.lead)}</p>` +
    `<ul class="terms"><li>${esc(TERMS.geo)}</li><li>${esc(TERMS.perigee)}</li><li>${esc(TERMS.eccentricity)}</li></ul>` +
    `<p>${esc(CHURCHYARD_INTRO.voluntary)}</p>` +
    `<p>${esc(CHURCHYARD_INTRO.noRetirementDate)}</p>` +
    `<p class="count">${esc(countLine(n, reg.snapshot.set))} ${esc(CHURCHYARD_INTRO.blindSpot)}</p>`
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
    introHtml(reg) +
    filtersHtml(reg.records, state.filters, config) +
    `<p class="status" id="chart-status" role="status"></p>` +
    (hasStones
      ? `<a class="skip-link skip-link--inline" id="skip-table" href="#/table">${esc(SITE.skipToTable)}</a>` +
        `<div class="chart-wrap" id="chart-host"></div>` +
        `<section class="card" id="stone-card" aria-live="polite" aria-label="Selected stone"></section>`
      : `<p class="empty">${esc(CHART.empty)}</p>`) +
    legendHtml(config);
  const form = root.querySelector<HTMLFormElement>('#filters')!;
  const status = root.querySelector<HTMLElement>('#chart-status')!;
  const host = root.querySelector<HTMLElement>('#chart-host');
  const card = root.querySelector<HTMLElement>('#stone-card');
  const skip = root.querySelector<HTMLAnchorElement>('#skip-table');
  const draw = (): void => {
    const shown = applyFilters(reg.records, state.filters);
    const drawn = drawnInChurchyard(shown);
    // A selected stone that the filters hide is cleared.
    if (selected !== null && !drawn.some((r) => r.norad === selected)) {
      selected = null;
      remembered = null;
    }
    status.textContent =
      drawn.length === 0 && hasFilters(state.filters) ? FILTERS.none : `${FILTERS.count(shown.length, reg.records.length)} ${FILTERS.drawn(drawn.length)}`;
    if (host !== null) host.innerHTML = chartSvg(reg, narrow, selected, drawn);
    if (card !== null) card.innerHTML = cardHtml(selected === null ? undefined : byId.get(selected), config);
    if (skip !== null) skip.href = hashFor('table', state);
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
    if (card !== null) card.innerHTML = cardHtml(norad === null ? undefined : byId.get(norad), config);
  };
  const onClick = (event: Event): void => {
    const target = event.target as Element;
    const link = target.closest<SVGAElement>('a.stone-link');
    if (link !== null) {
      event.preventDefault();
      select(Number(link.dataset['norad']));
      return;
    }
    if (target.closest('[data-clear]') !== null) select(null);
  };
  root.addEventListener('click', onClick);
  return () => {
    unwire();
    root.removeEventListener('click', onClick);
  };
}
