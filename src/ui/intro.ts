// The churchyard's opening (C1): on the first visit in a session the 36 story lanterns light one by one, in launch
// order, over about 2 s, while the headline counts up to 36. Any key, click or scroll skips to the end. Under
// prefers-reduced-motion the end state shows at once. `?demo=1` (K1) plays it every time.
// Pure: no DOM. The clock and the frame callback are passed in, so tests can step through it.
import type { SatRecord } from '../engine/types.ts';
/** About 2 s from the first lantern to the last. */
export const INTRO_MS = 2000;
export const INTRO_KEY = 'sexton.intro';
/** A story stone: launched on or after the rule date, unquiet or in a shallow grave (the chart's lantern stones). */
const isStory = (r: SatRecord): boolean =>
  r.verdict.kind === 'verdict' && r.verdict.era === null && (r.verdict.verdict === 'unquiet' || r.verdict.verdict === 'shallow grave');
/** The story stones' NORAD ids in launch order (launch date, then NORAD id). A missing date goes last. */
export function lanternOrder(records: readonly SatRecord[]): number[] {
  return records
    .filter(isStory)
    .sort((a, b) => (a.launchDate ?? '9999').localeCompare(b.launchDate ?? '9999') || a.norad - b.norad)
    .map((r) => r.norad);
}
/** When each lantern lights, in ms from the start: evenly spaced, the last at `total`. */
export const lightTimes = (n: number, total = INTRO_MS): number[] => Array.from({ length: n }, (_, i) => Math.round(((i + 1) * total) / n));
/** How many lanterns are lit at `t` ms. The headline's count is this number. */
export const litAt = (t: number, times: readonly number[]): number => times.filter((x) => x <= t).length;
/** Whether to animate. Reduced motion never animates. `demo` ignores the session flag. */
export const shouldAnimate = (o: { reduced: boolean; demo: boolean; played: boolean }): boolean => !o.reduced && (o.demo || !o.played);
/** True when the opening already played in this session. Storage may be blocked, so every access is guarded. */
export function introPlayed(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem(INTRO_KEY) === 'played';
  } catch {
    return false;
  }
}
export function rememberIntro(storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(INTRO_KEY, 'played');
  } catch {
    // Private mode or blocked storage: the opening plays again next time.
  }
}
export interface IntroClock {
  now: () => number;
  frame: (cb: () => void) => number;
  cancel: (id: number) => void;
}
export interface IntroHandle {
  /** Jumps to the end state. Calling it again, or after the end, does nothing. */
  skip: () => void;
  /** Stops without reaching the end (the view is going away). */
  stop: () => void;
}
/**
 * Runs the opening. `light(k)` is called whenever the lit count grows (k from 1 to n), and `done()` once, at the end
 * or on a skip, after `light(n)`. With no lanterns it ends at once.
 */
export function runIntro(n: number, clock: IntroClock, light: (k: number) => void, done: () => void, total = INTRO_MS): IntroHandle {
  const times = lightTimes(n, total);
  const start = clock.now();
  let shown = 0;
  let id: number | null = null;
  let over = false;
  const finish = (): void => {
    if (over) return;
    over = true;
    if (id !== null) clock.cancel(id);
    if (shown < n) light(n);
    shown = n;
    done();
  };
  const tick = (): void => {
    const k = litAt(clock.now() - start, times);
    if (k > shown) {
      shown = k;
      light(k);
    }
    if (shown >= n) finish();
    else id = clock.frame(tick);
  };
  if (n === 0) finish();
  else id = clock.frame(tick);
  return {
    skip: finish,
    stop: () => {
      over = true;
      if (id !== null) clock.cancel(id);
    },
  };
}
