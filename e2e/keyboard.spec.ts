// R15.5: the keyboard path through the churchyard, and the filter panel's Escape.
import { expect, test } from '@playwright/test';
import { nextLinkKey, open, PHONE, VIEWPORTS } from './support.ts';

test('the skip link is the first link stop, and it moves focus to the main content', async ({ page, browserName }) => {
  await page.setViewportSize(VIEWPORTS[0]!);
  await open(page, '#/');
  await page.keyboard.press(nextLinkKey(browserName));
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('skip-main');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
});

test('the chart is one Tab stop; arrow keys move between stones; Enter selects and a second Enter opens the ledger', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]!);
  await open(page, '#/');
  expect(await page.locator('a.stone-link[tabindex="0"]').count(), 'one stone is in the Tab order').toBe(1);
  expect(await page.locator('a.stone-link').count()).toBeGreaterThan(100);
  const stop = page.locator('a.stone-link[tabindex="0"]');
  await stop.focus();
  const first = await page.evaluate(() => (document.activeElement as HTMLElement).dataset['norad']);
  await page.keyboard.press('ArrowRight');
  const second = await page.evaluate(() => (document.activeElement as HTMLElement).dataset['norad']);
  expect(second, 'ArrowRight moves to another stone').not.toBe(first);
  expect(await page.locator('a.stone-link[tabindex="0"]').count(), 'still one stone in the Tab order').toBe(1);
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('tabindex'))).toBe('0');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset['norad'])).toBe(first);
  await page.keyboard.press('Enter');
  await expect(page.locator(`a.stone-link[data-norad="${first}"]`)).toHaveClass(/selected/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/sat/${first}$`));
});

test('Escape closes the filter panel, on the phone, and focus goes back to the Filters button', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, '#/');
  await page.locator('[data-filter-toggle]').click();
  await expect(page.locator('#filters[data-open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#filters[data-open]')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-filter-toggle'))).toBe(true);
});

test('Escape closes the filter panel over the chart on a wide screen', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]!);
  await open(page, '#/');
  await page.locator('[data-filter-toggle]').click();
  await expect(page.locator('#filters[data-open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#filters[data-open]')).toHaveCount(0);
});
