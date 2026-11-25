// The table view (design 5.5, R6.9): the same filtered set as the churchyard, as a real <table>.
import type { Config } from '../../engine/config.ts';
import type { SatRecord } from '../../engine/types.ts';
import {
  assumptionsLine,
  CHURCHYARD_INTRO,
  dataAge,
  FILTERS,
  TABLE,
  TERMS,
  VERDICT_ORDER,
  verdictCopy,
} from '../copy.ts';
import { formatP, formatSigned } from '../format.ts';
import { esc } from '../html.ts';
import { replaceQuery } from '../router.ts';
import { applyFilters, hasFilters, parseState, sortRecords, SORT_KEYS, toQuery } from '../state.ts';
import type { Sort, SortKey, ViewState } from '../state.ts';
import { chipHtml } from './badge.ts';
import { filtersHtml, wireFilters } from './filters.ts';
import { fineHtml } from './fine.ts';

/** The sorts a phone offers in a select, because it has no column headers. */
const PHONE_SORTS: readonly SortKey[] = ['name', 'norad', 'launch', 'p'];
const edgesOf = (config: Config): number[] => [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];

function headerHtml(sort: Sort): string {
  return SORT_KEYS.map((key) => {
    const aria = sort.key === key ? ` aria-sort="${sort.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
    const short = (TABLE.heads as Partial<Record<SortKey, string>>)[key];
    // A short head is drawn; the full name is read out.
    const label = short === undefined ? esc(TABLE.columns[key]) : `<span aria-hidden="true">${esc(short)}</span><span class="visually-hidden">${esc(TABLE.columns[key])}</span>`;
    return `<th scope="col" role="columnheader"${aria}><button type="button" class="sort" data-sort="${key}">${label}</button></th>`;
  }).join('');
}

function verdictCell(r: SatRecord, config: Config): string {
  const v = r.verdict;
  if (v.kind === 'verdict') return chipHtml(v.verdict, config);
  if (v.kind === 'unmarked bones') return esc(TABLE.bones(r.status));
  return esc(TABLE.noVerdict(v.reason));
}

/** One row. Every object gets a row, with or without a verdict. */
export function rowHtml(r: SatRecord, config: Config): string {
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const name = v.kind === 'verdict' ? `<a href="#/sat/${r.norad}">${esc(r.name)}</a>` : esc(r.name);
  const borderline = v.kind === 'verdict' ? (v.borderline ? TABLE.yes : TABLE.no) : TABLE.notApplicable;
  const td = (value: string, cls = ''): string => `<td role="cell"${cls}>${value}</td>`;
  const num = ' class="num-cell"';
  return (
    `<tr data-norad="${r.norad}" role="row"><th scope="row" role="rowheader">${name}</th>` +
    td(String(r.norad)) +
    td(esc(r.owner ?? TABLE.unknown)) +
    td(esc(r.launchDate ?? TABLE.unknown)) +
    td(verdictCell(r, config)) +
    td(v.kind === 'verdict' && v.borderline ? `<span class="mark" aria-hidden="true">${esc(TABLE.heads.borderline)}</span><span class="visually-hidden">${esc(TABLE.yes)}</span>` : `<span class="visually-hidden">${esc(borderline)}</span>`) +
    td(esc(formatP(r.pKm, r.orbitSource.kind, edgesOf(config))), num) +
    td(esc(formatSigned(r.qKm, decimals)), num) +
    td(esc(r.e.toFixed(5)), num) +
    td(esc(r.orbitSource.kind)) +
    // The date inside the data age never breaks across lines.
    td(esc(dataAge(r)).replace(/(epoch )(.+)$/, '$1<span class="nw">$2</span>')) +
    `</tr>`
  );
}
/** The table for an already filtered set. Sorting happens here. */
export function tableHtml(shown: readonly SatRecord[], config: Config, sort: Sort): string {
  const key = `<span class="col-key"> \u00B7 ${esc(TABLE.colKey(config.uncertaintyKm))}</span>`;
  const rows = sortRecords(shown, sort).map((r) => rowHtml(r, config)).join('');
  return (
    `<div class="table-wrap" role="region" aria-label="${esc(TABLE.scrollLabel)}" tabindex="0">` +
    `<table class="register-table" role="table"><caption>${esc(TABLE.caption)}${key}</caption>` +
    `<thead role="rowgroup"><tr role="row">${headerHtml(sort)}</tr></thead><tbody role="rowgroup">${rows}</tbody></table></div>`
  );
}

/** The verdict words, each with its plain meaning once. */
export function verdictKeyHtml(config: Config): string {
  return (
    `<section aria-labelledby="verdict-key-title"><h2 id="verdict-key-title">${esc(TABLE.verdictKey)}</h2><ul class="key-list">` +
    VERDICT_ORDER.map((v) => `<li>${esc(verdictCopy(v, config).pair)}</li>`).join('') +
    `</ul></section>`
  );
}

export function introHtml(config: Config): string {
  return (
    `<p>${esc(TABLE.intro)}</p>` +
    `<ul class="terms"><li>${esc(TERMS.geo)}</li><li>${esc(TERMS.perigee)}</li><li>${esc(TERMS.eccentricity)}</li></ul>` +
    `<p>${esc(CHURCHYARD_INTRO.voluntary)}</p>` +
    `<p>${esc(CHURCHYARD_INTRO.noRetirementDate)}</p>` +
    `<p>${esc(assumptionsLine(config))}</p>` +
    `<p>${esc(CHURCHYARD_INTRO.blindSpot)}</p>`
  );
}

/** Draws the table view into `root`. Returns a function that removes the listeners. */
export function mountTable(root: HTMLElement, reg: { records: SatRecord[]; config: Config; snapshot: { set: string } }, query: URLSearchParams): () => void {
  let state: ViewState = parseState(query);
  // The toolbar (search, filters, count) comes first, then one line of fine print. The long text is behind "Limits"
  // and the verdict key is a closed panel, so the table starts high on the screen.
  const config = reg.config;
  root.innerHTML =
    `<p class="kicker">${esc(TABLE.kicker)}</p><p class="lead">${esc(TABLE.lead)}</p>` +
    `<div class="toolbar toolbar--table">${filtersHtml(reg.records, state.filters, config, state.filters.owner !== null || state.filters.era !== null || state.filters.verdicts.length > 0 || state.filters.bones, true)}<p class="status" id="table-status" role="status"></p></div>` +
    fineHtml(reg.snapshot.set, config, [
      TABLE.intro,
      TERMS.geo,
      TERMS.perigee,
      TERMS.eccentricity,
      CHURCHYARD_INTRO.voluntary,
      CHURCHYARD_INTRO.noRetirementDate,
      assumptionsLine(config),
      CHURCHYARD_INTRO.blindSpot,
    ]) +
    `<div class="sortbar"><label for="sort-by">${esc(TABLE.sortBy)}</label><select id="sort-by">${PHONE_SORTS.map((k) => `<option value="${k}"${state.sort.key === k ? ' selected' : ''}>${esc(TABLE.columns[k])}</option>`).join('')}</select></div>` +
    `<details class="guide guide--table"><summary>${esc(TABLE.verdictKeySummary)}</summary><div class="guide-body">${verdictKeyHtml(config)}</div></details>` +
    `<div id="table-host"></div>`;
  const form = root.querySelector<HTMLFormElement>('#filters')!;
  const status = root.querySelector<HTMLElement>('#table-status')!;
  const host = root.querySelector<HTMLElement>('#table-host')!;
  const draw = (sortNote: string): void => {
    const shown = applyFilters(reg.records, state.filters);
    status.textContent = [
      shown.length === 0 && hasFilters(state.filters) ? FILTERS.none : FILTERS.count(shown.length, reg.records.length),
      sortNote,
    ]
      .filter((s) => s !== '')
      .join(' ');
    host.innerHTML = tableHtml(shown, reg.config, state.sort);
  };
  draw('');
  const unwire = wireFilters(
    form,
    () => state,
    (next) => {
      state = next;
    },
    () => draw(''),
  );
  const onMore = (event: Event): void => {
    const toggle = (event.target as Element).closest<HTMLButtonElement>('[data-more]');
    if (toggle === null) return;
    const more = root.querySelector<HTMLElement>('#more-filters')!;
    const open = !more.hasAttribute('data-open');
    more.toggleAttribute('data-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  form.addEventListener('click', onMore);
  const sortBy = root.querySelector<HTMLSelectElement>('#sort-by')!;
  const onSortBy = (): void => {
    const key = sortBy.value as SortKey;
    state = { ...state, sort: { key, dir: 'asc' } };
    replaceQuery(toQuery(state));
    draw(TABLE.sortedBy(TABLE.columns[key], 'asc'));
  };
  sortBy.addEventListener('change', onSortBy);
  const onClick = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-sort]');
    if (button === null) return;
    const key = button.dataset['sort'] as SortKey;
    const dir = state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc';
    state = { ...state, sort: { key, dir } };
    replaceQuery(toQuery(state));
    sortBy.value = key;
    draw(TABLE.sortedBy(TABLE.columns[key], dir));
    // The header was redrawn, so put focus back on the same button.
    host.querySelector<HTMLButtonElement>(`button[data-sort="${key}"]`)?.focus();
  };
  host.addEventListener('click', onClick);
  return () => {
    unwire();
    form.removeEventListener('click', onMore);
    sortBy.removeEventListener('change', onSortBy);
    host.removeEventListener('click', onClick);
  };
}
