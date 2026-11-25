// The readings strip is two explicit rows, not a wrap: row 1 is the data (the snapshot, the count, the
// assumptions), row 2 is the scope (the blind spot, the two rules, "Limits"). Every pinned substring from
// test/selection.test.ts must still be in the strip, and no visible item carries a leading separator.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { heroHtml } from '../src/ui/views/churchyard.ts';
import type { UiRegister } from '../src/ui/register.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const strip = (html: string): string => html.slice(html.indexOf('<ul class="fine-list">'), html.indexOf('</ul>', html.indexOf('<ul class="fine-list">')) + 5);

describe('the readings strip', () => {
  const html = strip(heroHtml(real));

  it('has a zero-size break item between the data row and the scope row, and nothing else forces a line', () => {
    expect(html).toContain('<li class="fine-break" aria-hidden="true"></li>');
    expect(html.match(/class="fine-break"/g)).toHaveLength(1);
  });

  it('keeps every pinned substring the fine-print test checks, in document order', () => {
    const required = [
      'CelesTrak snapshot, 22 Nov 2026',
      'C_R·A/m 0.012–0.045 m²/kg',
      '±25 km',
      'The register only sees objects still near GEO',
      'IADC guidelines are voluntary',
      'FCC rule covers FCC-authorized launches from 18 Mar 2002',
    ];
    let cursor = 0;
    for (const text of required) {
      const at = html.indexOf(text, cursor);
      expect(at, text).toBeGreaterThanOrEqual(0);
      cursor = at + text.length;
    }
  });

  it('puts the data items (the snapshot, the count, C_R·A/m, ±km) before the break, and the scope items after', () => {
    const breakAt = html.indexOf('fine-break');
    for (const text of ['CelesTrak snapshot', 'C_R·A/m', '±25 km']) expect(html.indexOf(text)).toBeLessThan(breakAt);
    for (const text of ['The register only sees', 'IADC guidelines', 'FCC rule covers', 'Limits']) expect(html.indexOf(text)).toBeGreaterThan(breakAt);
  });

  it('the separator is a dot after an item (not before the next one), so a wrapped line can only end with it, never start with it', () => {
    const css = read('src/ui/styles/churchyard.css');
    expect(css).toMatch(/\.fine-list li:not\(:last-child\):not\(\.fine-break\):not\(:has\(\+ \.fine-break\)\)::after/);
    expect(css).not.toMatch(/\.fine-list li::before/);
  });
});
