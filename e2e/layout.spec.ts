// R15.4: no sideways scroll at 390 px, and the chart or the key numbers inside the first screen.
import { expect, test } from '@playwright/test';
import { open, PHONE, ROUTES, VIEWPORTS } from './support.ts';

/** The main picture or the key numbers of each route, which must start inside the first screen (design.md steering, Layout). */
const FIRST_SCREEN: Record<string, string> = {
  churchyard: 'svg.chart',
  table: '.ag-root, table.register-table',
  ledger: '.ledger-head .readings',
  'ledger with operator': '.ledger-head .readings',
  census: '.stats',
  method: '.method h2, #view h2',
  'parish list': '.parish-list',
  'parish operator': '.parish-table',
  'parish owner': '.parish-table',
};

for (const route of ROUTES) {
  test(`no sideways scroll at 390 px: ${route.name}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page, route.hash);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(scrollWidth, `${route.name}: the page is ${scrollWidth} px wide on a ${innerWidth} px screen`).toBeLessThanOrEqual(innerWidth);
  });
}

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`the first screen shows the picture or the key numbers: ${route.name} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page, route.hash);
      const selector = FIRST_SCREEN[route.name]!;
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${route.name}: nothing matches ${selector}`).not.toBeNull();
      // At least 80 px of the element is above the fold.
      expect(box!.y, `${route.name}: ${selector} starts ${Math.round(box!.y)} px down a ${viewport.height} px screen`).toBeLessThan(viewport.height - 80);
    });
  }
}
