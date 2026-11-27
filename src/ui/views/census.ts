// The census page (design 5.7, R5.3-R5.5). Pure string builders plus mountCensus.
// Every number comes from register.census, except the GPZ-table status count, which is counted from
// the records (the census has no field for it, design 2.8). Every share shows its denominator.
import type { Config } from '../../engine/config.ts';
import type { Census, SatRecord, VerdictName } from '../../engine/types.ts';
import { CENSUS, CENSUS_TILES, HERO, CHURCHYARD_INTRO, HEADLINE, METHOD_SECTIONS, NOTES, snapshotLabel, CAUSES, assumptionsLine, TERMS, VERDICT_ORDER, verdictCopy } from '../copy.ts';
import { postRuleSummary } from '../../engine/headline.ts';
import { CAUSE_CATEGORIES, causeCounts, causeGroup } from '../../engine/causes.ts';
import { formatCount, formatShare } from '../format.ts';
import { esc } from '../html.ts';
import type { UiRegister } from '../register.ts';
import { glyphSvg } from './badge.ts';
import { noteHtml } from './note.ts';

const H = CENSUS.headings;
/** A count that the test reads back and compares with register.census. The path is a JSON array of keys. */
const cell = (path: readonly string[], value: number): string =>
  `<td class="num-cell" data-census="${esc(JSON.stringify(path))}">${esc(formatCount(value))}</td>`;
const dd = (path: readonly string[], value: number): string =>
  `<dd data-census="${esc(JSON.stringify(path))}">${esc(formatCount(value))}</dd>`;
const shareCell = (n: number, of: number): string => `<td class="num-cell">${esc(formatShare(n, of))}</td>`;
/** A numbered entry, like a line in a register: "§ 03.2", then the heading. */
const section = (id: string, heading: string, body: string, wide = false): string =>
  `<section class="census-section${wide ? ' census-section--wide' : ''}" aria-labelledby="census-${id}"><p class="kicker">\u00A7 03.#</p><h2 id="census-${id}">${esc(heading)}</h2>${body}</section>`;
interface Bar {
  name: string;
  n: number;
  of: number;
  /** Where the number is read back from (the census test). */
  census?: readonly string[];
  headline?: string;
  /** How many of `n` are within the uncertainty of a band edge. */
  hatched?: number;
  /** The whole bar is uncertain by definition. */
  uncertain?: boolean;
  /** The verdict this bar counts, so its fill is the same treatment as the verdict's stone on the chart. */
  verdict?: VerdictName;
}
const slug = (v: VerdictName): string => v.replace(' ', '-');
/** Horizontal bars, each with its number in mono at the end: "n of N (x%)". The bar is the share of N, from 0 to 100. */
function barsHtml(rows: readonly Bar[], label: string, uncertaintyKm: number): string {
  const items = rows
    .map((b) => {
      const head = formatCount(b.n);
      const rest = formatShare(b.n, b.of).slice(head.length);
      const attr = b.census !== undefined ? ` data-census="${esc(JSON.stringify(b.census))}"` : b.headline !== undefined ? ` data-headline="${esc(b.headline)}"` : '';
      const width = b.of > 0 ? (100 * b.n) / b.of : 0;
      const hatch = b.hatched !== undefined && b.hatched > 0 && b.n > 0 ? `<span class="bar-hatch" style="width:${((100 * b.hatched) / b.n).toFixed(2)}%"></span>` : '';
      const sub = b.hatched !== undefined && b.hatched > 0 ? `<span class="bar-sub"> \u00B7 ${esc(formatCount(b.hatched))} borderline</span>` : '';
      return (
        `<li class="bar-row"><span class="bar-name">${esc(b.name)}</span><span class="bar-plot" style="--s:${(width / 100).toFixed(4)}">` +
        `<span class="bar-track" aria-hidden="true"><span class="bar-fill${b.uncertain === true ? ' bar-fill--uncertain' : ''}${b.verdict !== undefined ? ` bar-fill--v-${slug(b.verdict)}` : ''}" style="width:${width.toFixed(2)}%">${hatch}</span></span>` +
        `<span class="bar-label"><span class="bar-n"${attr}>${esc(head)}</span>${esc(rest)}${sub}</span></span></li>`
      );
    })
    .join('');
  return `<ul class="bars" aria-label="${esc(label)}">${items}</ul>`;
}
/** Borderline counts per verdict, for a set of retired records. */
function borderlineBy(records: readonly SatRecord[], inGroup: (r: SatRecord) => boolean): Record<VerdictName, number> {
  const out = { fallen: 0, unquiet: 0, 'shallow grave': 0, restless: 0, uncertain: 0, buried: 0 };
  for (const r of records) if (r.verdict.kind === 'verdict' && inGroup(r) && r.verdict.borderline) out[r.verdict.verdict]++;
  return out;
}
/** The six verdict words, each with its plain meaning, once, at the top of the page. Rows below show the word only. */
export function verdictLegendHtml(config: Config): string {
  const items = VERDICT_ORDER.map((v) => {
    const c = verdictCopy(v, config);
    return `<div class="legend-dl-row"><dt>${glyphSvg(v)}<span class="legend-word">${esc(c.word)}</span><span class="fill-swatch fill-swatch--${slug(v)}" aria-hidden="true"></span></dt><dd>${esc(c.meaning)}</dd></div>`;
  }).join('');
  return `<dl class="legend-dl" aria-label="${esc(CENSUS.legendLabel)}">${items}</dl>`;
}
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

function verdictsHtml(c: Census, config: Config, records: readonly SatRecord[], date: string): string {
  const total = c.retired.total;
  const edge = borderlineBy(records, () => true);
  const rows: Bar[] = VERDICT_ORDER.map((v: VerdictName) => ({
    name: verdictCopy(v, config).word,
    n: c.retired.byVerdict[v],
    of: total,
    census: ['retired', 'byVerdict', v],
    hatched: edge[v],
    uncertain: v === 'uncertain',
    verdict: v,
  }));
  return (
    `<p class="bars-total"><span class="bar-n" data-census="${esc(JSON.stringify(['retired', 'total']))}">${esc(formatCount(total))}</span> ${esc(CENSUS.totalLine)}</p>` +
    barsHtml(rows, CENSUS.verdictTable.caption, config.uncertaintyKm) +
    noteHtml([NOTES.perigee(config.uncertaintyKm), NOTES.hatched(config.uncertaintyKm), NOTES.source(date)], METHOD_SECTIONS.verdicts)
  );
}
function eraHtml(c: Census, date: string): string {
  const E = CENSUS.era;
  const total = c.retired.total;
  const rows: Bar[] = (
    [
      ['beforeRule', E.beforeRule],
      ['onOrAfterRule', E.onOrAfterRule],
      ['unknown', E.unknown],
    ] as const
  ).map(([k, name]) => ({ name, n: c.retired.era[k], of: total, census: ['retired', 'era', k], uncertain: k === 'unknown' }));
  return barsHtml(rows, E.caption, 0) + noteHtml([NOTES.era, NOTES.source(date)], METHOD_SECTIONS.era);
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

const TOP_OWNERS = 12;
function ownerHtml(c: Census, config: Config, date: string): string {
  const O = CENSUS.owner;
  const total = (o: Record<VerdictName, number>): number => VERDICT_ORDER.reduce((sum, v) => sum + o[v], 0);
  const owners = Object.entries(c.retired.byOwner).sort(([ka, a], [kb, b]) => total(b) - total(a) || (ka < kb ? -1 : ka > kb ? 1 : 0));
  const max = Math.max(1, ...owners.map(([, o]) => total(o)));
  const head = th(O.ownerColumn) + th(CENSUS.ownerBar) + VERDICT_ORDER.map((v) => th(verdictCopy(v, config).word, true)).join('') + th(O.totalColumn, true);
  const row = ([code, counts]: [string, Record<VerdictName, number>]): string => {
    const n = total(counts);
    const w = (k: number): string => ((100 * k) / Math.max(1, n)).toFixed(2);
    return (
      `<tr><th scope="row">${esc(code === 'unknown' ? O.unknown : code)}</th>` +
      `<td class="ibar-cell"><span class="ibar" aria-hidden="true" style="width:${((100 * n) / max).toFixed(2)}%"><span class="ibar-b" style="width:${w(counts.buried)}%"></span><span class="ibar-u" style="width:${w(counts.uncertain)}%"></span></span></td>` +
      VERDICT_ORDER.map((v) => cell(['retired', 'byOwner', code, v], counts[v])).join('') +
      `<td class="num-cell">${esc(formatCount(n))}</td></tr>`
    );
  };
  const more = owners.length - TOP_OWNERS;
  return (
    `<div class="table-wrap census-wrap" role="region" aria-label="${esc(O.scrollLabel)}" tabindex="0">` +
    `<table class="register-table census-table census-owner"><caption>${esc(O.caption)}</caption><thead><tr>${head}</tr></thead>` +
    `<tbody>${owners.slice(0, TOP_OWNERS).map(row).join('')}</tbody>` +
    `<tbody id="owners-rest"${more > 0 ? ' hidden' : ''}>${owners.slice(TOP_OWNERS).map(row).join('')}</tbody></table></div>` +
    (more > 0 ? `<p class="owners-more"><button type="button" class="button button--quiet" data-owners aria-expanded="false" aria-controls="owners-rest" data-show="${esc(CENSUS.ownersShow(owners.length))}" data-hide="${esc(CENSUS.ownersHide)}">${esc(CENSUS.ownersShow(owners.length))}</button></p>` : '') +
    noteHtml([O.note, NOTES.owner, NOTES.source(date)], METHOD_SECTIONS.sources)
  );
}
const causeCell = (key: string, value: number): string => `<td class="num-cell" data-cause="${esc(key)}">${esc(formatCount(value))}</td>`;
/**
 * The cause line and the table of five categories (R14.7). Every number comes from the group in the register and
 * from the case files' `Cause category:` lines, so the text changes when either does.
 */
export function causesHtml(reg: Pick<UiRegister, 'records' | 'config' | 'causes'>): string {
  const config = reg.config;
  const group = causeGroup(reg.records, config);
  if (group.length === 0) return `<p>${esc(CAUSES.noGroup(config.validation.afterLaunchYear))}</p>`;
  // The counts are written into the register by build-register. Without them (a fixture or an old file) no case file is known.
  const k = reg.causes ?? causeCounts(group, new Map());
  const rows = CAUSE_CATEGORIES.map((c) => `<tr><th scope="row">${esc(c)}</th>${causeCell(c, k.byCategory[c])}</tr>`).join('');
  const missing = k.noCase > 0 ? `<tr><th scope="row">${esc(CAUSES.noCase)}</th>${causeCell('noCase', k.noCase)}</tr>` : '';
  return (
    `<p data-causes="line"><strong>${esc(CAUSES.line(k.n, k.byCategory['failed in orbit or broke up before disposal']))}</strong></p>` +
    `<p>${esc(CAUSES.intro(config.validation.afterLaunchYear))}</p>` +
    table(CAUSES.caption(k.n), th(CAUSES.columns.category) + th(CAUSES.columns.count, true), rows + missing) +
    `<p>${esc(CAUSES.limits)}</p>`
  );
}
/** The first thing on the census page: the group launched on or after the rule date, with the older group as context. */
export function headlineHtml(records: readonly SatRecord[], config: Config, date = ''): string {
  const s = postRuleSummary(records);
  if (s.postRule === 0) return `<p>${esc(HEADLINE.none)}</p><p data-headline="predate">${esc(HEADLINE.predate(s.predate, s.retired))}</p>`;
  const edge = borderlineBy(records, (r) => r.verdict.kind === 'verdict' && r.verdict.era === null);
  const rows: Bar[] = VERDICT_ORDER.map((v) => ({ name: verdictCopy(v, config).word, n: s.byVerdict[v], of: s.postRule, headline: v, hatched: edge[v], uncertain: v === 'uncertain', verdict: v }));
  return (
    `<div class="headline"><div class="headline-text">` +
    `<p data-headline="lead">${esc(HEADLINE.lead(s.postRule, s.retired))}</p>` +
    `<p data-headline="zone"><strong>${esc(HEADLINE.zone(formatShare(s.inOrNearZone, s.postRule)))}</strong></p>` +
    `<p data-headline="predate">${esc(HEADLINE.predate(s.predate, s.retired))}</p>` +
    (s.unknownLaunch > 0 ? `<p>${esc(HEADLINE.unknownLaunch(s.unknownLaunch))}</p>` : '') +
    `<p>${esc(assumptionsLine(config))}</p><p>${esc(CHURCHYARD_INTRO.blindSpot)}</p></div>` +
    `<div class="headline-chart">${barsHtml(rows, HEADLINE.caption, config.uncertaintyKm)}` +
    noteHtml([NOTES.perigee(config.uncertaintyKm), NOTES.hatched(config.uncertaintyKm), NOTES.source(date)], METHOD_SECTIONS.verdicts) +
    `</div></div>`
  );
}
/** The whole census page body. */
export function censusHtml(reg: Pick<UiRegister, 'census' | 'records' | 'config' | 'causes'>): string {
  const c = reg.census;
  const config = reg.config;
  const near = config.nearGeo;
  const intro = `<p class="lead">${esc(CENSUS.lead(c.snapshotDate))}</p>`;
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
  let entry = 0;
  const date = snapshotLabel(c.snapshotDate).replace('CelesTrak snapshot, ', '');
  const rest =
    `<details class="fold"><summary>${esc(CENSUS.restTitle)}</summary><div class="fold-body">` +
    `<p>${esc(CENSUS.fromRegister)}</p><p>${esc(CHURCHYARD_INTRO.voluntary)}</p><p>${esc(CHURCHYARD_INTRO.noRetirementDate)}</p></div></details>`;
  const cols =
    section('verdicts', H.verdicts, verdictsHtml(c, config, reg.records, date)) +
    section('era', H.era, eraHtml(c, date)) +
    section('population', H.population, populationHtml(c)) +
    borderline +
    section('orbit', H.orbit, orbitHtml(c, config)) +
    section('status', H.status, statusHtml(c, reg.records)) +
    gaps +
    blind +
    caveat;
  return (
    `<div class="census">` +
    `<div class="census-top"><p class="kicker">${esc(CENSUS.kicker)}</p>${intro}</div>` +
    verdictLegendHtml(config) +
    statsHtml(reg) +
    section('headline', HEADLINE.heading, headlineHtml(reg.records, config, date), true) +
    section('causes', H.causes, causesHtml(reg), true) +
    `<div class="census-cols">${cols}</div>` +
    section('owner', H.owner, ownerHtml(c, config, date), true) +
    rest +
    `</div>`
  ).replace(/\u00A7 03\.#/g, () => `\u00A7 03.${++entry}`);
}
/** Draws the census into `root`. The one control is the owner table's "Show all". */
export function mountCensus(root: HTMLElement, reg: UiRegister): () => void {
  root.innerHTML = censusHtml(reg);
  const onClick = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-owners]');
    if (button === null) return;
    const rest = root.querySelector<HTMLElement>('#owners-rest')!;
    rest.hidden = !rest.hidden;
    button.setAttribute('aria-expanded', String(!rest.hidden));
    button.textContent = rest.hidden ? button.dataset['show']! : button.dataset['hide']!;
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
