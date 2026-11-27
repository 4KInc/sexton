// R14: the cause categories, the group of 18, and the case files' Cause sections.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CAUSE_CATEGORIES, causeCounts, causeGroup, causeOf } from '../src/engine/causes.ts';
import type { CauseCategory } from '../src/engine/causes.ts';
import { readCauses } from '../scripts/build-register.ts';
import { CAUSE_START, CAUSE_END, renderCauseLine } from '../scripts/census.ts';
import { postRuleSummary } from '../src/engine/headline.ts';
import { findHits } from '../scripts/check-language.ts';
import { CAUSES } from '../src/ui/copy.ts';
import type { Register, SatRecord } from '../src/engine/types.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const real = JSON.parse(read('data/register.json')) as Register;
const category = fc.constantFrom(...CAUSE_CATEGORIES);

describe('causeOf', () => {
  it('reads the category from the Cause section', () => {
    for (const c of CAUSE_CATEGORIES) expect(causeOf(`# Other\nx\n# Cause\nCause category: ${c}\nMore text.\n# Next\ny`)).toBe(c);
  });
  it('returns null with no Cause section, no category line, an unknown category or a line in the wrong section', () => {
    expect(causeOf('# What the register shows\nx')).toBeNull();
    expect(causeOf('# Cause\nNo line here.\n# Next\nCause category: disposal reported by operator')).toBeNull();
    expect(causeOf('# Cause\nCause category: lost contact or broke up before disposal')).toBeNull();
    expect(causeOf('Cause category: disposal reported by operator')).toBeNull();
  });
  it('property: never throws and only returns one of the five names', () => {
    fc.assert(
      fc.property(fc.string(), (body) => {
        const c = causeOf(body);
        return c === null || (CAUSE_CATEGORIES as readonly string[]).includes(c);
      }),
    );
  });
});

describe('the group and the counts', () => {
  const group = causeGroup(real.records);
  it('is the story stones, the same 36 as the headline: post-rule retired payloads that are unquiet or shallow grave', () => {
    const s = postRuleSummary(real.records);
    expect(group).toHaveLength(s.inOrNearZone);
    expect(group).toHaveLength(36);
    for (const r of group) {
      expect(r.verdict.kind).toBe('verdict');
      expect(r.verdict.kind === 'verdict' && r.verdict.era).toBeNull();
      expect(r.verdict.kind === 'verdict' && ['unquiet', 'shallow grave']).toContain(r.verdict.kind === 'verdict' ? r.verdict.verdict : '');
    }
  });
  it('COMS 1 (36744, uncertain) is not in the group, and its case file stays', () => {
    expect(group.map((r) => r.norad)).not.toContain(36744);
    expect(readdirSync(join(ROOT, 'data/cases'))).toContain('36744.md');
  });
  it('property: the counts add up to the group size, whatever the case files say', () => {
    fc.assert(
      fc.property(fc.array(fc.option(category, { nil: null }), { minLength: 36, maxLength: 36 }), (cats) => {
        const map = new Map<number, CauseCategory | null>(group.map((r, i) => [r.norad, cats[i]!]));
        const k = causeCounts(group, map);
        return k.n === 36 && Object.values(k.byCategory).reduce((a, b) => a + b, 0) + k.noCase === 36;
      }),
    );
  });
  it('a payload with no case file is counted as noCase', () => {
    expect(causeCounts(group, new Map()).noCase).toBe(36);
  });
});

describe('the case files for the story stones', () => {
  const group = causeGroup(real.records);
  const causes = readCauses(join(ROOT, 'data/cases'));
  const review = read('docs/source-review.md');
  const methodology = read('docs/methodology.md');
  const bodyOf = (norad: number): string => read(`data/cases/${norad}.md`);
  const causeSection = (norad: number): string[] => {
    const lines = bodyOf(norad).split('\n');
    const start = lines.findIndex((l) => l.trim() === '# Cause');
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => l.startsWith('# '));
    return (end < 0 ? rest : rest.slice(0, end)).filter((l) => l.trim() !== '');
  };
  it('every one that has a case file has a valid cause category', () => {
    for (const r of group) if (causes.has(r.norad)) expect(causes.get(r.norad), String(r.norad)).not.toBeNull();
  });
  it('the 17 approved on 2026-11-27 keep their categories (COMS 1 is out of the group)', () => {
    const failed = [32500, 33414, 37950, 41308, 41748, 43087];
    for (const r of group) {
      if (failed.includes(r.norad)) expect(causes.get(r.norad), String(r.norad)).toBe('failed in orbit or broke up before disposal');
    }
    for (const n of [32478, 33108, 34264, 37150, 37344, 37779, 37804, 37806, 38101, 42763, 55138]) expect(causes.get(n), String(n)).toBe('No cause in the sources opened');
    expect(causes.get(36744)).toBe('disposal reported by operator');
  });
  it('after the owner approved batch 3 (2026-11-27): 10 failed or broke up, 1 disposal reported (Kodama), 25 no cause, none without a case file', () => {
    const k = causeCounts(group, causes);
    expect(k.byCategory).toEqual({
      'failed in orbit or broke up before disposal': 10,
      'disposal reported by operator': 1,
      'disposal attempted, perigee short': 0,
      'no disposal reported': 0,
      'No cause in the sources opened': 25,
    });
    expect(k.noCase).toBe(0);
    expect(causes.get(27516)).toBe('disposal reported by operator');
    for (const n of [27775, 28094, 29648, 31395]) expect(causes.get(n), String(n)).toBe('failed in orbit or broke up before disposal');
  });
  it('the payloads still without a case file are counted as such, not guessed', () => {
    const k = causeCounts(group, causes);
    expect(k.noCase).toBe(group.filter((r) => !causes.has(r.norad)).length);
  });
  it('a case with no cause has no quote, and a case with a cause quotes only approved text, verbatim, with a source from the Sources table', () => {
    for (const r of group.filter((x) => causes.has(x.norad))) {
      const lines = causeSection(r.norad);
      const quotes = lines.filter((l) => /^- ["「]/.test(l));
      if (causes.get(r.norad) === 'No cause in the sources opened') {
        expect(quotes, String(r.norad)).toEqual([]);
        continue;
      }
      expect(quotes.length, String(r.norad)).toBeGreaterThan(0);
      for (const q of quotes) {
        const m = /^- (?:"(.*)"|(「.*))\s*\[([^\]]*?): (https?:\/\/[^\]\s]+)\]/.exec(q);
        expect(m, q).not.toBeNull();
        const text = (m![1] ?? m![2])!;
        const url = m![4]!;
        const row = review.split('\n').find((l) => l.includes(url) && l.includes(r.norad.toString()) && /\bapproved\b/.test(l));
        expect(row, `${r.norad}: ${url} is an approved row in docs/source-review.md`).toBeDefined();
        expect(row!.includes(text), `${r.norad}: "${text}" is verbatim in docs/source-review.md`).toBe(true);
        expect(methodology.includes(url), `${url} is in the Sources table`).toBe(true);
      }
    }
  });
  it('no Cause section carries a four-digit year or a retirement date', () => {
    for (const r of group.filter((x) => causes.has(x.norad))) {
      // Citations carry URLs, and URLs carry years. Only the words are checked.
      const text = causeSection(r.norad).join('\n').replace(/\[[^\]]*\]/g, '');
      expect(text, String(r.norad)).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(text, String(r.norad)).not.toMatch(/retirement date|decommission|retired in/i);
    }
  });
  it('every case file in data/cases is for a payload in the register', () => {
    const names = readdirSync(join(ROOT, 'data/cases')).filter((n) => n.endsWith('.md'));
    const norads = new Set(real.records.map((r: SatRecord) => r.norad));
    for (const n of names) expect(norads.has(Number(n.replace('.md', ''))), n).toBe(true);
  });
});

describe('the counts in data/register.json', () => {
  it('equal a recount from the case files and the register', () => {
    const group = causeGroup(real.records);
    expect(real.causes).toEqual(causeCounts(group, readCauses(join(ROOT, 'data/cases'))));
  });
});

describe('the README cause line', () => {
  it('equals the line built from the register and the case files', () => {
    const readme = read('README.md');
    const a = readme.indexOf(CAUSE_START);
    const b = readme.indexOf(CAUSE_END);
    expect(a).toBeGreaterThan(-1);
    expect(readme.slice(a + CAUSE_START.length, b).trim()).toBe(renderCauseLine(real));
  });
  it('begins "Of the 36, n failed in orbit or broke up before they could be moved." with n from the register', () => {
    const failed = real.causes!.byCategory['failed in orbit or broke up before disposal'];
    expect(read('README.md')).toContain(`Of the 36, ${failed} failed in orbit or broke up before they could be moved.`);
  });
  it('has the second sentence, built from the count of "disposal reported by operator" among the unquiet', () => {
    const group = causeGroup(real.records);
    const causes = readCauses(join(ROOT, 'data/cases'));
    const n = group.filter((r) => causes.get(r.norad) === 'disposal reported by operator' && r.verdict.kind === 'verdict' && r.verdict.verdict === 'unquiet').length;
    expect(n).toBe(1);
    expect(real.causes!.reportedUnquiet).toBe(n);
    expect(read('README.md')).toContain(`Of the 36, 10 failed in orbit or broke up before they could be moved. ${CAUSES.reported(n, real.snapshot.set)}`);
    expect(read('README.md')).toContain('1 was raised by its operator, as the operator reports, and reads inside the zone in the 22 Nov 2026 snapshot.');
  });
  it('the sentence agrees in number, names the snapshot, and passes the language check', () => {
    expect(CAUSES.reported(1, '2026-11-22')).toBe('1 was raised by its operator, as the operator reports, and reads inside the zone in the 22 Nov 2026 snapshot.');
    expect(CAUSES.reported(2, '2026-11-22')).toBe('2 were raised by their operators, as the operators report, and read inside the zone in the 22 Nov 2026 snapshot.');
    for (const n of [1, 2, 7]) expect(findHits(CAUSES.reported(n, '2026-11-22'), 'causes')).toEqual([]);
    expect(CAUSES.reported(1, '2026-11-22')).not.toMatch(/today|\b(19|20)\d\d\b(?! snapshot)/);
  });
  it('is left out when no payload is both reported by its operator and unquiet', () => {
    const none = { ...real, causes: { ...real.causes!, reportedUnquiet: 0 } };
    expect(renderCauseLine(none)).not.toContain('was raised by its operator');
  });
  it('the README and the census page name no ESA range', () => {
    expect(read('README.md')).not.toMatch(/\bESA\b|70% to 95%|70\D{1,3}95\s?%/);
  });
});
