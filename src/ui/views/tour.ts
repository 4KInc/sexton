// The guided tour over the churchyard (a "martini glass": a short guided stem, then free exploration).
// The steps and the step arithmetic are pure, so tests can read them. The only figures are ones already in the
// repository: the zone width and the counts from the register, and the FCC order's own figures (DA 23-888).
import type { Config } from '../../engine/config.ts';
import { postRuleSummary } from '../../engine/headline.ts';
import type { SatRecord } from '../../engine/types.ts';
import { assumptionsLine, CHURCHYARD_INTRO, TOUR } from '../copy.ts';
import { formatP } from '../format.ts';

export interface TourStep {
  /** The sentence that is announced and shown. */
  text: string;
  /** One more line, small. */
  sub: string;
  /** The stone the step selects, if any. */
  select: number | null;
}
/** EchoStar 7 is the case the FCC fined (DA 23-888). */
export const ECHOSTAR_7 = 27378;
export function tourSteps(reg: { records: readonly SatRecord[]; config: Config }): TourStep[] {
  const s = postRuleSummary(reg.records);
  const steps: TourStep[] = [
    { text: TOUR.steps.zone(reg.config.protectedZoneKm), sub: TOUR.zoneSub, select: null },
    { text: TOUR.steps.rule, sub: `${CHURCHYARD_INTRO.voluntary.split('. ')[0]}. ${TOUR.ruleSub}`, select: null },
    { text: TOUR.steps.story(s.inOrNearZone, s.postRule), sub: assumptionsLine(reg.config), select: null },
  ];
  const echo = reg.records.find((r) => r.norad === ECHOSTAR_7);
  if (echo !== undefined && echo.verdict.kind === 'verdict') {
    const p = formatP(echo.pKm, echo.orbitSource.kind, [reg.config.protectedZoneKm, reg.config.thresholdLowKm, reg.config.thresholdHighKm]);
    steps.push({ text: TOUR.steps.echostar, sub: TOUR.echoSub(p), select: ECHOSTAR_7 });
  }
  return steps;
}
/** The step after `i` in direction `dir`, or null when the tour ends (after the last step) or cannot go back. */
export const moveStep = (i: number, dir: 1 | -1, count: number): number | null => {
  const next = i + dir;
  return next < 0 || next >= count ? null : next;
};
export const TOUR_KEY = 'sexton.tour';
/** True when the visitor chose "Explore freely" earlier. Storage may be blocked, so every access is guarded. */
export function tourSkipped(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(TOUR_KEY) === 'skipped';
  } catch {
    return false;
  }
}
export function rememberSkip(storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(TOUR_KEY, 'skipped');
  } catch {
    // Private mode or blocked storage: the tour just shows again next time.
  }
}
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
/** The tour's bar for step `i` of `count`, or the single button that starts it. */
export function tourHtml(i: number | null, steps: readonly TourStep[]): string {
  if (i === null) return `<div class="tour tour--free"><button type="button" class="button button--quiet" data-tour-start>${TOUR.start}</button></div>`;
  const step = steps[i]!;
  const last = i === steps.length - 1;
  return (
    `<div class="tour" role="group" aria-label="${TOUR.label}">` +
    `<p class="tour-count mono" aria-hidden="true">${i + 1} / ${steps.length}</p>` +
    `<div class="tour-main"><div class="tour-text" role="status" aria-live="polite"><p class="tour-line"><span class="visually-hidden">${TOUR.stepOf(i + 1, steps.length)} </span>${esc(step.text)}</p><p class="tour-sub">${esc(step.sub)}</p></div>` +
    `<button type="button" class="link-button" data-tour="skip">${TOUR.skip}</button></div>` +
    `<div class="tour-actions"><button type="button" class="button" data-tour="back"${i === 0 ? ' disabled' : ''}>${TOUR.back}</button>` +
    `<button type="button" class="button button--primary" data-tour="${last ? 'done' : 'next'}">${last ? TOUR.done : TOUR.next}</button></div></div>`
  );
}
function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
