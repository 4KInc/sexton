// R15.5: with prefers-reduced-motion: reduce, nothing is animating, on every route and with the opening not yet played.
import { expect, test } from '@playwright/test';
import { open, ROUTES, VIEWPORTS } from './support.ts';

test.use({ reducedMotion: 'reduce' });

for (const route of ROUTES) {
  test(`reduced motion: no animation is running on ${route.name}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[0]!);
    await open(page, route.hash, { keepIntro: true });
    await page.waitForTimeout(500);
    const running = await page.evaluate(() => document.getAnimations().map((a) => `${(a.effect as KeyframeEffect | null)?.target?.tagName ?? '?'}.${(a.effect as KeyframeEffect | null)?.target?.className ?? ''} ${a.playState}`));
    expect(running, `animations still on ${route.name}`).toEqual([]);
  });
}
