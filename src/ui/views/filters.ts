// The filter form, shared by the churchyard and the table (design 5.4, R6.8).
// The form's field names are the hash query keys, so a form maps straight to state.ts.
import type { SatRecord } from '../../engine/types.ts';
import { FILTERS, VERDICT_ORDER, verdictCopy } from '../copy.ts';
import type { Config } from '../../engine/config.ts';
import { esc } from '../html.ts';
import { replaceQuery } from '../router.ts';
import { ERA_FILTERS, hasFilters, OWNER_NONE, ownersOf, parseFilters, toQuery } from '../state.ts';
import type { EraFilter, Filters, ViewState } from '../state.ts';

const ERA_LABEL: Record<EraFilter, string> = {
  before: FILTERS.eraBefore,
  after: FILTERS.eraAfter,
  unknown: FILTERS.eraUnknown,
};

const option = (value: string, label: string, selected: boolean): string =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

/** The form as a string. `records` is the whole register, so the owner list does not shrink while filtering. */
export function filtersHtml(records: readonly SatRecord[], filters: Filters, config: Config): string {
  const { codes, hasNone } = ownersOf(records);
  // An owner in the address that the register does not have still shows in the select, so the form matches the address.
  const known = new Set([...codes, ...(hasNone ? [OWNER_NONE] : [])]);
  const extra = filters.owner !== null && !known.has(filters.owner) ? [filters.owner] : [];
  const owners =
    option('', FILTERS.anyOwner, filters.owner === null) +
    [...codes, ...extra].map((c) => option(c, c, filters.owner === c)).join('') +
    (hasNone ? option(OWNER_NONE, FILTERS.noOwner, filters.owner === OWNER_NONE) : '');
  const verdicts = VERDICT_ORDER.map((v) => {
    const id = `f-verdict-${v.replace(' ', '-')}`;
    return `<li><input type="checkbox" id="${id}" name="verdict" value="${esc(v)}"${filters.verdicts.includes(v) ? ' checked' : ''}><label for="${id}">${esc(verdictCopy(v, config).word)}</label></li>`;
  }).join('');
  const eras =
    option('', FILTERS.anyEra, filters.era === null) + ERA_FILTERS.map((e) => option(e, ERA_LABEL[e], filters.era === e)).join('');
  return (
    `<form class="filters" id="filters" aria-labelledby="filters-title" novalidate>` +
    `<h2 id="filters-title">${esc(FILTERS.legend)}</h2><p class="filters-note">${esc(FILTERS.note)}</p>` +
    `<div class="filters-row">` +
    `<div class="field"><label for="f-q">${esc(FILTERS.search)}</label><input type="search" id="f-q" name="q" value="${esc(filters.q)}" autocomplete="off" aria-describedby="f-q-hint"><span id="f-q-hint" class="hint">${esc(FILTERS.searchHint)}</span></div>` +
    `<div class="field"><label for="f-owner">${esc(FILTERS.owner)}</label><select id="f-owner" name="owner">${owners}</select></div>` +
    `<div class="field"><label for="f-era">${esc(FILTERS.era)}</label><select id="f-era" name="era">${eras}</select></div>` +
    `</div>` +
    `<fieldset class="field"><legend>${esc(FILTERS.verdict)}</legend><ul class="check-list">${verdicts}</ul></fieldset>` +
    `<div class="field field--check"><input type="checkbox" id="f-bones" name="bones" value="1"${filters.bones ? ' checked' : ''}><label for="f-bones">${esc(FILTERS.bones)}</label></div>` +
    `<p><button type="button" class="button" data-clear-filters${hasFilters(filters) ? '' : ' disabled'}>${esc(FILTERS.clear)}</button></p>` +
    `</form>`
  );
}

/** Reads the form back into filters, through the same parser the hash uses. */
export function readFilters(form: HTMLFormElement): Filters {
  const pairs: [string, string][] = [];
  for (const [key, value] of new FormData(form)) pairs.push([key, String(value)]);
  return parseFilters(new URLSearchParams(pairs));
}

/**
 * Wires the form. On every change it writes the query into the hash (no redraw of the form, so
 * focus stays) and calls `onChange`. Returns a function that removes the listeners.
 */
export function wireFilters(
  form: HTMLFormElement,
  getState: () => ViewState,
  setState: (next: ViewState) => void,
  onChange: () => void,
): () => void {
  const sync = (filters: Filters): void => {
    const next = { ...getState(), filters };
    setState(next);
    replaceQuery(toQuery(next));
    form.querySelector<HTMLButtonElement>('[data-clear-filters]')!.disabled = !hasFilters(filters);
    onChange();
  };
  const onInput = (): void => sync(readFilters(form));
  const onClick = (event: Event): void => {
    if ((event.target as Element).closest('[data-clear-filters]') === null) return;
    for (const el of form.elements) {
      if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = false;
      if (el instanceof HTMLInputElement && el.type === 'search') el.value = '';
      if (el instanceof HTMLSelectElement) el.value = '';
    }
    sync(readFilters(form));
    form.querySelector<HTMLInputElement>('#f-q')?.focus();
  };
  // Enter in the search box must not submit the form.
  const onSubmit = (event: Event): void => event.preventDefault();
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('click', onClick);
  form.addEventListener('submit', onSubmit);
  return () => {
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    form.removeEventListener('click', onClick);
    form.removeEventListener('submit', onSubmit);
  };
}
