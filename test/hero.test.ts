// The three tiles above the churchyard. Every figure must equal the census page's own figure.
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
describe('hero tiles', () => {
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
  it('every tile links to the census, and the fine print carries the data age, the assumptions, the blind spot and the voluntary note', () => {
    const html = heroHtml(real);
    expect([...html.matchAll(/class="tile-link" href="([^"]+)"/g)].map((m) => m[1])).toEqual(['#/census', '#/census', '#/census']);
    expect(html).toContain('CelesTrak snapshot, 22 Nov 2026');
    expect(html).toContain('C_R·A/m from 0.012 to 0.045');
    expect(html).toContain('±25 km');
    expect(html).toContain('only sees objects still near GEO');
    expect(html).toContain('The IADC guidelines are voluntary');
  });
});
