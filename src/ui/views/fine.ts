// The one line of fine print under a view's key numbers, with a "Limits" panel for the full sentences.
// The churchyard and the table both use it, so the same assumptions, data age and notes sit under every total.
import type { Config } from '../../engine/config.ts';
import { HERO, snapshotLabel } from '../copy.ts';
import { esc } from '../html.ts';

/** `limits` are the full sentences, each one paragraph. */
export function fineHtml(snapshotSet: string, config: Config, limits: readonly string[], drawn?: string): string {
  const parts = HERO.fine(snapshotLabel(snapshotSet), config).map((t) => `<li>${esc(t)}</li>`);
  // The churchyard says how many stones it draws, in the same line. The count follows the filters.
  if (drawn !== undefined) parts.splice(1, 0, `<li id="fine-drawn">${esc(drawn)}</li>`);
  const items = parts.join('');
  return (
    `<div class="hero-fine"><ul class="fine-list">${items}` +
    `<li class="fine-limits"><details class="limits"><summary>${esc(HERO.limits)}</summary><div class="limits-body">${limits.map((t) => `<p>${esc(t)}</p>`).join('')}</div></details></li></ul></div>`
  );
}
