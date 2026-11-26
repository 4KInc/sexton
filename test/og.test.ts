// Link previews (K2): Open Graph and Twitter tags in index.html, with an absolute image address that the build emits.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { postRuleSummary } from '../src/engine/headline.ts';
const ROOT = process.cwd();
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const meta = (attr: 'property' | 'name', key: string): string | undefined =>
  new RegExp(`<meta ${attr}="${key.replace(/[:]/g, '\\$&')}" content="([^"]*)" />`).exec(html)?.[1];
describe('link-preview tags', () => {
  it('has og:title, og:description, og:image (absolute, 1200 by 630) and twitter:card', () => {
    expect(meta('property', 'og:title')).toBe('Sexton: a register of retired geostationary satellites');
    expect(meta('property', 'og:description')).toMatch(/^36 of the 131 retired payloads/);
    expect(meta('property', 'og:image')).toBe('https://4kinc.github.io/sexton/og-cover.png');
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('name', 'twitter:image')).toBe(meta('property', 'og:image'));
  });
  it('the image is docs/images/devpost-cover.png, 1200 by 630, emitted at the site root by the build', () => {
    const png = readFileSync(join(ROOT, 'docs/images/devpost-cover.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect(readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')).toContain("fileName: 'og-cover.png', source: readFileSync(join(root, 'docs/images/devpost-cover.png'))");
  });
  it('the descriptions give the register\'s numbers, the assumptions and the blind spot, and pass the language check', () => {
    const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
    const s = postRuleSummary(real.records);
    for (const d of [meta('property', 'og:description')!, meta('name', 'twitter:description')!]) {
      expect(d).toContain(`${s.inOrNearZone} of`);
      expect(d).toContain(String(s.postRule));
      expect(d).toContain('under the stated assumptions');
      expect(d).toContain('The register only sees objects still near GEO.');
      expect(findHits(d, 'index.html')).toEqual([]);
    }
  });
});
