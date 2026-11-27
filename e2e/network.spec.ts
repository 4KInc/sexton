// R15.6 and R4.5: the site loads only its own files and register.json, from its own origin, and calls no other server.
import { expect, test } from '@playwright/test';
import { BASE } from '../playwright.config.ts';
import { open, ROUTES, VIEWPORTS } from './support.ts';

const ORIGIN = new URL(BASE).origin;
const PREFIX = new URL(BASE).pathname;
/** The site's own files: the page, register.json, and what the build puts under assets/. */
const allowed = (url: URL): boolean =>
  url.origin === ORIGIN && url.pathname.startsWith(PREFIX) && (url.pathname === PREFIX || url.pathname === `${PREFIX}index.html` || url.pathname === `${PREFIX}register.json` || /^assets\/[\w.-]+$/.test(url.pathname.slice(PREFIX.length)));

test('every request, on every route and after opening a ledger from the chart, is the site\u2019s own file or register.json', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]!);
  const seen: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) seen.push(r.url());
  });
  for (const route of ROUTES) await open(page, route.hash);
  await open(page, '#/');
  await page.locator('a.stone-link[tabindex="0"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/sat\/\d+$/);
  expect(seen.length).toBeGreaterThan(5);
  expect(seen.some((u) => u.endsWith('/register.json'))).toBe(true);
  const bad = [...new Set(seen)].filter((u) => !allowed(new URL(u)));
  expect(bad, `requests that are not the site's own files:\n${bad.join('\n')}`).toEqual([]);
});
