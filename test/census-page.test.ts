// The census page (Task 13, design 5.7): comparison figures, numbers equal register.census, language.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { findHits } from '../scripts/check-language.ts';
import { COMPARISONS } from '../src/ui/copy.ts';
import type { Comparison } from '../src/ui/copy.ts';
import { formatCount, formatShare } from '../src/ui/format.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { censusHtml, comparisonHtml, gpzStatusCount } from '../src/ui/views/census.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const real = JSON.parse(read('data/register.json')) as UiRegister;
const fixture = JSON.parse(read('test/fixtures/register.json')) as UiRegister;
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');

describe('comparison figures', () => {
  it('an unverified figure is not rendered, only the pending line', () => {
    const html = comparisonHtml(COMPARISONS.map((c) => ({ ...c, verified: false })));
    for (const c of COMPARISONS) {
      expect(html).not.toContain(c.figure);
      expect(html).toContain(`Comparison with ${c.source} pending a checked source.`);
      expect(html).not.toContain(c.url);
    }
    expect(html).not.toMatch(/70\D{1,3}95|73\s?%/);
  });
  it('the whole page, as shipped, shows the checked ESA range and not the Roberts figure', () => {
    const text = textOf(censusHtml(real));
    expect(text).toMatch(/70\D{1,3}95\s?%/);
    expect(text).toContain('Executive summary, page 7 of 146');
    expect(text).not.toMatch(/\b73\s?%/);
    expect(text).toContain('pending a checked source');
  });
  it('a verified figure is rendered with its source and link, and only that one', () => {
    const list: Comparison[] = COMPARISONS.map((c, i) => (i === 0 ? { ...c, verified: true, where: 'page 12' } : { ...c }));
    const html = comparisonHtml(list);
    expect(html).toContain(list[0]!.figure);
    expect(html).toContain(`href="${list[0]!.url}"`);
    expect(html).not.toContain(list[1]!.figure);
    expect(html).toContain('pending a checked source');
  });
  it('a figure marked verified without a recorded place is still not rendered', () => {
    const html = comparisonHtml(COMPARISONS.map((c) => ({ ...c, verified: true, where: null })));
    for (const c of COMPARISONS) expect(html).not.toContain(c.figure);
  });
  it('the list agrees with design.md section 6', () => {
    const design = read('.kiro/specs/sexton-core/design.md');
    const section = design.slice(design.indexOf('## 6. Sources'), design.indexOf('## 7. Testing'));
    for (const c of COMPARISONS) {
      const row = section.split('\n').find((l) => l.startsWith('| ') && l.includes(c.id === 'esa' ? 'ESA: 70' : 'Roberts: 73%'));
      expect(row, c.id).toBeDefined();
      const designVerified = /\|\s*verified\s*\|/.test(row!);
      expect(c.verified, `${c.id} in copy.ts against design.md section 6`).toBe(designVerified);
      if (c.verified) expect(c.where, c.id).not.toBeNull();
    }
  });
});

describe('census numbers equal register.census', () => {
  const lookup = (obj: unknown, path: string[]): unknown => path.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj);
  const expectedPaths = (reg: UiRegister): string[][] => {
    const c = reg.census;
    const out: string[][] = [['population', 'total'], ['population', 'outsidePopulation'], ['population', 'rejectedRows'], ['population', 'noOrbitData'], ['retired', 'total']];
    for (const k of Object.keys(c.byType)) if (k !== 'unknown' || c.byType[k as keyof typeof c.byType] > 0) out.push(['byType', k]);
    for (const k of Object.keys(c.retired.byVerdict)) out.push(['retired', 'byVerdict', k]);
    for (const k of Object.keys(c.retired.era)) out.push(['retired', 'era', k]);
    for (const k of Object.keys(c.retired.orbitSource)) out.push(['retired', 'orbitSource', k]);
    for (const [owner, counts] of Object.entries(c.retired.byOwner)) for (const v of Object.keys(counts)) out.push(['retired', 'byOwner', owner, v]);
    for (const k of Object.keys(c.disagreements.pairs)) out.push(['disagreements', 'pairs', k]);
    return out;
  };
  for (const [name, reg] of [['real register', real], ['fixture register', fixture]] as const) {
    it(`${name}: every shown number matches, and every census number is shown`, () => {
      const html = censusHtml(reg);
      const unesc = (t: string): string => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const found = [...html.matchAll(/data-census="([^"]*)"[^>]*>([^<]*)</g)].map((m) => ({ path: JSON.parse(unesc(m[1]!)) as string[], text: unesc(m[2]!) }));
      for (const f of found) {
        const value = lookup(reg.census, f.path);
        expect(typeof value, f.path.join('/')).toBe('number');
        expect(f.text, f.path.join('/')).toBe(formatCount(value as number));
      }
      const key = (p: string[]): string => JSON.stringify(p);
      expect(found.map((f) => key(f.path)).sort()).toEqual(expectedPaths(reg).map(key).sort());
    });
    it(`${name}: the shares use the census counts and their denominator`, () => {
      const c = reg.census;
      const text = textOf(censusHtml(reg));
      expect(text).toContain(formatShare(c.retired.orbitSource.SATCAT, c.retired.total));
      expect(text).toContain(formatShare(c.retired.borderline.yes, c.retired.total));
      expect(text).toContain(formatShare(gpzStatusCount(reg.records), c.retired.total));
      for (const v of Object.keys(c.retired.byVerdict)) {
        expect(text).toContain(formatShare(c.retired.byVerdict[v as keyof typeof c.retired.byVerdict], c.retired.total));
      }
    });
    it(`${name}: no percentage appears without "n of N" before it`, () => {
      // Percentages that a published source gives (data-published) are not Sexton's shares and have no denominator.
      const text = textOf(censusHtml(reg).replace(/<(\w+)[^>]*data-published[^>]*>[\s\S]*?<\/\1>/g, ''));
      const all = text.match(/%/g) ?? [];
      const withDenominator = text.match(/[\d,]+ of [\d,]+ \([<>]?\d+(\.\d)?%\)/g) ?? [];
      expect(withDenominator.length).toBe(all.length);
    });
  }
  it('the GPZ-table status count is counted from the records', () => {
    expect(gpzStatusCount(real.records)).toBe(real.records.filter((r) => r.verdict.kind === 'verdict' && r.statusSource === 'GPZ table').length);
  });
});

describe('what the census must say', () => {
  const text = textOf(censusHtml(real));
  it('names the near-GEO filter blind spot with the configured window', () => {
    expect(text).toContain('Satellites sent much higher, or that left GEO, are not in the register');
    expect(text).toContain('within 2,000 km of GEO altitude');
    expect(text).toContain('orbit centre EA');
  });
  it('states the status source, the orbit source, the borderline count and the open caveats', () => {
    expect(text).toContain('came from the GPZ table');
    expect(text).toContain('whole-km altitudes');
    expect(text).toContain('borderline');
    expect(text).toContain('Sexton has no retirement dates');
    expect(text).toContain('not directly comparable');
    expect(text).toContain('voluntary');
    expect(text).toContain('18 March 2002');
    expect(text).toContain('±25 km');
  });
  it('pairs every verdict word with its meaning', () => {
    for (const w of ['Fallen (', 'Unquiet (', 'Shallow grave (', 'Restless (', 'Uncertain (', 'Buried (']) expect(text).toContain(w);
  });
});

describe('share formatting', () => {
  it('always shows the denominator', () => {
    expect(formatShare(280, 696)).toBe('280 of 696 (40.2%)');
    expect(formatShare(457, 696)).toBe('457 of 696 (65.7%)');
    expect(formatShare(48, 696)).toBe('48 of 696 (6.9%)');
    expect(formatShare(0, 0)).toBe('0 of 0');
  });
  it('never rounds a partial share to 0.0% or 100.0%', () => {
    expect(formatShare(1, 5000)).toBe('1 of 5,000 (<0.1%)');
    expect(formatShare(4999, 5000)).toBe('4,999 of 5,000 (>99.9%)');
    expect(formatShare(0, 5)).toBe('0 of 5 (0.0%)');
    expect(formatShare(5, 5)).toBe('5 of 5 (100.0%)');
  });
  it('property: the text starts "n of N" for every n <= N', () => {
    fc.assert(
      fc.property(fc.nat(100000), fc.nat(100000), (a, b) => {
        const [n, d] = a <= b ? [a, b] : [b, a];
        return formatShare(n, d).startsWith(`${formatCount(n)} of ${formatCount(d)}`);
      }),
    );
  });
});

describe('the census page passes the language check', () => {
  it('has no banned stem, as shipped or with both figures verified', () => {
    const verified = COMPARISONS.map((c) => ({ ...c, verified: true, where: 'page 1' }));
    for (const reg of [real, fixture]) {
      for (const list of [COMPARISONS, verified]) {
        expect(findHits(textOf(censusHtml(reg, list)), 'census.html')).toEqual([]);
      }
    }
  });
  it('states no retirement date', () => {
    const blocks = [...censusHtml(real).matchAll(/<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/g)].map((m) => textOf(m[1]!));
    expect(blocks.length).toBeGreaterThan(10);
    for (const block of blocks) {
      for (const sentence of block.split(/(?<=\.)\s/)) {
        if (/\bretire(d|ment)?\b(?! payloads?\b)/i.test(sentence)) expect(sentence, sentence).not.toMatch(/\b(19|20)\d{2}\b/);
      }
    }
  });
});
