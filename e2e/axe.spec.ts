// R15.2 and R15.3: every route at three sizes, then axe (WCAG 2.2 A and AA), failing on any violation.
import { expect, test } from '@playwright/test';
import { axeProblems, open, PHONE, ROUTES, VIEWPORTS } from './support.ts';

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`axe: ${route.name} at ${viewport.width}x${viewport.height}`, async ({ page, browserName }) => {
      await page.setViewportSize(viewport);
      await open(page, route.hash);
      const problems = await axeProblems(page, { route: route.name, viewport, browser: browserName });
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
}

test('axe: churchyard with a stone selected and its card showing', async ({ page, browserName }) => {
  const viewport = VIEWPORTS[0]!;
  await page.setViewportSize(viewport);
  await open(page, '#/');
  await page.locator('a.stone-link[data-norad="27378"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.card, [data-card]', { timeout: 10_000 }).catch(() => undefined);
  const problems = await axeProblems(page, { route: 'churchyard', state: 'stone selected', viewport, browser: browserName });
  expect(problems, problems.join('\n')).toEqual([]);
});

for (const [name, hash] of [['churchyard', '#/'], ['table', '#/table']] as const) {
  test(`axe: ${name} with the filter panel open at the phone size`, async ({ page, browserName }) => {
    await page.setViewportSize(PHONE);
    await open(page, hash);
    await page.locator('[data-filter-toggle]').click();
    await page.waitForSelector('#filters[data-open]');
    const problems = await axeProblems(page, { route: name, state: 'filter panel open', viewport: PHONE, browser: browserName });
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
