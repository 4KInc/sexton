// The churchyard's headline (design 3, step 1). heroStats still backs the census tiles (test/census.test.ts),
// but the churchyard itself no longer draws the three-tile grid: "131" is said once, in the headline, and the
// ESA comparison ("60%") lives on the census only. Every figure must still equal the census page's own figure.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { disposalRate, postRuleSummary } from '../src/engine/headline.ts';
import { COMPARISONS } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { heroHtml, heroStats } from '../src/ui/views/churchyard.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
describe('heroStats (the census tiles)', () => {
  const stats = heroStats(real);
  const s = postRuleSummary(real.records);
  const d = disposalRate(real.records, real.config);
  it('show the post-rule count, the in-or-near-zone count and Sexton against the ESA range', () => {
    expect(stats.map((t) => t.id)).toEqual(['post-rule', 'zone', 'validation']);
    expect(stats[0]!.value).toBe(String(s.postRule));
    expect(stats[1]!.value).toBe(String(s.inOrNearZone));
    expect(stats[1]!.of).toBe(`of ${s.postRule}`);
    expect(stats[2]!.value).toBe(`${Math.round((100 * d.central) / d.n)}%`);
    expect(stats[2]!.label).toBe('Sexton vs ESA 70\u201395%');
  });
  it('the ESA range is shown only when it was checked in its source', () => {
    const unchecked = COMPARISONS.map((c) => (c.id === 'esa' ? { ...c, verified: false, where: null } : c));
    expect(heroStats(real, unchecked)[2]!.label).not.toMatch(/ESA|70/);
  });
});
describe('the churchyard headline', () => {
  const s = postRuleSummary(real.records);
  it('says the zone count and the post-rule count once, as one sentence, linked to the census', () => {
    const html = heroHtml(real);
    expect(html).toContain(`<a class="headline-link" href="#/census">`);
    expect(html).toContain(`<span class="headline-figure">${s.inOrNearZone} of ${s.postRule}</span>`);
    expect(html).toContain('in or near the protected zone');
    expect(html).toContain('below the IADC disposal threshold, under the stated assumptions');
  });
  it('the readings strip is the snapshot alone, with the data age, the assumptions, the blind spot and the voluntary note one click away in Limits', () => {
    const html = heroHtml(real);
    // The one visible line: the strip's first <li>, before the (closed) Limits panel's own markup, which
    // physically sits inside the same <ul> but is not shown until opened.
    const visible = html.slice(html.indexOf('<ul class="fine-list'), html.indexOf('<li class="fine-limits"'));
    expect(visible).toContain('CelesTrak snapshot, 22 Nov 2026');
    expect(visible).not.toContain('C_R·A/m');
    expect(visible).not.toContain('±25 km');
    const limits = html.slice(html.indexOf('<details class="limits">'));
    expect(limits).toContain('C_R·A/m from 0.012 to 0.045');
    expect(limits).toContain('±25 km');
    expect(limits).toContain('only sees objects still near GEO');
    expect(limits).toContain('The IADC guidelines are voluntary');
  });
});
