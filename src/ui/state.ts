// Filters, search and table sort, kept in the hash query (design 5.4, 5.5, R6.8).
// Pure: no DOM. Both views read the same state and call the same applyFilters, so they show the same set.
import type { SatRecord, VerdictName } from '../engine/types.ts';
import { VERDICT_ORDER } from './copy.ts';

export type EraFilter = 'before' | 'after' | 'unknown';
export const ERA_FILTERS: readonly EraFilter[] = ['before', 'after', 'unknown'];
/** Owner value in the query for records whose owner is not given. */
export const OWNER_NONE = '(not given)';

export interface Filters {
  /** An owner code, OWNER_NONE, or null for any. */
  owner: string | null;
  /** A sourced operator's name (exact), or null for any. Only retired payloads launched on or after the FCC rule date can have one. */
  operator: string | null;
  /** In VERDICT_ORDER order. Empty means any. */
  verdicts: VerdictName[];
  era: EraFilter | null;
  /** Show unmarked bones (rocket bodies and debris). Off by default. */
  bones: boolean;
  /** Search text, trimmed, with runs of spaces collapsed. */
  q: string;
}

export type SortKey = 'name' | 'norad' | 'owner' | 'launch' | 'verdict' | 'borderline' | 'p' | 'q' | 'e' | 'source' | 'age';
export const SORT_KEYS: readonly SortKey[] = ['name', 'norad', 'owner', 'launch', 'verdict', 'borderline', 'p', 'q', 'e', 'source', 'age'];
export type SortDir = 'asc' | 'desc';
export interface Sort {
  key: SortKey;
  dir: SortDir;
}
export const DEFAULT_SORT: Sort = { key: 'norad', dir: 'asc' };

/** Rows per table page. "all" shows every matching row on one page. */
export type PageSize = 25 | 50 | 100 | 'all';
export const PAGE_SIZES: readonly PageSize[] = [25, 50, 100, 'all'];
/** The table's page: 1-based, and the rows per page. Only the table carries it. */
export interface Paging {
  page: number;
  size: PageSize;
}
export const DEFAULT_PAGING: Paging = { page: 1, size: 50 };
export interface ViewState {
  filters: Filters;
  sort: Sort;
  /** The table's page. Absent on the churchyard, so its addresses never carry page= or size=. */
  paging?: Paging;
}

export const NO_FILTERS: Filters = { owner: null, operator: null, verdicts: [], era: null, bones: false, q: '' };

export const normalizeQ = (text: string): string => text.trim().replace(/\s+/g, ' ');

/** Reads filters from a hash query. Unknown keys and bad values are ignored. Never throws. */
export function parseFilters(query: URLSearchParams): Filters {
  const owner = query.get('owner');
  const operator = query.get('operator');
  const asked = new Set(query.getAll('verdict'));
  const era = query.get('era');
  return {
    owner: owner === null || owner === '' ? null : owner,
    operator: operator === null || operator === '' ? null : operator,
    verdicts: VERDICT_ORDER.filter((v) => asked.has(v)),
    era: ERA_FILTERS.find((e) => e === era) ?? null,
    bones: query.get('bones') === '1',
    q: normalizeQ(query.get('q') ?? ''),
  };
}

/** Reads the table sort from a hash query. */
export function parseSort(query: URLSearchParams): Sort {
  const key = SORT_KEYS.find((k) => k === query.get('sort'));
  if (key === undefined) return DEFAULT_SORT;
  return { key, dir: query.get('dir') === 'desc' ? 'desc' : 'asc' };
}

export const parseState = (query: URLSearchParams): ViewState => ({ filters: parseFilters(query), sort: parseSort(query) });
/**
 * Reads page= (1-based) and size= (25, 50, 100 or all) from a hash query. A bad size gives 50 and a bad page gives 1.
 * A page past the end of the rows is caught later, by pageSlice, which also falls back to page 1.
 */
export function parsePaging(query: URLSearchParams): Paging {
  const s = query.get('size');
  const size = PAGE_SIZES.find((p) => String(p) === s) ?? DEFAULT_PAGING.size;
  const p = query.get('page');
  const page = p !== null && /^[1-9]\d{0,5}$/.test(p) ? Number(p) : DEFAULT_PAGING.page;
  return { page, size };
}
/** The state with its page back to 1, as after any change of filter, search or sort. The size is kept. */
export const firstPage = (state: ViewState): ViewState => (state.paging === undefined ? state : { ...state, paging: { ...state.paging, page: 1 } });
/** One page of already ordered rows. A page past the end, or below 1, falls back to page 1. `from` and `to` are 1-based and inclusive; both are 0 when there are no rows. */
export interface PageSlice<T> {
  rows: T[];
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}
export function pageSlice<T>(rows: readonly T[], page: number, size: PageSize): PageSlice<T> {
  const total = rows.length;
  const per = size === 'all' ? Math.max(total, 1) : size;
  const pages = Math.max(1, Math.ceil(total / per));
  const at = Number.isInteger(page) && page >= 1 && page <= pages ? page : 1;
  const start = (at - 1) * per;
  const out = rows.slice(start, start + per);
  return { rows: out, page: at, pages, from: total === 0 ? 0 : start + 1, to: start + out.length, total };
}

/** The canonical query: only non-default values, keys in a fixed order. */
export function toQuery(state: ViewState): URLSearchParams {
  const { filters: f, sort } = state;
  const out = new URLSearchParams();
  if (f.owner !== null) out.set('owner', f.owner);
  if (f.operator !== null) out.set('operator', f.operator);
  for (const v of f.verdicts) out.append('verdict', v);
  if (f.era !== null) out.set('era', f.era);
  if (f.bones) out.set('bones', '1');
  const q = normalizeQ(f.q);
  if (q !== '') out.set('q', q);
  if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) {
    out.set('sort', sort.key);
    if (sort.dir === 'desc') out.set('dir', 'desc');
  }
  // The table's page, only when it is not the default (page 1, 50 rows).
  if (state.paging !== undefined) {
    if (state.paging.page !== DEFAULT_PAGING.page) out.set('page', String(state.paging.page));
    if (state.paging.size !== DEFAULT_PAGING.size) out.set('size', String(state.paging.size));
  }
  return out;
}

/** "#/table?owner=US", or "#/" when the query is empty. `path` is "" for the churchyard. */
export function hashFor(path: '' | 'table', state: ViewState): string {
  const qs = toQuery(state).toString();
  return `#/${path}${qs === '' ? '' : `?${qs}`}`;
}

export const hasFilters = (f: Filters): boolean =>
  f.owner !== null || f.operator !== null || f.verdicts.length > 0 || f.era !== null || f.bones || normalizeQ(f.q) !== '';

const ERA_OF: Record<EraFilter, 'before FCC rule' | null | 'unknown'> = { before: 'before FCC rule', after: null, unknown: 'unknown' };

/**
 * The one filtered set, used by the churchyard and the table (design 5.4, 5.5).
 * - Unmarked bones are in the set only when `bones` is on.
 * - A verdict or era filter keeps only records that have a verdict: living, unknown and bones rows drop out.
 * - Search matches the name (any case) or the start of the NORAD id.
 * The order of `records` is kept.
 */
export function applyFilters(records: readonly SatRecord[], f: Filters): SatRecord[] {
  const q = normalizeQ(f.q).toLowerCase();
  return records.filter((r) => {
    if (r.verdict.kind === 'unmarked bones' && !f.bones) return false;
    if (f.owner !== null && (f.owner === OWNER_NONE ? r.owner !== null : r.owner !== f.owner)) return false;
    if (f.operator !== null && r.operator !== f.operator) return false;
    if (f.verdicts.length > 0 && !(r.verdict.kind === 'verdict' && f.verdicts.includes(r.verdict.verdict))) return false;
    if (f.era !== null && !(r.verdict.kind === 'verdict' && r.verdict.era === ERA_OF[f.era])) return false;
    if (q !== '' && !(r.name.toLowerCase().includes(q) || String(r.norad).startsWith(q))) return false;
    return true;
  });
}

/** What the churchyard draws from a filtered set: retired payloads, and unmarked bones when they are on. */
export const drawnInChurchyard = (records: readonly SatRecord[]): SatRecord[] =>
  records.filter((r) => r.verdict.kind === 'verdict' || r.verdict.kind === 'unmarked bones');

/** Owners present in the records, sorted, for the owner select. */
export const ownersOf = (records: readonly SatRecord[]): { codes: string[]; hasNone: boolean } => ({
  codes: [...new Set(records.flatMap((r) => (r.owner === null ? [] : [r.owner])))].sort(),
  hasNone: records.some((r) => r.owner === null),
});

function sortValue(r: SatRecord, key: SortKey): string | number | null {
  const v = r.verdict;
  switch (key) {
    case 'name':
      return r.name.toLowerCase();
    case 'norad':
      return r.norad;
    case 'owner':
      return r.owner;
    case 'launch':
      return r.launchDate;
    case 'verdict':
      return v.kind === 'verdict' ? VERDICT_ORDER.indexOf(v.verdict) : null;
    case 'borderline':
      return v.kind === 'verdict' ? Number(v.borderline) : null;
    case 'p':
      return r.pKm;
    case 'q':
      return r.qKm;
    case 'e':
      return r.e;
    case 'source':
      return r.orbitSource.kind;
    case 'age':
      return r.orbitSource.kind === 'GP' ? r.orbitSource.epoch : null;
  }
}

/** A sorted copy. Missing values go last in both directions. Ties break on NORAD id. */
export function sortRecords(records: readonly SatRecord[], sort: Sort): SatRecord[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    if (x !== null && y !== null && x !== y) return (x < y ? -1 : 1) * sign;
    return a.norad - b.norad;
  });
}
