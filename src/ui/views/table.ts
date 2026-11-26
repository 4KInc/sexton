// The table view (design 5.5, R6.9): the same filtered set as the churchyard, as a real <table>.
import type { Config } from '../../engine/config.ts';
import type { SatRecord } from '../../engine/types.ts';
import {
  assumptionsLine,
  CHURCHYARD_INTRO,
  dataAge,
  TABLE,
  TERMS,
  VERDICT_ORDER,
  verdictCopy,
} from '../copy.ts';
import { formatP, formatSigned } from '../format.ts';
import { esc } from '../html.ts';
import { replaceQuery } from '../router.ts';
import { applyFilters, DEFAULT_PAGING, firstPage, hasFilters, NO_FILTERS, PAGE_SIZES, pageSlice, parsePaging, parseState, sortRecords, SORT_KEYS, toQuery } from '../state.ts';
import type { Filters, PageSize, PageSlice, Paging, Sort, SortKey, ViewState } from '../state.ts';
import { chipHtml } from './badge.ts';
import { filtersHtml, wireFilters } from './filters.ts';
import { fineHtml } from './fine.ts';
import { emptyFiltersHtml } from '../messages.ts';
import { csvFileName, registerCsv } from '../csv.ts';
import { gridRows } from './grid-rows.ts';
import type { GridHandle } from './grid.ts';
/** The grid replaces the HTML table above this width. At 600 px and below the table is the card list. */
export const GRID_MEDIA = '(min-width: 601px)';

/** The sorts a phone offers in a select, because it has no column headers. */
const PHONE_SORTS: readonly SortKey[] = ['name', 'norad', 'launch', 'p'];
export const edgesOf = (config: Config): number[] => [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];

/** A story row: launched on or after the rule date, unquiet or in a shallow grave. The same test as the chart's story stones. */
export const isStoryRow = (r: SatRecord): boolean =>
  r.verdict.kind === 'verdict' && r.verdict.era === null && (r.verdict.verdict === 'unquiet' || r.verdict.verdict === 'shallow grave');
/** The default order: story rows first, then perigee, lowest first. Ties break on NORAD id. */
export function defaultOrder(records: readonly SatRecord[]): SatRecord[] {
  return [...records].sort((a, b) => Number(isStoryRow(b)) - Number(isStoryRow(a)) || a.pKm - b.pKm || a.norad - b.norad);
}
/** The default view's set: retired payloads launched on or after the rule date. */
export const defaultSet = (records: readonly SatRecord[]): SatRecord[] => applyFilters(records, { ...NO_FILTERS, era: 'after' });
/** The set the table shows. With no filter at all it is the default view. Any filter gives exactly applyFilters, as it always did. */
export function viewOf(records: readonly SatRecord[], filters: Filters): { byDefault: boolean; shown: SatRecord[] } {
  const byDefault = !hasFilters(filters);
  return { byDefault, shown: byDefault ? defaultSet(records) : applyFilters(records, filters) };
}
function headerHtml(sort: Sort | null): string {
  return SORT_KEYS.map((key) => {
    const aria = sort !== null && sort.key === key ? ` aria-sort="${sort.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
    const short = (TABLE.heads as Partial<Record<SortKey, string>>)[key];
    // A short head is drawn; the full name is read out.
    const label = short === undefined ? esc(TABLE.columns[key]) : `<span aria-hidden="true">${esc(short)}</span><span class="visually-hidden">${esc(TABLE.columns[key])}</span>`;
    return `<th scope="col" role="columnheader"${aria}><button type="button" class="sort" data-sort="${key}">${label}</button></th>`;
  }).join('');
}

export function verdictCell(r: SatRecord, config: Config): string {
  const v = r.verdict;
  if (v.kind === 'verdict') return chipHtml(v.verdict, config, isStoryRow(r) ? 'story' : v.era === null ? 'quiet' : v.era === 'before FCC rule' ? 'early' : null);
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
/** The order of the rows: the default order, or the reader's sort. The HTML table and the grid both use it. */
export const orderRows = (shown: readonly SatRecord[], sort: Sort, byDefault: boolean): SatRecord[] => (byDefault ? defaultOrder(shown) : sortRecords(shown, sort));
/** The page of rows both renderers show: the set in its order, then pageSlice. Without `paging`, every row (print). */
export const tablePage = (shown: readonly SatRecord[], sort: Sort, byDefault: boolean, paging: Paging | null): PageSlice<SatRecord> =>
  pageSlice(orderRows(shown, sort, byDefault), paging?.page ?? 1, paging?.size ?? 'all');
/**
 * The table for an already filtered set. Sorting happens here, then the page is cut (all rows when `paging` is null).
 * The row numbers carry on from the page before: the counter starts at the page's first row.
 */
export function tableHtml(shown: readonly SatRecord[], config: Config, sort: Sort, byDefault = false, paging: Paging | null = null): string {
  const key = `<span class="col-key"> \u00B7 ${esc(TABLE.colKey(config.uncertaintyKm))}</span>`;
  const slice = tablePage(shown, sort, byDefault, paging);
  const rows = slice.rows.map((r) => rowHtml(r, config)).join('');
  const start = slice.from > 1 ? ` style="counter-reset: rowno ${slice.from - 1}"` : '';
  return (
    `<div class="table-wrap" role="region" aria-label="${esc(TABLE.scrollLabel)}" tabindex="0">` +
    `<table class="register-table" role="table"><caption>${esc(TABLE.caption)}${key}</caption>` +
    `<thead role="rowgroup"><tr role="row">${headerHtml(byDefault ? null : sort)}</tr></thead><tbody role="rowgroup"${start}>${rows}</tbody></table></div>`
  );
}
/** The pager under the table: Previous, the range on this page (announced politely), Next, and the page size. Hidden when there are no rows. */
export function pagerHtml(slice: PageSlice<unknown>, size: PageSize): string {
  const P = TABLE.pager;
  const options = PAGE_SIZES.map((s) => `<option value="${s}"${s === size ? ' selected' : ''}>${s === 'all' ? P.all : s}</option>`).join('');
  return (
    `<nav class="pager" id="pager" aria-label="${esc(P.label)}"${slice.total === 0 ? ' hidden' : ''}>` +
    `<button type="button" class="button" data-page="prev"${slice.page <= 1 ? ' disabled' : ''}>${esc(P.prev)}</button>` +
    `<p class="pager-range mono" id="pager-range" role="status" aria-live="polite">${esc(P.range(slice.from, slice.to, slice.total))}</p>` +
    `<button type="button" class="button" data-page="next"${slice.page >= slice.pages ? ' disabled' : ''}>${esc(P.next)}</button>` +
    // The label and its select are one unit, so they never wrap apart.
    `<span class="pager-size-group"><label class="pager-size" for="page-size">${esc(P.size)}</label><select id="page-size" data-page-size>${options}</select></span>` +
    `</nav>`
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
  let state: ViewState = { ...parseState(query), paging: parsePaging(query) };
  // The toolbar (search, filters, count) comes first, then one line of fine print. The long text is behind "Limits"
  // and the verdict key is a closed panel, so the table starts high on the screen.
  const config = reg.config;
  const isDefaultOrder = viewOf(reg.records, state.filters).byDefault && !query.has('sort');
  root.innerHTML =
    `<p class="kicker">${esc(TABLE.kicker)}</p><p class="lead">${esc(TABLE.lead)}</p>` +
    `<div class="toolbar toolbar--table">${filtersHtml(reg.records, state.filters, config, false, true)}<div class="view-note"><p class="status" id="table-status" role="status"></p><button type="button" class="button button--quiet" id="show-all" data-show-all hidden>${esc(TABLE.showAll(reg.records.length))}</button><button type="button" class="button button--quiet" id="download-csv" data-download-csv>${esc(TABLE.downloadCsv)}</button></div></div>` +
    fineHtml(reg.snapshot.set, config, [
      TABLE.intro,
      TERMS.geo,
      TERMS.perigee,
      TERMS.eccentricity,
      CHURCHYARD_INTRO.voluntary,
      CHURCHYARD_INTRO.noRetirementDate,
      assumptionsLine(config),
      CHURCHYARD_INTRO.blindSpot,
    ], undefined, true) +
    `<div class="sortbar"><label for="sort-by">${esc(TABLE.sortBy)}</label><select id="sort-by"><option value="default"${isDefaultOrder ? ' selected' : ''}>${esc(TABLE.sortDefault)}</option>${PHONE_SORTS.map((k) => `<option value="${k}"${!isDefaultOrder && state.sort.key === k ? ' selected' : ''}>${esc(TABLE.columns[k])}</option>`).join('')}</select></div>` +
    `<details class="guide guide--table"><summary>${esc(TABLE.verdictKeySummary)}</summary><div class="guide-body">${verdictKeyHtml(config)}</div></details>` +
    emptyFiltersHtml('table-empty') +
    `<p class="grid-caption" id="grid-caption" tabindex="-1" hidden>${esc(TABLE.caption)}<span class="grid-key"> \u00B7 ${esc(TABLE.colKey(config.uncertaintyKm))}</span></p>` +
    `<div class="grid-host" id="grid-host" hidden></div>` +
    `<p class="grid-foot" id="grid-foot" hidden><span class="mono" id="grid-count"></span></p>` +
    `<div id="table-host"></div>` +
    pagerHtml(pageSlice([], 1, DEFAULT_PAGING.size), DEFAULT_PAGING.size);
  const form = root.querySelector<HTMLFormElement>('#filters')!;
  const status = root.querySelector<HTMLElement>('#table-status')!;
  const host = root.querySelector<HTMLElement>('#table-host')!;
  const showAll = root.querySelector<HTMLButtonElement>('#show-all')!;
  const gridHost = root.querySelector<HTMLElement>('#grid-host')!;
  const gridCount = root.querySelector<HTMLElement>('#grid-count')!;
  const gridFoot = root.querySelector<HTMLElement>('#grid-foot')!;
  const pager = root.querySelector<HTMLElement>('#pager')!;
  let grid: GridHandle | null = null;
  let stopped = false;
  /** While the page prints, the HTML table holds every matching row and the pager is hidden (print.css). */
  let printing = false;
  const paging = (): Paging => state.paging ?? DEFAULT_PAGING;
  /**
   * The count under the grid ("131 rows") is shown only where the pager does not already give it: with all rows on one
   * page, or with no pager. So the total is on screen once.
   */
  const showFoot = (pagerShown: boolean): void => {
    gridFoot.hidden = grid === null || (pagerShown && paging().size !== 'all');
  };
  /** Brings the pager in line with a slice, in place, so the focused button keeps focus. */
  const showPager = (slice: PageSlice<unknown>): void => {
    pager.hidden = slice.total === 0;
    const prev = pager.querySelector<HTMLButtonElement>('[data-page="prev"]')!;
    const next = pager.querySelector<HTMLButtonElement>('[data-page="next"]')!;
    const hadFocus = document.activeElement;
    prev.disabled = slice.page <= 1;
    next.disabled = slice.page >= slice.pages;
    // A button that just turned disabled would drop focus to the page; hand it to the other one.
    if (hadFocus === next && next.disabled && !prev.disabled) prev.focus();
    if (hadFocus === prev && prev.disabled && !next.disabled) next.focus();
    pager.querySelector('#pager-range')!.textContent = TABLE.pager.range(slice.from, slice.to, slice.total);
    pager.querySelector<HTMLSelectElement>('#page-size')!.value = String(paging().size);
  };
  // With no filter at all the table opens on the default view. Any filter, including "Show unmarked bones", leaves it,
  // and a link with a filter in it shows exactly what it showed before. A column the reader picks overrides the default order.
  let sorted = query.has('sort');
  const draw = (sortNote: string): void => {
    const { byDefault, shown } = viewOf(reg.records, state.filters);
    showAll.hidden = !byDefault;
    status.textContent = byDefault
      ? [TABLE.defaultNote(shown.length), sortNote].filter((s) => s !== '').join(' ')
      : sortNote;
    // No rows: the empty state says so and offers "Clear all". The toolbar's count ("Showing 0 of 1,764") is the live announcement.
    root.querySelector<HTMLElement>('#table-empty')!.hidden = shown.length > 0;
    const plain = byDefault && !sorted;
    // One page for both renderers. A page past the end falls back to page 1, and the address says so.
    const slice = tablePage(shown, state.sort, plain, paging());
    if (slice.page !== paging().page) {
      state = { ...state, paging: { ...paging(), page: slice.page } };
      replaceQuery(toQuery(state));
    }
    host.innerHTML = tableHtml(shown, reg.config, state.sort, plain, printing ? null : paging());
    showPager(slice);
    gridCount.textContent = TABLE.gridRows(shown.length);
    showFoot(slice.total > 0);
    grid?.update(gridRows(shown, config, state.sort, plain), plain ? null : state.sort, { ...paging(), page: slice.page });
  };
  const onPager = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-page]');
    if (button === null || button.disabled) return;
    const p = paging();
    state = { ...state, paging: { ...p, page: p.page + (button.dataset['page'] === 'next' ? 1 : -1) } };
    replaceQuery(toQuery(state));
    draw('');
    host.querySelector<HTMLElement>('.table-wrap')?.scrollTo({ top: 0 });
  };
  const onPageSize = (event: Event): void => {
    const value = (event.target as HTMLSelectElement).value;
    const size = PAGE_SIZES.find((s) => String(s) === value) ?? DEFAULT_PAGING.size;
    state = { ...state, paging: { page: 1, size } };
    replaceQuery(toQuery(state));
    draw('');
  };
  // Every matching row in the order on screen, all pages, as a CSV file.
  const csvButton = root.querySelector<HTMLButtonElement>('#download-csv')!;
  const onCsv = (): void => {
    const { byDefault, shown } = viewOf(reg.records, state.filters);
    const text = registerCsv(orderRows(shown, state.sort, byDefault && !sorted), config, reg.snapshot.set);
    // A byte-order mark, so a spreadsheet reads the names and the ± in UTF-8.
    const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(reg.snapshot.set);
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  csvButton.addEventListener('click', onCsv);
  pager.addEventListener('click', onPager);
  pager.addEventListener('change', onPageSize);
  // Print every matching row: the browser says when it is about to print, and when it is done.
  const onBeforePrint = (): void => {
    printing = true;
    draw('');
  };
  const onAfterPrint = (): void => {
    printing = false;
    draw('');
  };
  const printMedia = window.matchMedia('print');
  const onPrintMedia = (e: MediaQueryListEvent): void => (e.matches ? onBeforePrint() : onAfterPrint());
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);
  printMedia.addEventListener('change', onPrintMedia);
  /** The sort a reader picked from a grid header: the same path as the HTML header buttons. */
  const onGridSort = (sort: Sort): void => {
    state = firstPage({ ...state, sort });
    sorted = true;
    replaceQuery(toQuery(state));
    sortBy.value = PHONE_SORTS.includes(sort.key) ? sort.key : 'default';
    draw(TABLE.sortedBy(TABLE.columns[sort.key], sort.dir));
  };
  // The grid loads only on a screen wider than a phone. If it fails to load, the HTML table simply stays.
  const wide = window.matchMedia(GRID_MEDIA);
  let loading = false;
  const ensureGrid = (): void => {
    if (!wide.matches || grid !== null || loading) return;
    loading = true;
    import('./grid.ts')
      .then((m) => {
        if (stopped) return;
        const { byDefault, shown } = viewOf(reg.records, state.filters);
        const plain = byDefault && !sorted;
        grid = m.mountGrid(gridHost, {
          rows: gridRows(shown, config, state.sort, plain),
          sort: plain ? null : state.sort,
          paging: { ...paging(), page: tablePage(shown, state.sort, plain, paging()).page },
          onSort: onGridSort,
          onOpen: (norad) => {
            window.location.hash = `#/sat/${norad}`;
          },
        });
        // The grid is named by the caption above it, as the HTML table is by its <caption>.
        gridHost.querySelector('[role="grid"], [role="treegrid"]')?.setAttribute('aria-labelledby', 'grid-caption');
        for (const el of [gridHost, root.querySelector<HTMLElement>('#grid-caption')!]) el.hidden = false;
        showFoot(!pager.hidden);
        root.classList.add('grid-on');
      })
      .catch(() => {
        loading = false;
      });
  };
  wide.addEventListener('change', ensureGrid);
  const onShowAll = (): void => {
    // The same path as ticking the box: the form reads it, the address takes bones=1, the table redraws.
    const box = form.querySelector<HTMLButtonElement>('#f-bones')!;
    if (box.getAttribute('aria-checked') !== 'true') box.click();
    // The button hides itself, so focus moves to what it opened: the grid's caption, or the HTML table.
    if (grid !== null) root.querySelector<HTMLElement>('#grid-caption')?.focus();
    else host.querySelector<HTMLElement>('.table-wrap')?.focus();
  };
  showAll.addEventListener('click', onShowAll);
  draw('');
  ensureGrid();
  const unwire = wireFilters(
    form,
    () => state,
    (next) => {
      state = next;
    },
    () => draw(''),
    { records: reg.records, config },
  );
  const sortBy = root.querySelector<HTMLSelectElement>('#sort-by')!;
  const onSortBy = (): void => {
    if (sortBy.value === 'default') {
      sorted = false;
      state = firstPage({ ...state, sort: parseState(new URLSearchParams()).sort });
      replaceQuery(toQuery(state));
      draw('');
      return;
    }
    const key = sortBy.value as SortKey;
    state = firstPage({ ...state, sort: { key, dir: 'asc' } });
    sorted = true;
    replaceQuery(toQuery(state));
    draw(TABLE.sortedBy(TABLE.columns[key], 'asc'));
  };
  sortBy.addEventListener('change', onSortBy);
  const onClick = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-sort]');
    if (button === null) return;
    const key = button.dataset['sort'] as SortKey;
    const dir = state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc';
    state = firstPage({ ...state, sort: { key, dir } });
    sorted = true;
    replaceQuery(toQuery(state));
    sortBy.value = key;
    draw(TABLE.sortedBy(TABLE.columns[key], dir));
    // The header was redrawn, so put focus back on the same button.
    host.querySelector<HTMLButtonElement>(`button[data-sort="${key}"]`)?.focus();
  };
  host.addEventListener('click', onClick);
  const onEmptyClear = (event: Event): void => {
    if ((event.target as Element).closest('[data-empty-clear]') !== null) form.querySelector<HTMLButtonElement>('[data-clear-filters]')?.click();
  };
  root.addEventListener('click', onEmptyClear);
  return () => {
    stopped = true;
    wide.removeEventListener('change', ensureGrid);
    grid?.destroy();
    unwire();
    showAll.removeEventListener('click', onShowAll);
    sortBy.removeEventListener('change', onSortBy);
    host.removeEventListener('click', onClick);
    root.removeEventListener('click', onEmptyClear);
    pager.removeEventListener('click', onPager);
    csvButton.removeEventListener('click', onCsv);
    pager.removeEventListener('change', onPageSize);
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
    printMedia.removeEventListener('change', onPrintMedia);
  };
}
