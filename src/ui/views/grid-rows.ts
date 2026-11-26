// The rows the desktop grid shows (redesign 4, step B). Pure: no DOM and no AG Grid, so it is tested like the HTML table.
// The set comes from applyFilters and the order from orderRows, exactly as for the HTML table; the grid only draws them.
import type { Config } from '../../engine/config.ts';
import type { SatRecord } from '../../engine/types.ts';
import { dataAge, TABLE } from '../copy.ts';
import { formatP, formatSigned } from '../format.ts';
import type { Sort } from '../state.ts';
import { edgesOf, isStoryRow, orderRows, verdictCell } from './table.ts';
export interface GridRow {
  /** The row number, 1 for the first row in the current order. */
  n: number;
  norad: number;
  name: string;
  /** Whether the object has a ledger (a verdict). Only these rows link and open on click or Enter. */
  ledger: boolean;
  owner: string;
  launch: string;
  /** The verdict cell's HTML: the same chip as the HTML table, or the plain words for a row with no verdict. */
  verdictHtml: string;
  /** null where borderline does not apply. */
  borderline: boolean | null;
  p: string;
  q: string;
  e: string;
  source: string;
  age: string;
  /** Unquiet or shallow grave, launched on or after the rule date: the row takes a thin lantern left border. */
  story: boolean;
}
/** One grid row for a record, with the same text as the HTML table's row. */
export function gridRow(r: SatRecord, n: number, config: Config): GridRow {
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  return {
    n,
    norad: r.norad,
    name: r.name,
    ledger: v.kind === 'verdict',
    owner: r.owner ?? TABLE.unknown,
    launch: r.launchDate ?? TABLE.unknown,
    verdictHtml: verdictCell(r, config),
    borderline: v.kind === 'verdict' ? v.borderline : null,
    p: formatP(r.pKm, r.orbitSource.kind, edgesOf(config)),
    q: formatSigned(r.qKm, decimals),
    e: r.e.toFixed(5),
    source: r.orbitSource.kind,
    age: dataAge(r),
    story: isStoryRow(r),
  };
}
/** The grid's rows for an already filtered set, in the HTML table's order. `byDefault` is the default order (no column picked). */
export const gridRows = (shown: readonly SatRecord[], config: Config, sort: Sort, byDefault: boolean): GridRow[] =>
  orderRows(shown, sort, byDefault).map((r, i) => gridRow(r, i + 1, config));
