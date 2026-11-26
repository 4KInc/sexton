// The site's short error and empty-state messages (redesign 5). Each one says what happened, about the site only,
// and gives one clear next action as a link or a button. Pure: no DOM, so each message and its action is tested.
import { FILTERS, SITE } from './copy.ts';
import { esc } from './html.ts';
const box = (role: string, text: string, actions: string): string =>
  `<div class="message"${role === '' ? '' : ` role="${role}"`}><p class="message-text">${esc(text)}</p><p class="message-actions">${actions}</p></div>`;
/** An address that is no page of the site. */
export const notFoundHtml = (): string => box('', SITE.notFound, `<a href="#/">${esc(SITE.backToChurchyard)}</a>`);
/** register.json did not load. The button reloads the page. */
export const loadErrorHtml = (): string =>
  box('alert', SITE.loadError, `<button type="button" class="button button--primary" data-retry>${esc(SITE.retry)}</button>`);
/** A lazily loaded page whose code did not load. The link reloads the page at the same address. */
export const viewLoadErrorHtml = (hash: string): string =>
  box('alert', SITE.viewLoadError, `<a href="${esc(hash === '' ? '#/' : hash)}" data-retry>${esc(SITE.retry)}</a>`);
/** The filters match nothing. The button clears them (wired by the view to the toolbar's "Clear all"). */
export const emptyFiltersHtml = (id: string): string =>
  `<div class="message message--empty" id="${esc(id)}" hidden><p class="message-text">${esc(FILTERS.none)}</p><p class="message-actions"><button type="button" class="button button--primary" data-empty-clear>${esc(FILTERS.clearAll)}</button></p></div>`;
/** A ledger address with a NORAD id the register does not hold. */
export const noStoneHtml = (norad: number): string =>
  box('', SITE.noStone(norad), `<a href="#/table">${esc(SITE.toTable)}</a> <a href="#/">${esc(SITE.backToChurchyard)}</a>`);
