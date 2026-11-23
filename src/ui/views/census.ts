// The census page (design 5.7, R5.3-R5.5). Pure string builders plus mountCensus.
// Every number comes from register.census, except the GPZ-table status count, which is counted from
// the records (the census has no field for it, design 2.8). Every share shows its denominator.
import type { Config } from '../../engine/config.ts';
import type { Census, SatRecord, VerdictName } from '../../engine/types.ts';
import { CENSUS, CHURCHYARD_INTRO, COMPARISONS, assumptionsLine, TERMS, VERDICT_ORDER, verdictCopy } from '../copy.ts';
import type { Comparison } from '../copy.ts';
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
const section = (id: string, heading: string, body: string): string =>
  `<section class="census-section" aria-labelledby="census-${id}"><h2 id="census-${id}">${esc(heading)}</h2>${body}</section>`;
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
        return `<li>${esc(c.figure)} ${esc(CENSUS.comparison.verified(c.source, c.where))} <a href="${esc(c.url)}">${esc(c.source)}</a></li>`;
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

/** The whole census page body. */
export function censusHtml(reg: Pick<UiRegister, 'census' | 'records' | 'config'>, comparisons: readonly Comparison[] = COMPARISONS): string {
  const c = reg.census;
  const config = reg.config;
  const near = config.nearGeo;
  const intro =
    `<p>${esc(CENSUS.intro(c.snapshotDate))}</p>` +
    `<p>${esc(CENSUS.fromRegister)}</p>` +
    `<ul class="terms"><li>${esc(TERMS.geo)}</li><li>${esc(TERMS.perigee)}</li></ul>` +
    `<p>${esc(CHURCHYARD_INTRO.voluntary)}</p>` +
    `<p>${esc(CHURCHYARD_INTRO.noRetirementDate)}</p>` +
    `<p>${esc(assumptionsLine(config))}</p>` +
    `<p>${esc(CHURCHYARD_INTRO.blindSpot)}</p>`;
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
  return (
    `<div class="census">` +
    intro +
    section('population', H.population, populationHtml(c)) +
    section('verdicts', H.verdicts, verdictsHtml(c, config)) +
    borderline +
    section('era', H.era, eraHtml(c)) +
    section('orbit', H.orbit, orbitHtml(c, config)) +
    section('status', H.status, statusHtml(c, reg.records)) +
    section('owner', H.owner, ownerHtml(c, config)) +
    gaps +
    blind +
    section('comparison', H.comparison, comparisonHtml(comparisons)) +
    caveat +
    `</div>`
  );
}

/** Draws the census into `root`. Nothing to listen to, so the stop function does nothing. */
export function mountCensus(root: HTMLElement, reg: UiRegister): () => void {
  root.innerHTML = censusHtml(reg);
  return () => undefined;
}
