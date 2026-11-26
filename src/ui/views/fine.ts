// The one line of fine print under a view's key numbers, with a "Limits" panel for the full sentences.
// The churchyard and the table both use it, so the same assumptions, data age and notes sit under every total.
import type { Config } from '../../engine/config.ts';
import { HERO, METHOD_SECTIONS, NOTES, snapshotLabel } from '../copy.ts';
import { esc } from '../html.ts';

/**
 * `limits` are the full sentences, each one paragraph, always inside "Limits" so every disclosure stays one
 * click away even when the visible line is short. The visible line is either the full strip, with two row
 * groups (the data and the scope, joined by a zero-size break item so a wrapped row never starts a line with
 * its separator dot), or (`short: true`, the churchyard) a single reading, the snapshot alone.
 */
export function fineHtml(snapshotSet: string, config: Config, limits: readonly string[], drawn?: string, short = false): string {
  const snapshot = snapshotLabel(snapshotSet);
  const limitsItem =
    `<li class="fine-limits"><details class="limits"><summary>${esc(HERO.limits)}</summary><div class="limits-body">${limits.map((t) => `<p>${esc(t)}</p>`).join('')}<p class="chart-note-mono">${esc(NOTES.method)} <a href="#/method?s=${METHOD_SECTIONS.rules}" aria-label="${esc(NOTES.link(METHOD_SECTIONS.rules))}">\u00A7</a> \u00B7 <a href="#/method?s=${METHOD_SECTIONS.blind}" aria-label="${esc(NOTES.link(METHOD_SECTIONS.blind))}">\u00A7</a></p></div></details></li>`;
  if (short) {
    return (
      `<div class="hero-fine"><ul class="fine-list fine-list--short"><li>${esc(snapshot)}</li>` + limitsItem + '</ul></div>'
    );
  }
  const parts = HERO.fine(snapshot, config).map((t) => `<li>${esc(t)}</li>`);
  // The churchyard says how many stones it draws, in the same line. The count follows the filters.
  if (drawn !== undefined) parts.splice(1, 0, `<li id="fine-drawn">${esc(drawn)}</li>`);
  // Row 1 is the data (the snapshot, the count if the churchyard passed one, C_R·A/m, ±km). Row 2 is the scope
  // (the blind spot, the two voluntary/FCC rules, then "Limits"): the second half of `HERO.fine`'s own six
  // items, after whatever the snapshot and the optional count took. A zero-size break item forces the new line
  // (an item that claims the width itself would stretch to fill it).
  const rowSplit = (drawn === undefined ? 2 : 3) + 1; // snapshot (+ drawn) + C_R·A/m + ±km
  const row1 = parts.slice(0, rowSplit);
  const row2 = parts.slice(rowSplit);
  const items = [...row1, '<li class="fine-break" aria-hidden="true"></li>', ...row2].join('');
  return (
    `<div class="hero-fine"><ul class="fine-list">${items}` + limitsItem + '</ul></div>'
  );
}
