// Shared by the end-to-end specs: the routes and screen sizes to visit, how to open a page and wait for it, and the axe run.
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

export interface Viewport {
  width: number;
  height: number;
}
/** The three sizes of R15.2. */
export const VIEWPORTS: readonly Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];
export const PHONE = VIEWPORTS[2]!;
export interface Route {
  name: string;
  hash: string;
}
/**
 * Every route of the site: the churchyard, the table, two ledgers (one with a sourced operator), the census, the method page,
 * and the parish register (the list, one operator and one SATCAT owner code).
 */
export const ROUTES: readonly Route[] = [
  { name: 'churchyard', hash: '#/' },
  { name: 'table', hash: '#/table' },
  { name: 'ledger', hash: '#/sat/27378' },
  { name: 'ledger with operator', hash: '#/sat/41308' },
  { name: 'census', hash: '#/census' },
  { name: 'method', hash: '#/method' },
  { name: 'parish list', hash: '#/parish' },
  { name: 'parish operator', hash: `#/parish/op/${encodeURIComponent('Intelsat')}` },
  { name: 'parish owner', hash: `#/parish/owner/${encodeURIComponent('JPN')}` },
];
/** The tags of R15.3: WCAG 2.2 A and AA, with the earlier levels they include. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The sessionStorage key that marks the churchyard's opening as played (src/ui/intro.ts), so the page is still when it is scanned. */
const INTRO_KEY = 'sexton.intro';

/** Opens a hash route and waits until its view has drawn. The opening is marked as played, so a stone does not light up under the scan. */
export async function open(page: Page, hash: string, opts: { keepIntro?: boolean } = {}): Promise<void> {
  if (opts.keepIntro !== true) await page.addInitScript((key) => window.sessionStorage.setItem(key, 'played'), INTRO_KEY);
  await page.goto(hash === '#/' ? './' : `./${hash}`);
  await settle(page, hash);
}

/** Waits for the view to hold its content (not the "Loading" line), and for the wide table's grid when the table is open. */
export async function settle(page: Page, hash: string): Promise<void> {
  await page.waitForFunction(() => {
    const view = document.getElementById('view');
    return view !== null && view.children.length > 0 && !/^\s*Loading/.test(view.textContent ?? '');
  });
  if (hash.startsWith('#/table') && (page.viewportSize()?.width ?? 0) > 600) await page.waitForSelector('.ag-row', { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Waits until no animation that ends is still running. A card's button fades its colours in, and axe reads the colour it sees at that
 * moment (WebKit showed a half-faded button). Animations that never end (the lanterns' slow flicker) are left alone.
 */
export async function finishTransitions(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== 'running'));
}

/**
 * The key that moves to the next link. WebKit on macOS (as in Safari) leaves links out of the Tab order unless Option is held,
 * so there the test uses Alt+Tab. Everywhere else it is Tab.
 */
export const nextLinkKey = (browserName: string): string => (browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');

export interface Where {
  route: string;
  viewport: Viewport;
  browser: string;
  state?: string;
}
export const describeWhere = (w: Where, info?: TestInfo): string =>
  `${w.route}${w.state === undefined ? '' : ` (${w.state})`}, ${info?.project.name ?? w.browser}, ${w.viewport.width}x${w.viewport.height}`;

/** Runs axe over the page and returns one line per violating element, naming the route, browser, viewport, rule id and element. */
export async function axeProblems(page: Page, where: Where): Promise<string[]> {
  await finishTransitions(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.flatMap((v) => v.nodes.map((n) => `${describeWhere(where)} | ${v.id} (${v.impact ?? 'n/a'}) | ${n.target.join(' ')} | ${v.help}`));
}
