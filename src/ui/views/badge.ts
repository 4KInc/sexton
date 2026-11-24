// The verdict badge: the churchyard word large, its plain meaning under it, smaller (design.md, Layout).
// The stone shape beside it is the same shape as on the chart, so the verdict is never shown by colour alone.
import type { Config } from '../../engine/config.ts';
import type { VerdictName } from '../../engine/types.ts';
import { verdictCopy } from '../copy.ts';
import { esc } from '../html.ts';
import { stoneBody } from '../svg/headstone.ts';

/** A small stone drawn in the shape of a verdict. Hidden from screen readers: the words say the same. */
export function glyphSvg(verdict: VerdictName, moss: 0 | 1 | 2 | 3 | 4 = 0): string {
  return `<svg class="glyph" viewBox="-14 -26 28 34" width="28" height="34" aria-hidden="true" focusable="false">${stoneBody({ verdict, moss })}</svg>`;
}
/** The word and its meaning, once. `size` is `lg` on a card or a ledger header, and `sm` in a row. */
export function badgeHtml(verdict: VerdictName, config: Config, size: 'sm' | 'lg' = 'lg'): string {
  const { word, meaning } = verdictCopy(verdict, config);
  return (
    `<div class="badge badge--${size}">${glyphSvg(verdict)}` +
    `<p class="badge-text"><span class="badge-word">${esc(word)}</span><span class="badge-meaning">${esc(meaning)}</span></p></div>`
  );
}
