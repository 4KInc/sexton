// The churchyard's opening (C1) and ?demo=1 (K1): the 36 story lanterns light in launch order over about 2 s,
// any key, click or scroll skips to the end, reduced motion shows the end at once, and it plays once per session.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { postRuleSummary } from '../src/engine/headline.ts';
import { INTRO_KEY, INTRO_MS, introPlayed, lanternOrder, lightTimes, litAt, rememberIntro, runIntro, shouldAnimate } from '../src/ui/intro.ts';
import type { IntroClock } from '../src/ui/intro.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { chartSvg } from '../src/ui/views/churchyard.ts';
const ROOT = process.cwd();
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
/** A clock that moves only when told, with frames run by hand. */
function fakeClock(): IntroClock & { advance: (ms: number) => void; pending: () => number } {
  let t = 0;
  let next = 1;
  const queue = new Map<number, () => void>();
  return {
    now: () => t,
    frame: (cb) => {
      const id = next++;
      queue.set(id, cb);
      return id;
    },
    cancel: (id) => void queue.delete(id),
    advance: (ms) => {
      t += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const cb of due) cb();
    },
    pending: () => queue.size,
  };
}
describe('the order', () => {
  const order = lanternOrder(real.records);
  it('is the 36 story stones, the same set the chart lights', () => {
    expect(order).toHaveLength(postRuleSummary(real.records).inOrNearZone);
    const svg = chartSvg(real, false);
    const story = [...svg.matchAll(/data-norad="(\d+)"[^>]*><g class="stone-pos[^"]*stone-pos--story/g)].map((m) => Number(m[1]));
    expect([...order].sort((a, b) => a - b)).toEqual([...story].sort((a, b) => a - b));
  });
  it('runs by launch date, earliest first, ties by NORAD id', () => {
    const by = new Map(real.records.map((r) => [r.norad, r]));
    for (let i = 1; i < order.length; i++) {
      const a = by.get(order[i - 1]!)!;
      const b = by.get(order[i]!)!;
      expect(a.launchDate! <= b.launchDate!, `${a.launchDate} ${b.launchDate}`).toBe(true);
      if (a.launchDate === b.launchDate) expect(a.norad).toBeLessThan(b.norad);
    }
    expect(by.get(order[0]!)!.launchDate! >= '2002-03-18').toBe(true);
  });
});
describe('the timing', () => {
  it('lights evenly over about 2 s, the last at the end', () => {
    const t = lightTimes(36);
    expect(t).toHaveLength(36);
    expect(t[35]).toBe(INTRO_MS);
    expect(INTRO_MS).toBe(2000);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
    expect(litAt(0, t)).toBe(0);
    expect(litAt(1000, t)).toBe(18);
    expect(litAt(2000, t)).toBe(36);
  });
  it('lights one by one to 36, then ends once', () => {
    const clock = fakeClock();
    const seen: number[] = [];
    let done = 0;
    runIntro(36, clock, (k) => seen.push(k), () => void done++);
    for (let i = 0; i < 200 && clock.pending() > 0; i++) clock.advance(16);
    expect(seen.at(-1)).toBe(36);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    expect(done).toBe(1);
    expect(clock.pending()).toBe(0);
  });
  it('property: a skip at any moment goes straight to all lit and ends exactly once', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 2500 }), (n, at) => {
        const clock = fakeClock();
        const seen: number[] = [];
        let done = 0;
        const h = runIntro(n, clock, (k) => seen.push(k), () => void done++);
        for (let t = 0; t < at && clock.pending() > 0; t += 16) clock.advance(16);
        h.skip();
        h.skip();
        clock.advance(16);
        expect(done).toBe(1);
        if (n > 0) expect(seen.at(-1)).toBe(n);
        expect(clock.pending()).toBe(0);
      }),
    );
  });
  it('stop ends it without the end state (the view is going away)', () => {
    const clock = fakeClock();
    let done = 0;
    const h = runIntro(36, clock, () => {}, () => void done++);
    clock.advance(100);
    h.stop();
    clock.advance(5000);
    expect(done).toBe(0);
  });
});
describe('when it plays', () => {
  it('reduced motion never animates; demo ignores the session flag; otherwise once per session', () => {
    expect(shouldAnimate({ reduced: true, demo: false, played: false })).toBe(false);
    expect(shouldAnimate({ reduced: true, demo: true, played: false })).toBe(false);
    expect(shouldAnimate({ reduced: false, demo: false, played: false })).toBe(true);
    expect(shouldAnimate({ reduced: false, demo: false, played: true })).toBe(false);
    expect(shouldAnimate({ reduced: false, demo: true, played: true })).toBe(true);
  });
  it('remembers "played" in sessionStorage, and never throws when storage is blocked', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(introPlayed(storage)).toBe(false);
    rememberIntro(storage);
    expect(store.get(INTRO_KEY)).toBe('played');
    expect(introPlayed(storage)).toBe(true);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(introPlayed(blocked)).toBe(false);
    expect(() => rememberIntro(blocked)).not.toThrow();
    expect(introPlayed(null)).toBe(false);
  });
});
describe('the churchyard wiring', () => {
  const src = read('src/ui/views/churchyard.ts');
  const css = read('src/ui/styles/churchyard.css');
  it('skips on any key, click or scroll', () => {
    expect(src).toContain("const skipEvents = ['keydown', 'pointerdown', 'wheel', 'touchstart', 'scroll'] as const;");
    expect(src).toMatch(/window\.addEventListener\(e, onSkip, \{ capture: true, passive: true \}\)/);
  });
  it('reads reduced motion and the session flag, and uses sessionStorage inside a try', () => {
    expect(src).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(src).toMatch(/function sessionStore\(\): Storage \| null \{\s*try \{\s*return window\.sessionStorage;/);
  });
  it('screen readers get only the final headline: the counting figure is hidden, a hidden copy holds the final text', () => {
    expect(src).toContain("figure.setAttribute('aria-hidden', 'true');");
    expect(src).toContain("spoken.className = 'visually-hidden';");
    expect(src).toContain('spoken.textContent = final;');
    expect(src).not.toMatch(/aria-live[^\n]*intro|intro[^\n]*aria-live/);
  });
  it('an unlit lantern draws like a quiet stone; any fade or held flicker sits inside the motion query', () => {
    expect(css).toMatch(/\.plot\[data-intro\] \.stone-pos--story:not\(\.is-lit\) \{\s*--mark: var\(--bone-muted\);\s*opacity: 0\.6;/);
    const motion = /@media screen and \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(css)![1]!;
    expect(motion).toContain('.plot[data-intro] .stone-pos--story:not(.is-lit) {\n    animation: none;');
  });
  it('?demo=1 plays every time, hides "Walk with the sexton", and selects EchoStar 7 at the end', () => {
    expect(src).toContain("const demo = query.get('demo') === '1' && !cover;");
    expect(src).toContain('let tourStep: number | null = demo || steps.length === 0 || tourSkipped() ? null : 0;');
    expect(src).toContain("tourStartHost.innerHTML = tourStep === null && !demo ? tourHtml(null, steps) : '';");
    expect(src).toContain('if (demo && byId.has(ECHOSTAR_7)) select(ECHOSTAR_7);');
  });
});
