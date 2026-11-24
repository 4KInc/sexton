// The census page (design 5.7, R5.3-R5.5). Pure string builders plus mountCensus.
// Every number comes from register.census, except the GPZ-table status count, which is counted from
// the records (the census has no field for it, design 2.8). Every share shows its denominator.
import { CONFIG } from '../../engine/config.ts';
import type { Config } from '../../engine/config.ts';
import type { Census, SatRecord, VerdictName } from '../../engine/types.ts';
import { CENSUS, CENSUS_TILES, HERO, CHURCHYARD_INTRO, HEADLINE, VALIDATION, COMPARISONS, assumptionsLine, TERMS, VERDICT_ORDER, verdictCopy } from '../copy.ts';
import type { Comparison } from '../copy.ts';
import { disposalRate, postRuleSummary } from '../../engine/headline.ts';
import type { DisposalRate } from '../../engine/headline.ts';
import { formatCount, formatShare } from '../format.ts';
import { esc } from '../html.ts';
import type { UiRegister } from '../register.ts';

const H = CENSUS.headings;
/** A count that the test reads back and compares with register.census. The path is a JSON array of keys. */
const cell = (path: readonly string[], value: number): string =>
  `<td class="num-cell" data-census="${esc(JSON.stringify(path))}">${esc(formatCount(value))}</td>`;
const dd = (path: readonly string[], value: number): string =>
  `<dd data-census="${esc(JSON.stringify(path))}">${esc(formatCount(value))}</dd>`;
const shareCell = (n: number, of: number): string => `<td class="num-cell">${esc(formatShare(n, of))}</td>`;
const section = (id: string, heading: string, body: string, wide = false): string =>
  `<section class="census-section${wide ? ' census-section--wide' : ''}" aria-labelledby="census-${id}"><h2 id="census-${id}">${esc(heading)}</h2>${body}</section>`;
/** The four big numbers at the top. Not census cells (they have no data-census), so the cell test still counts each census number once. */
export function statsHtml(reg: Pick<UiRegister, 'census' | 'records'>): string {
  const s = postRuleSummary(reg.records);
  const T = CENSUS_TILES;
  const tile = (id: string, value: number, label: string, of = ''): string =>
    `<li class="stat"><span class="stat-figure" data-stat="${id}"><span class="num">${formatCount(value)}</span>${of && `<span class="stat-of">${esc(of)}</span>`}</span><span class="stat-label">${esc(label)}</span></li>`;
  return (
    `<ul class="stats">` +
    tile('objects', reg.census.population.total, T.objects) +
    tile('retired', reg.census.retired.total, T.retired) +
    tile('post-rule', s.postRule, T.postRule) +
    tile('zone', s.inOrNearZone, T.zone, HERO.zone.of(s.postRule)) +
    `</ul>`
  );
}
const paras = (lines: readonly string[]): string => lines.map((l) => `<p>${esc(l)}</p>`).join('');
const table = (caption: string, head: string, rows: string, extraClass = ''): string =>
  `<div class="table-wrap census-wrap"><table class="register-table census-table${extraClass}"><caption>${esc(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
const th = (text: string, numeric = false): string => `<th scope="col"${numeric ? ' class="num-head"' : ''}>${esc(text)}</th>`;

/** Retired payloads whose status came from the GPZ table. Counted from the records. */
export function gpzStatusCount(records: readonly SatRecord[]): number {
  return records.filter((r) => r.verdict.kind === 'verdict' && r.statusSource === 'GPZ table').length;
}

/** The comparison list: a figure only when verified, otherwise the pending line. Never the figure itself. */
export function comparisonHtml(comparisons: readonly Comparison[] = COMPARISONS): string {
  const items = comparisons
    .map((c) => {
      if (c.verified && c.where !== null) {
        return `<li data-published>${esc(c.figure)} ${esc(CENSUS.comparison.verified(c.source, c.where))} <a href="${esc(c.url)}">${esc(c.source)}</a></li>`;
      }
      return `<li>${esc(CENSUS.comparison.pending(c.source))}</li>`;
    })
    .join('');
  return `<p>${esc(CENSUS.comparison.intro)}</p><ul>${items}</ul>`;
}

function populationHtml(c: Census): string {
  const P = CENSUS.population;
  const kinds = Object.keys(P.types) as (keyof typeof P.types)[];
  const rows = kinds
    .filter((k) => k !== 'unknown' || c.byType[k] > 0)
    .map((k) => `<tr><th scope="row">${esc(P.types[k])}</th>${cell(['byType', k], c.byType[k])}${shareCell(c.byType[k], c.population.total)}</tr>`)
    .join('');
  const lines =
    `<dl class="ledger-data census-data">` +
    `<div><dt>${esc(P.total)}</dt>${dd(['population', 'total'], c.population.total)}</div>` +
    `<div><dt>${esc(P.outside)}</dt>${dd(['population', 'outsidePopulation'], c.population.outsidePopulation)}</div></dl>`;
  return lines + table(P.caption, th(P.columns.type) + th(P.columns.count, true) + th(P.columns.share, true), rows);
}

function verdictsHtml(c: Census, config: Config): string {
  const V = CENSUS.verdictTable;
  const total = c.retired.total;
  const rows = VERDICT_ORDER.map((v: VerdictName) => {
    const n = c.retired.byVerdict[v];
    return `<tr><th scope="row">${esc(verdictCopy(v, config).pair)}</th>${cell(['retired', 'byVerdict', v], n)}${shareCell(n, total)}</tr>`;
  }).join('');
  const foot = `<tr><th scope="row">${esc(V.total)}</th>${cell(['retired', 'total'], total)}${shareCell(total, total)}</tr>`;
  return table(V.caption, th(V.columns.verdict) + th(V.columns.count, true) + th(V.columns.share, true), rows + foot);
}

function eraHtml(c: Census): string {
  const E = CENSUS.era;
  const total = c.retired.total;
  const rows = (
    [
      ['beforeRule', E.beforeRule],
      ['onOrAfterRule', E.onOrAfterRule],
      ['unknown', E.unknown],
    ] as const
  )
    .map(([k, label]) => `<tr><th scope="row">${esc(label)}</th>${cell(['retired', 'era', k], c.retired.era[k])}${shareCell(c.retired.era[k], total)}</tr>`)
    .join('');
  return table(E.caption, th(E.columns.era) + th(E.columns.count, true) + th(E.columns.share, true), rows) + `<p>${esc(E.note)}</p>`;
}

function orbitHtml(c: Census, config: Config): string {
  const O = CENSUS.orbit;
  const total = c.retired.total;
  const rows = (['GP', 'SATCAT'] as const)
    .map((k) => `<tr><th scope="row">${esc(O[k])}</th>${cell(['retired', 'orbitSource', k], c.retired.orbitSource[k])}${shareCell(c.retired.orbitSource[k], total)}</tr>`)
    .join('');
  return (
    table(O.caption, th(O.columns.source) + th(O.columns.count, true) + th(O.columns.share, true), rows) +
    `<p>${esc(O.note(formatShare(c.retired.orbitSource.SATCAT, total), config))}</p>`
  );
}

/** "unknown" on the SATCAT side means SATCAT gave no status. */
function pairText(side: string): string {
  return side === 'unknown' ? CENSUS.status.unknownSatcat : side;
}

function statusHtml(c: Census, records: readonly SatRecord[]): string {
  const S = CENSUS.status;
  const gpz = gpzStatusCount(records);
  const pairs = Object.entries(c.disagreements.pairs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const rows = pairs
    .map(([key, n]) => {
      const [satcat = '', gpzTable = ''] = key.split(' | ');
      return `<tr><th scope="row">${esc(pairText(satcat))}</th><td>${esc(gpzTable)}</td>${cell(['disagreements', 'pairs', key], n)}</tr>`;
    })
    .join('');
  const body =
    `<p data-gpz-status="${gpz}">${esc(S.gpzLine(formatShare(gpz, c.retired.total)))}</p>` +
    (c.disagreements.total === 0
      ? `<p>${esc(S.none)}</p>`
      : `<p>${esc(S.disagreements(c.disagreements.total))}</p>` +
        table(S.caption, th(S.columns.pair) + th(S.columns.table) + th(S.columns.count, true), rows));
  return body;
}

function ownerHtml(c: Census, config: Config): string {
  const O = CENSUS.owner;
  const total = (o: Record<VerdictName, number>): number => VERDICT_ORDER.reduce((sum, v) => sum + o[v], 0);
  const owners = Object.entries(c.retired.byOwner).sort(([ka, a], [kb, b]) => total(b) - total(a) || (ka < kb ? -1 : ka > kb ? 1 : 0));
  const head = th(O.ownerColumn) + VERDICT_ORDER.map((v) => th(verdictCopy(v, config).word, true)).join('') + th(O.totalColumn, true);
  const rows = owners
    .map(
      ([code, counts]) =>
        `<tr><th scope="row">${esc(code === 'unknown' ? O.unknown : code)}</th>` +
        VERDICT_ORDER.map((v) => cell(['retired', 'byOwner', code, v], counts[v])).join('') +
        `<td class="num-cell">${esc(formatCount(total(counts)))}</td></tr>`,
    )
    .join('');
  return (
    `<p>${esc(O.note)}</p>` +
    `<div class="table-wrap census-wrap" role="region" aria-label="${esc(O.scrollLabel)}" tabindex="0">` +
    `<table class="register-table census-table census-owner"><caption>${esc(O.caption)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

const pctOf = (n: number, of: number): string => String(Math.round((10000 * n) / of) / 100);
/**
 * Sexton's band and its central share on one axis from 0 to 100, with the published range above it.
 * The marks carry counts ("27 of 45"). The only percent signs are inside the published range, which is marked
 * data-published, because every Sexton share on this page shows "n of N" before its percentage.
 */
export function validationChartHtml(r: DisposalRate, published: { source: string; range: readonly [number, number] } | null): string {
  const C = VALIDATION.chart;
  const rangeText = published === null ? null : `${published.range[0]}% to ${published.range[1]}%`;
  const esa =
    published === null
      ? ''
      : `<div class="vplot-row"><span class="vplot-name">${esc(C.esa)}</span><div class="vplot-track">` +
        `<span class="vplot-esa" data-published style="left:${published.range[0]}%;width:${published.range[1] - published.range[0]}%">${esc(rangeText!)}</span></div></div>`;
  const sexton =
    `<div class="vplot-row"><span class="vplot-name">${esc(C.sexton)}</span><div class="vplot-track">` +
    `<span class="vplot-band" style="left:${pctOf(r.lower, r.n)}%;width:${pctOf(r.upper - r.lower, r.n)}%"></span>` +
    `<span class="vplot-point" style="left:${pctOf(r.central, r.n)}%"></span>` +
    `<span class="vplot-label" style="left:${pctOf(r.central, r.n)}%">${esc(C.point(r.central, r.n))}</span>` +
    `<span class="vplot-band-label" style="left:${pctOf(r.lower, r.n)}%">${esc(C.band(r.lower, r.upper, r.n))}</span></div></div>`;
  const ticks = [0, 25, 50, 75, 100].map((t) => `<span style="left:${t}%">${t}</span>`).join('');
  return (
    `<figure class="vplot" role="img" aria-label="${esc([C.axis, VALIDATION.sextonValue(r.central, r.n), VALIDATION.bandValue(r.lower, r.upper, r.n), rangeText].filter(Boolean).join('. '))}">` +
    `<div class="vplot-rows" aria-hidden="true">${esa}${sexton}</div>` +
    `<div class="vplot-axis" aria-hidden="true">${ticks}</div><figcaption class="vplot-caption">${esc(C.axis)}</figcaption></figure>`
  );
}
/** Sexton's buried share next to a published range, only for a range that was checked in its source. */
export function validationHtml(records: readonly SatRecord[], comparisons: readonly Comparison[] = COMPARISONS, config: Config = CONFIG): string {
  const r = disposalRate(records, config);
  if (r.n === 0) return `<p>${esc(VALIDATION.noGroup(r.afterLaunchYear))}</p>`;
  const found = comparisons.find((c) => c.verified && c.where !== null && c.range !== null);
  const head = `<aside class="vnote"><h3>${esc(VALIDATION.groupsTitle)}</h3><p>${esc(VALIDATION.intro(r.afterLaunchYear))}</p><p>${esc(VALIDATION.notRoberts)}</p></aside>`;
  const row = (k: string, v: string, attr: string): string =>
    `<div><dt>${esc(k)}</dt><dd data-validation="${attr}"${attr === 'published' ? ' data-published' : ''}>${esc(v)}</dd></div>`;
  let rows =
    row(VALIDATION.sexton, VALIDATION.sextonValue(r.central, r.n), 'sexton') +
    row(VALIDATION.band(config.uncertaintyKm), VALIDATION.bandValue(r.lower, r.upper, r.n), 'band');
  let verdict: string = VALIDATION.noPublished;
  let published: { source: string; range: readonly [number, number] } | null = null;
  if (found !== undefined && found.range !== null) {
    const [lo, hi] = found.range;
    published = { source: found.source, range: found.range };
    rows += row(VALIDATION.published(found.source), VALIDATION.rangeValue(lo, hi), 'published');
    const pct = (n: number): number => (100 * n) / r.n;
    const centre = pct(r.central);
    if (centre >= lo && centre <= hi) verdict = VALIDATION.inside;
    else if (centre > hi) verdict = VALIDATION.above;
    else verdict = pct(r.upper) >= lo ? VALIDATION.partly : VALIDATION.below;
  }
  return `<div class="vgrid"><div class="vmain">${validationChartHtml(r, published)}<dl class="ledger-data census-data">${rows}</dl><p data-validation="verdict"><strong>${esc(verdict)}</strong></p></div>${head}</div>`;
}
/** The first thing on the census page: the group launched on or after the rule date, with the older group as context. */
export function headlineHtml(records: readonly SatRecord[], config: Config): string {
  const s = postRuleSummary(records);
  if (s.postRule === 0) return `<p>${esc(HEADLINE.none)}</p><p data-headline="predate">${esc(HEADLINE.predate(s.predate, s.retired))}</p>`;
  const rows = VERDICT_ORDER.map((v) => {
    const n = s.byVerdict[v];
    return `<tr><th scope="row">${esc(verdictCopy(v, config).pair)}</th><td class="num-cell" data-headline="${esc(v)}">${esc(formatCount(n))}</td>${shareCell(n, s.postRule)}</tr>`;
  }).join('');
  return (
    `<div class="headline"><div class="headline-text">` +
    `<p data-headline="lead">${esc(HEADLINE.lead(s.postRule, s.retired))}</p>` +
    `<p data-headline="zone"><strong>${esc(HEADLINE.zone(formatShare(s.inOrNearZone, s.postRule)))}</strong></p>` +
    `<p data-headline="predate">${esc(HEADLINE.predate(s.predate, s.retired))}</p>` +
    (s.unknownLaunch > 0 ? `<p>${esc(HEADLINE.unknownLaunch(s.unknownLaunch))}</p>` : '') +
    `<p>${esc(assumptionsLine(config))}</p><p>${esc(CHURCHYARD_INTRO.blindSpot)}</p></div>` +
    `<div class="headline-table">${table(HEADLINE.caption, th(HEADLINE.columns.verdict) + th(HEADLINE.columns.count, true) + th(HEADLINE.columns.share, true), rows)}</div></div>`
  );
}

/** The whole census page body. */
export function censusHtml(reg: Pick<UiRegister, 'census' | 'records' | 'config'>, comparisons: readonly Comparison[] = COMPARISONS): string {
  const c = reg.census;
  const config = reg.config;
  const near = config.nearGeo;
  const intro =
    `<p>${esc(CENSUS.intro(c.snapshotDate))}</p>` +
    `<ul class="terms"><li>${esc(TERMS.geo)}</li><li>${esc(TERMS.perigee)}</li></ul>`;
  const borderline = section(
    'borderline',
    H.borderline,
    `<p data-borderline="${c.retired.borderline.yes}">${esc(CENSUS.borderline(config.uncertaintyKm, formatShare(c.retired.borderline.yes, c.retired.total)))}</p>`,
  );
  const gaps = section(
    'gaps',
    H.gaps,
    `<dl class="ledger-data census-data">` +
      `<div><dt>${esc(CENSUS.gaps.rejected)}</dt>${dd(['population', 'rejectedRows'], c.population.rejectedRows)}</div>` +
      `<div><dt>${esc(CENSUS.gaps.noOrbit)}</dt>${dd(['population', 'noOrbitData'], c.population.noOrbitData)}</div></dl>` +
      `<p>${esc(CENSUS.gaps.noOrbitNote)}</p>`,
  );
  const blind = section(
    'blind',
    H.blind,
    paras([CENSUS.blind.filter(near.lowerKm, near.upperKm, near.orbitCenter), CENSUS.blind.consequence]),
  );
  const caveat = section('caveat', H.caveat, `<p>${esc(CENSUS.caveat.intro)}</p><ul>${CENSUS.caveat.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`);
  const rest =
    `<details class="fold"><summary>${esc(CENSUS.restTitle)}</summary><div class="fold-body">` +
    `<p>${esc(CENSUS.fromRegister)}</p><p>${esc(CHURCHYARD_INTRO.voluntary)}</p><p>${esc(CHURCHYARD_INTRO.noRetirementDate)}</p></div></details>`;
  const cols =
    section('population', H.population, populationHtml(c)) +
    section('verdicts', H.verdicts, verdictsHtml(c, config)) +
    borderline +
    section('era', H.era, eraHtml(c)) +
    section('orbit', H.orbit, orbitHtml(c, config)) +
    section('status', H.status, statusHtml(c, reg.records)) +
    gaps +
    blind +
    section('comparison', H.comparison, comparisonHtml(comparisons)) +
    caveat;
  return (
    `<div class="census">` +
    `<div class="census-top">${intro}</div>` +
    statsHtml(reg) +
    section('headline', HEADLINE.heading, headlineHtml(reg.records, config), true) +
    section('validation', VALIDATION.heading, validationHtml(reg.records, comparisons), true) +
    `<div class="census-cols">${cols}</div>` +
    section('owner', H.owner, ownerHtml(c, config), true) +
    rest +
    `</div>`
  );
}
/** Draws the census into `root`. Nothing to listen to, so the stop function does nothing. */
export function mountCensus(root: HTMLElement, reg: UiRegister): () => void {
  root.innerHTML = censusHtml(reg);
  return () => undefined;
}
