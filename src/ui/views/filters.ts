// The filter toolbar, shared by the churchyard and the table (design 5.4, R6.8).
// A search field, two select menus, verdict toggle chips, a switch for unmarked bones, and a line of active filters.
// The controls read back through the same parser the hash uses, so the address stays the source of truth.
import type { SatRecord, VerdictName } from '../../engine/types.ts';
import { FILTERS, VERDICT_ORDER, verdictCopy } from '../copy.ts';
import type { Config } from '../../engine/config.ts';
import { esc } from '../html.ts';
import { replaceQuery } from '../router.ts';
import { applyFilters, ERA_FILTERS, hasFilters, OWNER_NONE, ownersOf, parseFilters, toQuery } from '../state.ts';
import type { EraFilter, Filters, ViewState } from '../state.ts';
import { glyphSvg } from './badge.ts';
const ERA_LABEL: Record<EraFilter, string> = {
  before: FILTERS.eraBefore,
  after: FILTERS.eraAfter,
  unknown: FILTERS.eraUnknown,
};
const option = (value: string, label: string, selected: boolean): string =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
const icon = (cls: string, d: string): string =>
  `<svg class="${cls}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${d}</svg>`;
const SEARCH_ICON = icon('search-icon', '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>');
const CROSS = '<path d="M4 4l8 8M12 4l-8 8"/>';
const SLIDERS = icon('toggle-icon', '<path d="M2 4.5h12M2 11.5h12"/><circle cx="10" cy="4.5" r="1.8"/><circle cx="6" cy="11.5" r="1.8"/>');
/** The story verdicts: their chip is lantern when pressed (design.md, Palette). */
const STORY_VERDICTS: readonly VerdictName[] = ['unquiet', 'shallow grave'];
/** What a verdict chip would show if pressed: the other filters stay as they are, the verdict filter is this one word. */
const chipCount = (records: readonly SatRecord[], f: Filters, v: VerdictName): number => applyFilters(records, { ...f, verdicts: [v] }).length;
/** One removable pill for each active filter: search, owner, each verdict, era, bones. The Filters badge counts these. */
function pillsOf(filters: Filters, config: Config): [string, string][] {
  const pills: [string, string][] = [];
  if (filters.q !== '') pills.push(['q', FILTERS.searchPill(filters.q)]);
  if (filters.owner !== null) pills.push(['owner', FILTERS.ownerPill(filters.owner === OWNER_NONE ? FILTERS.noOwner : filters.owner)]);
  for (const v of filters.verdicts) pills.push([`verdict:${v}`, verdictCopy(v, config).word]);
  if (filters.era !== null) pills.push(['era', ERA_LABEL[filters.era]]);
  if (filters.bones) pills.push(['bones', FILTERS.bonesPill]);
  return pills;
}
const pillsInner = (filters: Filters, config: Config): string =>
  pillsOf(filters, config)
    .map(([key, label]) => `<li><button type="button" class="pill" data-remove="${esc(key)}" aria-label="${esc(FILTERS.remove(label))}"><span>${esc(label)}</span>${icon('', CROSS)}</button></li>`)
    .join('');
const countText = (records: readonly SatRecord[], filters: Filters): string => FILTERS.showing(applyFilters(records, filters).length, records.length);
/**
 * The toolbar as a string. `open` is whether the options panel starts open. `bar` draws it for the table: on a wide
 * screen the options are always in the row. `records` is the whole register, so the owner list does not shrink while filtering.
 */
export function filtersHtml(records: readonly SatRecord[], filters: Filters, config: Config, open: boolean, bar = false): string {
  const { codes, hasNone } = ownersOf(records);
  // An owner in the address that the register does not have still shows in the select, so the form matches the address.
  const known = new Set([...codes, ...(hasNone ? [OWNER_NONE] : [])]);
  const extra = filters.owner !== null && !known.has(filters.owner) ? [filters.owner] : [];
  const owners =
    option('', FILTERS.anyOwner, filters.owner === null) +
    [...codes, ...extra].map((c) => option(c, c, filters.owner === c)).join('') +
    (hasNone ? option(OWNER_NONE, FILTERS.noOwner, filters.owner === OWNER_NONE) : '');
  const eras = option('', FILTERS.anyEra, filters.era === null) + ERA_FILTERS.map((e) => option(e, ERA_LABEL[e], filters.era === e)).join('');
  const chips = VERDICT_ORDER.map((v) => {
    const on = filters.verdicts.includes(v);
    return (
      `<button type="button" class="fchip${STORY_VERDICTS.includes(v) ? ' chip--story' : ''}" data-verdict="${esc(v)}" aria-pressed="${on}">` +
      `${glyphSvg(v)}<span class="fchip-word">${esc(verdictCopy(v, config).word)}</span><span class="fchip-count mono">${chipCount(records, filters, v)}</span></button>`
    );
  }).join('');
  const search =
    `<div class="search">${SEARCH_ICON}<label class="visually-hidden" for="f-q">${esc(FILTERS.search)}</label>` +
    `<input type="search" id="f-q" name="q" value="${esc(filters.q)}" autocomplete="off" placeholder="${esc(FILTERS.placeholder)}" aria-describedby="f-q-hint">` +
    `<button type="button" class="search-clear" data-clear-search${filters.q === '' ? ' hidden' : ''}>${icon('', CROSS)}<span class="visually-hidden">${esc(FILTERS.clearSearch)}</span></button>` +
    `<span id="f-q-hint" class="visually-hidden">${esc(FILTERS.searchHint)}</span></div>`;
  const badge = pillsOf(filters, config).length;
  return (
    `<form class="filters${bar ? ' filters--bar' : ''}" id="filters" aria-label="${esc(FILTERS.legend)}"${open ? ' data-open' : ''} novalidate>` +
    `<div class="filter-row">${search}` +
    `<button type="button" class="filter-toggle" aria-expanded="${open}" aria-controls="filter-panel" data-filter-toggle>${SLIDERS}<span>${esc(FILTERS.toggle)}</span><span class="filter-badge mono" data-filter-badge${badge === 0 ? ' hidden' : ''}>${badge}</span></button>` +
    `<div class="filter-panel" id="filter-panel" role="group" aria-label="${esc(FILTERS.panel)}">` +
    `<div class="filter-sheet-head"><h2 class="filter-sheet-title" id="filter-sheet-title">${esc(FILTERS.toggle)}</h2><button type="button" class="button button--primary" data-filter-done>${esc(FILTERS.done)}</button></div>` +
    `<div class="select"><label for="f-owner">${esc(FILTERS.owner)}</label><select id="f-owner" name="owner">${owners}</select></div>` +
    `<div class="select"><label for="f-era">${esc(FILTERS.era)}</label><select id="f-era" name="era">${eras}</select></div>` +
    `<fieldset class="vchips"><legend class="visually-hidden">${esc(FILTERS.verdict)}</legend>${chips}</fieldset>` +
    `<button type="button" class="switch" role="switch" id="f-bones" data-bones aria-checked="${filters.bones}"><span class="switch-track"><span class="switch-thumb"></span></span><span>${esc(FILTERS.bones)}</span></button>` +
    `<p class="filters-note">${esc(FILTERS.note)}</p>` +
    `</div>` +
    `<div class="filter-active" role="group" aria-label="${esc(FILTERS.active)}"${hasFilters(filters) ? '' : ' hidden'}>` +
    `<ul class="pills">${pillsInner(filters, config)}</ul>` +
    `<button type="button" class="link-button" data-clear-filters>${esc(FILTERS.clearAll)}</button>` +
    // The table announces its count here; the churchyard announces it, with the drawn count, in its own status line.
    `<span class="filter-count mono"${bar ? ' role="status"' : ''}>${esc(countText(records, filters))}</span></div>` +
    `</div>` +
    `<div class="filter-scrim" data-filter-done aria-hidden="true"></div>` +
    `</form>`
  );
}
/** Reads the controls back into filters, through the same parser the hash uses. */
export function readFilters(form: HTMLFormElement): Filters {
  const pairs: [string, string][] = [];
  const value = (name: string): string => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? '';
  pairs.push(['q', value('q')], ['owner', value('owner')], ['era', value('era')]);
  for (const chip of form.querySelectorAll<HTMLElement>('[data-verdict][aria-pressed="true"]')) pairs.push(['verdict', chip.dataset['verdict'] ?? '']);
  if (form.querySelector('[data-bones]')?.getAttribute('aria-checked') === 'true') pairs.push(['bones', '1']);
  return parseFilters(new URLSearchParams(pairs));
}
/** The register and the config, for the chip counts and the result count. */
export interface FilterContext {
  records: readonly SatRecord[];
  config: Config;
}
/**
 * Wires the toolbar. On every change it writes the query into the hash (no redraw of the form, so
 * focus stays), refreshes the chips and the active line, and calls `onChange`. Returns a function that removes the listeners.
 */
export function wireFilters(
  form: HTMLFormElement,
  getState: () => ViewState,
  setState: (next: ViewState) => void,
  onChange: () => void,
  ctx: FilterContext,
): () => void {
  const q = form.querySelector<HTMLInputElement>('#f-q')!;
  const toggle = form.querySelector<HTMLButtonElement>('[data-filter-toggle]')!;
  const panel = form.querySelector<HTMLElement>('#filter-panel')!;
  const phone = window.matchMedia('(max-width: 600px)');
  /** Elements made inert while the sheet is open: everything outside the panel, except the scrim that closes it. */
  let inerted: HTMLElement[] = [];
  const release = (): void => {
    for (const el of inerted) el.inert = false;
    inerted = [];
  };
  const trap = (): void => {
    release();
    for (let node: HTMLElement = panel; node !== document.body && node.parentElement !== null; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.classList.contains('filter-scrim') && !sibling.inert) {
          sibling.inert = true;
          inerted.push(sibling);
        }
      }
    }
  };
  /** On a phone the open panel is a modal dialog; otherwise it is a plain group. */
  const setMode = (): void => {
    const modal = form.hasAttribute('data-open') && phone.matches;
    if (modal) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'filter-sheet-title');
      panel.removeAttribute('aria-label');
      trap();
    } else {
      panel.setAttribute('role', 'group');
      panel.removeAttribute('aria-modal');
      panel.removeAttribute('aria-labelledby');
      panel.setAttribute('aria-label', FILTERS.panel);
      release();
    }
  };
  const setOpen = (open: boolean): void => {
    form.toggleAttribute('data-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    setMode();
  };
  phone.addEventListener('change', setMode);
  /** The toggle is hidden where the options are always shown (the table on a wide screen). */
  const collapsible = (): boolean => toggle.getClientRects().length > 0;
  const refresh = (filters: Filters): void => {
    for (const chip of form.querySelectorAll<HTMLElement>('[data-verdict]')) {
      const v = chip.dataset['verdict'] as VerdictName;
      chip.setAttribute('aria-pressed', String(filters.verdicts.includes(v)));
      chip.querySelector('.fchip-count')!.textContent = String(chipCount(ctx.records, filters, v));
    }
    form.querySelector('[data-bones]')!.setAttribute('aria-checked', String(filters.bones));
    form.querySelector<HTMLElement>('[data-clear-search]')!.hidden = q.value === '';
    const pills = pillsOf(filters, ctx.config).length;
    const badge = form.querySelector<HTMLElement>('[data-filter-badge]')!;
    badge.textContent = String(pills);
    badge.hidden = pills === 0;
    form.querySelector<HTMLElement>('.filter-active')!.hidden = !hasFilters(filters);
    form.querySelector('.pills')!.innerHTML = pillsInner(filters, ctx.config);
    form.querySelector('.filter-count')!.textContent = countText(ctx.records, filters);
  };
  const sync = (filters: Filters): void => {
    const next = { ...getState(), filters };
    setState(next);
    replaceQuery(toQuery(next));
    refresh(filters);
    onChange();
  };
  const pressed = (el: Element, on: boolean): void => el.setAttribute('aria-pressed', String(on));
  const remove = (key: string): void => {
    if (key === 'q') q.value = '';
    else if (key === 'owner' || key === 'era') form.querySelector<HTMLSelectElement>(`[name="${key}"]`)!.value = '';
    else if (key === 'bones') form.querySelector('[data-bones]')!.setAttribute('aria-checked', 'false');
    else form.querySelector(`[data-verdict="${key.slice('verdict:'.length)}"]`)?.setAttribute('aria-pressed', 'false');
  };
  const onInput = (): void => sync(readFilters(form));
  const onClick = (event: Event): void => {
    const target = event.target as Element;
    const chip = target.closest('[data-verdict]');
    const sw = target.closest('[data-bones]');
    const gone = target.closest<HTMLElement>('[data-remove]');
    if (chip !== null) {
      pressed(chip, chip.getAttribute('aria-pressed') !== 'true');
      sync(readFilters(form));
    } else if (sw !== null) {
      sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
      sync(readFilters(form));
    } else if (gone !== null) {
      remove(gone.dataset['remove']!);
      sync(readFilters(form));
      (form.querySelector<HTMLElement>('.pill') ?? q).focus();
    } else if (target.closest('[data-clear-filters]') !== null) {
      for (const key of ['q', 'owner', 'era', 'bones', ...VERDICT_ORDER.map((v) => `verdict:${v}`)]) remove(key);
      sync(readFilters(form));
      q.focus();
    } else if (target.closest('[data-clear-search]') !== null) {
      remove('q');
      sync(readFilters(form));
      q.focus();
    } else if (target.closest('[data-filter-toggle]') !== null) {
      const open = !form.hasAttribute('data-open');
      setOpen(open);
      if (open) form.querySelector<HTMLElement>('#f-owner')?.focus();
    } else if (target.closest('[data-filter-done]') !== null) {
      setOpen(false);
      toggle.focus();
    }
  };
  // Escape closes the options where they can be closed (the churchyard, and the table below the wide layout).
  const onKey = (event: KeyboardEvent): void => {
    if (!form.hasAttribute('data-open') || !collapsible()) return;
    if (event.key === 'Escape') {
      setOpen(false);
      toggle.focus();
    } else if (event.key === 'Tab' && panel.getAttribute('role') === 'dialog') {
      // Tab stays inside the sheet: from the last control to the first, and back.
      const items = [...panel.querySelectorAll<HTMLElement>('select, button, input')].filter((el) => el.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;
      const here = document.activeElement;
      if (event.shiftKey && (here === first || !panel.contains(here))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (here === last || !panel.contains(here))) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  // Enter in the search box must not submit the form.
  const onSubmit = (event: Event): void => event.preventDefault();
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('click', onClick);
  form.addEventListener('keydown', onKey);
  form.addEventListener('submit', onSubmit);
  return () => {
    release();
    phone.removeEventListener('change', setMode);
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    form.removeEventListener('click', onClick);
    form.removeEventListener('keydown', onKey);
    form.removeEventListener('submit', onSubmit);
  };
}
