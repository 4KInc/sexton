// The desktop table as an AG Grid Community grid (redesign 4, step B). Loaded by dynamic import() only when
// #/table opens wider than 600 px; the HTML table stays for phones, print, and as the fallback if this fails to load.
// The grid only draws: the set comes from applyFilters and the order from orderRows (grid-rows.ts). A header click
// is passed back to table.ts, which writes sort= into the address and hands the grid its new rows.
// Modules: AG Grid's core already holds the client-side row model, sorting, column resize, pinning and keyboard
// navigation. RowStyleModule adds getRowClass (the story row's lantern border), CellStyleModule adds cellClass (mono
// numbers), ColumnApiModule adds getColumnState and applyColumnState (the sort in the header). Nothing else is registered.
import { CellStyleModule, ColumnApiModule, createGrid, ModuleRegistry, RowStyleModule, themeQuartz } from 'ag-grid-community';
import type { CellKeyDownEvent, ColDef, GridApi, ICellRendererParams, RowClickedEvent, SortChangedEvent, SortDirection } from 'ag-grid-community';
import { TABLE } from '../copy.ts';
import { esc } from '../html.ts';
import type { Sort, SortKey } from '../state.ts';
import type { GridRow } from './grid-rows.ts';
ModuleRegistry.registerModules([RowStyleModule, CellStyleModule, ColumnApiModule]);
/** Sexton's tokens as the grid's theme. Every colour is a token, read as a CSS variable. */
export const sextonTheme = themeQuartz.withParams({
  backgroundColor: 'var(--surface-1)',
  foregroundColor: 'var(--bone)',
  textColor: 'var(--bone)',
  subtleTextColor: 'var(--bone-muted)',
  headerBackgroundColor: 'var(--surface-2)',
  headerTextColor: 'var(--bone-soft)',
  headerFontFamily: 'var(--font-body)',
  headerFontWeight: 600,
  headerFontSize: 13,
  headerHeight: 40,
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  rowHeight: 40,
  rowBorder: { style: 'solid', width: 1, color: 'var(--rule)' },
  headerRowBorder: { style: 'solid', width: 1, color: 'var(--rule-strong)' },
  columnBorder: false,
  headerColumnBorder: false,
  // The column separators are the resize handles: short and faint, and bone only while the header is hovered (table.css).
  headerColumnResizeHandleColor: 'var(--rule)',
  headerColumnResizeHandleHeight: '40%',
  pinnedColumnBorder: { style: 'solid', width: 1, color: 'var(--rule-strong)' },
  wrapperBorder: false,
  wrapperBorderRadius: 2,
  borderRadius: 2,
  rowHoverColor: 'var(--surface-2)',
  oddRowBackgroundColor: 'var(--surface-1)',
  selectedRowBackgroundColor: 'var(--surface-3)',
  accentColor: 'var(--lantern)',
  borderColor: 'var(--rule)',
  iconColor: 'var(--bone-soft)',
  cellHorizontalPadding: 10,
  spacing: 6,
  browserColorScheme: 'dark',
  // No motion in the grid, so nothing moves under prefers-reduced-motion either (rows do not animate: animateRows is off).
  headerCellBackgroundTransitionDuration: 0,
});
export interface GridOptionsIn {
  rows: GridRow[];
  /** The sort to show in the header, or null in the default order. */
  sort: Sort | null;
  onSort: (sort: Sort) => void;
  onOpen: (norad: number) => void;
}
export interface GridHandle {
  update: (rows: GridRow[], sort: Sort | null) => void;
  destroy: () => void;
}
const nameCell = (p: ICellRendererParams<GridRow>): string => {
  const r = p.data;
  if (r === undefined) return '';
  return r.ledger ? `<a class="grid-name" href="#/sat/${r.norad}" tabindex="-1">${esc(r.name)}</a>` : `<span class="grid-name">${esc(r.name)}</span>`;
};
const borderlineCell = (p: ICellRendererParams<GridRow>): string => {
  const b = p.data?.borderline;
  if (b === true) return `<span class="mark" aria-hidden="true">${esc(TABLE.heads.borderline)}</span><span class="visually-hidden">${esc(TABLE.yes)}</span>`;
  return `<span class="visually-hidden">${esc(b === false ? TABLE.no : TABLE.notApplicable)}</span>`;
};
/** The columns, in the HTML table's order. The sorted ones carry Sexton's own sort keys as their ids. */
function columns(): ColDef<GridRow>[] {
  // The grid keeps the order it is given: Sexton sorts the rows, so the comparator says every pair is equal.
  const data = (key: SortKey, def: ColDef<GridRow>): ColDef<GridRow> => ({
    colId: key,
    headerName: (TABLE.heads as Partial<Record<SortKey, string>>)[key] ?? TABLE.columns[key],
    sortable: true,
    sortingOrder: ['asc', 'desc'],
    comparator: () => 0,
    ...def,
  });
  // cellClass replaces the class the rightAligned type would add, so it is named here again.
  const num = { type: 'rightAligned', cellClass: 'grid-num ag-right-aligned-cell' } as const;
  // Every column but the two pinned ones flexes from a minimum wide enough for its header and sort arrow, so the
  // whole grid fits the content column (1,248 px at 1280, 1,408 px at 1440) with no sideways scroll.
  const fit = (minWidth: number, flex = 1): Pick<ColDef<GridRow>, 'minWidth' | 'flex'> => ({ minWidth, flex });
  return [
    { colId: 'n', headerName: '#', valueGetter: (p) => p.data?.n, width: 48, pinned: 'left', sortable: false, resizable: false, cellClass: 'grid-num grid-n ag-right-aligned-cell', type: 'rightAligned' },
    data('name', { field: 'name', pinned: 'left', width: 180, cellRenderer: nameCell }),
    data('norad', { field: 'norad', ...fit(96), ...num }),
    data('owner', { field: 'owner', ...fit(80) }),
    data('launch', { field: 'launch', ...fit(124), cellClass: 'grid-num' }),
    data('verdict', { field: 'verdictHtml', ...fit(144, 1.4), cellRenderer: (p: ICellRendererParams<GridRow>) => p.data?.verdictHtml ?? '' }),
    data('borderline', { field: 'borderline', width: 52, minWidth: 52, cellRenderer: borderlineCell, cellClass: 'grid-mark' }),
    data('p', { field: 'p', ...fit(80), ...num }),
    data('q', { field: 'q', ...fit(80), ...num }),
    data('e', { field: 'e', ...fit(80), ...num }),
    data('source', { field: 'source', ...fit(72) }),
    data('age', { field: 'age', ...fit(196, 2), cellClass: 'grid-num grid-age' }),
  ];
}
/** Draws the grid into `host`. */
export function mountGrid(host: HTMLElement, opts: GridOptionsIn): GridHandle {
  // A sort set by the code (to match the address) is not a reader's click, so it is not passed back.
  let applying = false;
  const showSort = (api: GridApi<GridRow>, sort: Sort | null): void => {
    applying = true;
    api.applyColumnState({ state: sort === null ? [] : [{ colId: sort.key, sort: sort.dir as SortDirection }], defaultState: { sort: null } });
    applying = false;
  };
  const api = createGrid<GridRow>(host, {
    theme: sextonTheme,
    columnDefs: columns(),
    defaultColDef: { resizable: true, suppressMovable: true, suppressHeaderMenuButton: true },
    rowData: opts.rows,
    getRowClass: (p) => (p.data?.story === true ? 'grid-row--story' : undefined),
    suppressCellFocus: false,
    ensureDomOrder: true,
    animateRows: false,
    // Sexton draws its own empty state above the grid, with a way out, so AG Grid's own overlay stays off.
    suppressNoRowsOverlay: true,
    suppressDragLeaveHidesColumns: true,
    onSortChanged: (event: SortChangedEvent<GridRow>) => {
      if (applying || event.source !== 'uiColumnSorted') return;
      const col = event.api.getColumnState().find((c) => c.sort === 'asc' || c.sort === 'desc');
      if (col === undefined) return;
      opts.onSort({ key: col.colId as SortKey, dir: col.sort as 'asc' | 'desc' });
    },
    onRowClicked: (event: RowClickedEvent<GridRow>) => {
      const e = event.event as MouseEvent | null | undefined;
      // A click with a modifier on the name link keeps the link's own behaviour (a new tab).
      if (e != null && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
      if (event.data?.ledger === true) {
        e?.preventDefault();
        opts.onOpen(event.data.norad);
      }
    },
    onCellKeyDown: (event) => {
      const e = (event as CellKeyDownEvent<GridRow>).event as KeyboardEvent | null | undefined;
      if (e?.key === 'Enter' && event.data?.ledger === true) opts.onOpen(event.data.norad);
    },
  });
  showSort(api, opts.sort);
  return {
    update: (rows, sort) => {
      api.setGridOption('rowData', rows);
      // No row ids, so the rows are replaced whole and keep exactly the order given (and the new row numbers).
      showSort(api, sort);
    },
    destroy: () => api.destroy(),
  };
}
