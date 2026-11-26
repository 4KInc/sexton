// `?cover=1` on the churchyard draws a capture-only view for a screenshot (the Devpost cover): a compact title
// over the bare chart, with the header, the readings strip and the controls hidden. It must never change the
// page when the flag is absent.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coverTitle, isCoverCapture } from '../src/ui/views/churchyard.ts';
import type { UiRegister } from '../src/ui/register.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

describe('isCoverCapture', () => {
  it('is true only for cover=1, never for an absent, empty or different value', () => {
    expect(isCoverCapture(new URLSearchParams('cover=1'))).toBe(true);
    expect(isCoverCapture(new URLSearchParams(''))).toBe(false);
    expect(isCoverCapture(new URLSearchParams('cover=0'))).toBe(false);
    expect(isCoverCapture(new URLSearchParams('cover=true'))).toBe(false);
    expect(isCoverCapture(new URLSearchParams('verdict=buried'))).toBe(false);
  });
});

describe('coverTitle', () => {
  it('reads "Sexton — N of M retired GEO payloads launched since the 2002 FCC rule are still in or near the protected zone", from the same figures as the hero tiles', () => {
    expect(coverTitle(real)).toMatch(/^Sexton — \d[\d,]* of \d[\d,]* retired GEO payloads launched since the 2002 FCC rule are still in or near the protected zone$/);
  });
  it('names the FCC rule year, because the figures count only payloads launched since it', () => {
    expect(coverTitle(real)).toMatch(/2002 FCC rule/);
  });
});

describe('the flag only applies when present', () => {
  it('mountChurchyard reads the flag from the query before choosing the hero or the cover title, and toggles one class from it', () => {
    const src = read('src/ui/views/churchyard.ts');
    expect(src).toMatch(/const cover = isCoverCapture\(query\);/);
    expect(src).toMatch(/root\.classList\.toggle\('cover-capture', cover\)/);
    expect(src).toMatch(/cover \? `<p class="cover-title">.*coverTitle\(reg\).*heroHtml\(reg\)/);
  });
  it('the site header is hidden only on the churchyard route with cover=1, read from route.query, not a global', () => {
    const src = read('src/ui/main.ts');
    expect(src).toMatch(/route\.name === 'churchyard' && route\.query\.get\('cover'\) === '1'/);
  });
  it('every cover-only CSS rule is scoped under .cover-capture, so it cannot affect the page without the flag', () => {
    const css = read('src/ui/styles/churchyard.css');
    const block = css.slice(css.indexOf('.cover-title'), css.indexOf('.cover-capture .guide') + 40);
    for (const selector of ['.toolbar', '.stage-head', '.chart-note', '#stone-tip', '#stone-card', '.guide']) {
      expect(block, selector).toMatch(new RegExp(`\\.cover-capture ${selector.replace(/[.#]/, '\\$&')}`));
    }
  });
  it('has its own inner margin, so the title and the chart cannot touch the captured frame edge', () => {
    const css = read('src/ui/styles/churchyard.css');
    const rule = css.slice(css.indexOf('.cover-capture {'), css.indexOf('}', css.indexOf('.cover-capture {')));
    const padding = rule.match(/padding:\s*([^;]+);/)?.[1]?.trim().split(/\s+/) ?? [];
    expect(padding, rule).toHaveLength(4); // top right bottom left
    expect(Number.parseInt(padding[0]!, 10), 'top').toBeGreaterThanOrEqual(16);
    expect(Number.parseInt(padding[3]!, 10), 'left').toBeGreaterThanOrEqual(16);
  });
});
