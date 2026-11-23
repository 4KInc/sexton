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
import { filtersHtml, wireFilters } from './filters.ts';

const edgesOf = (config: Config): number[] => [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];

function headerHtml(sort: Sort): string {
  return SORT_KEYS.map((key) => {
    const aria = sort.key === key ? ` aria-sort="${sort.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
    return `<th scope="col"${aria}><button type="button" class="sort" data-sort="${key}">${esc(TABLE.columns[key])}</button></th>`;
  }).join('');
}

function verdictCell(r: SatRecord, config: Config): string {
  const v = r.verdict;
  if (v.kind === 'verdict') return esc(verdictCopy(v.verdict, config).word);
  if (v.kind === 'unmarked bones') return esc(TABLE.bones(r.status));
  return esc(TABLE.noVerdict(v.reason));
}

/** One row. Every object gets a row, with or without a verdict. */
export function rowHtml(r: SatRecord, config: Config): string {
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const name = v.kind === 'verdict' ? `<a href="#/sat/${r.norad}">${esc(r.name)}</a>` : esc(r.name);
  const borderline = v.kind === 'verdict' ? (v.borderline ? TABLE.yes : TABLE.no) : TABLE.notApplicable;
  return (
    `<tr data-norad="${r.norad}"><th scope="row">${name}</th>` +
    `<td>${r.norad}</td>` +
    `<td>${esc(r.owner ?? TABLE.unknown)}</td>` +
    `<td>${esc(r.launchDate ?? TABLE.unknown)}</td>` +
    `<td>${verdictCell(r, config)}</td>` +
    `<td>${esc(borderline)}</td>` +
    `<td class="num-cell">${esc(formatP(r.pKm, r.orbitSource.kind, edgesOf(config)))}</td>` +
    `<td class="num-cell">${esc(formatSigned(r.qKm, decimals))}</td>` +
    `<td class="num-cell">${esc(r.e.toFixed(5))}</td>` +
    `<td>${esc(r.orbitSource.kind)}</td>` +
    `<td>${esc(dataAge(r))}</td></tr>`
  );
}

/** The table for an already filtered set. Sorting happens here. */
export function tableHtml(shown: readonly SatRecord[], config: Config, sort: Sort): string {
  const rows = sortRecords(shown, sort).map((r) => rowHtml(r, config)).join('');
  return (
    `<div class="table-wrap" role="region" aria-label="${esc(TABLE.scrollLabel)}" tabindex="0">` +
    `<table class="register-table"><caption>${esc(TABLE.caption)}</caption>` +
    `<thead><tr>${headerHtml(sort)}</tr></thead><tbody>${rows}</tbody></table></div>`
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
export function mountTable(root: HTMLElement, reg: { records: SatRecord[]; config: Config }, query: URLSearchParams): () => void {
  let state: ViewState = parseState(query);
  root.innerHTML =
    introHtml(reg.config) +
    filtersHtml(reg.records, state.filters, reg.config, true) +
    verdictKeyHtml(reg.config) +
    `<p class="status" id="table-status" role="status"></p><div id="table-host"></div>`;
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
  const onClick = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-sort]');
    if (button === null) return;
    const key = button.dataset['sort'] as SortKey;
    const dir = state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc';
    state = { ...state, sort: { key, dir } };
    replaceQuery(toQuery(state));
    draw(TABLE.sortedBy(TABLE.columns[key], dir));
    // The header was redrawn, so put focus back on the same button.
    host.querySelector<HTMLButtonElement>(`button[data-sort="${key}"]`)?.focus();
  };
  host.addEventListener('click', onClick);
  return () => {
    unwire();
    host.removeEventListener('click', onClick);
  };
}
