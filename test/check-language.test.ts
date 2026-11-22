import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANNED_STEMS, checkFiles, defaultFiles, findHits, formatHit, METHODOLOGY_PATH } from '../scripts/check-language.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The stems in language.md: backticked tokens on the indented list lines under "Keep this list". */
function stemsInLanguageMd(): string[] {
  const text = readFileSync(join(ROOT, '.kiro/steering/language.md'), 'utf8');
  const stems: string[] = [];
  for (const line of text.split('\n')) {
    if (!/^\s{2}- `/.test(line)) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) stems.push(m[1] as string);
  }
  return stems;
}

describe('stem list', () => {
  it('has the eight stems from the requirements', () => {
    expect([...BANNED_STEMS].sort()).toEqual(
      ['violat', 'illegal', 'non-compliant', 'noncompliant', 'non compliant', 'broke the law', 'breach', 'unlawful'].sort(),
    );
  });
  it('matches language.md exactly', () => {
    expect([...stemsInLanguageMd()].sort()).toEqual([...BANNED_STEMS].sort());
  });
});

describe('findHits', () => {
  const sample: Record<string, string> = {
    violat: 'The operator violated it.',
    illegal: 'An illegal act.',
    'non-compliant': 'It was non-compliant.',
    noncompliant: 'It was noncompliant.',
    'non compliant': 'It was non compliant.',
    'broke the law': 'It broke the law.',
    breach: 'A breach of rules.',
    unlawful: 'An unlawful disposal.',
  };
  for (const stem of BANNED_STEMS) {
    it(`catches "${stem}"`, () => {
      const hits = findHits(sample[stem] as string, 'README.md');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.match.toLowerCase().startsWith(stem.slice(0, 5)))).toBe(true);
    });
    it(`catches "${stem}" in upper and mixed case`, () => {
      expect(findHits(stem.toUpperCase(), 'README.md')).toHaveLength(1);
      const mixed = stem.replace(/\b(\w)/g, (c) => c.toUpperCase());
      expect(findHits(mixed, 'README.md')).toHaveLength(1);
    });
  }
  it('catches the inflected forms', () => {
    for (const w of ['violated', 'violation', 'violates']) expect(findHits(w, 'a.md')).toHaveLength(1);
  });
  it('reports file, line and the matched text', () => {
    const hits = findHits('fine\nfine\nA Breach here', 'docs/x.md');
    expect(hits).toEqual([{ file: 'docs/x.md', line: 3, match: 'Breach' }]);
    expect(formatHit(hits[0]!)).toBe('docs/x.md:3: "Breach"');
  });
  it('reports every match, including two on one line', () => {
    expect(findHits('illegal and unlawful', 'a.md')).toHaveLength(2);
  });
  it('passes clean text', () => {
    expect(findHits('Below the IADC disposal threshold under the stated assumptions.', 'a.md')).toEqual([]);
  });
});

describe('methodology skip', () => {
  const doc = [
    '# Methodology', //1
    'intro with breach', //2
    '## What we do not say', //3
    'We never say illegal.', //4
    '### Sub heading', //5
    'or unlawful.', //6
    '## Sources', //7
    'a violation here', //8
  ].join('\n');
  it('skips only the section, up to the next "## " heading', () => {
    const hits = findHits(doc, METHODOLOGY_PATH);
    expect(hits.map((h) => h.line)).toEqual([2, 8]);
  });
  it('does not skip anything in other files', () => {
    expect(findHits(doc, 'docs/spike.md').map((h) => h.line)).toEqual([2, 4, 6, 8]);
    expect(findHits(doc, 'README.md')).toHaveLength(4);
  });
  it('matches the heading case-insensitively', () => {
    expect(findHits('## what we do not say\nillegal', METHODOLOGY_PATH)).toEqual([]);
  });
  it('does not skip a section with a similar heading', () => {
    expect(findHits('## What we do not say here\nillegal', METHODOLOGY_PATH)).toHaveLength(1);
  });
  it('ends the skip at the next heading even with no blank line', () => {
    expect(findHits('## What we do not say\nillegal\n## Next\nillegal', METHODOLOGY_PATH).map((h) => h.line)).toEqual([4]);
  });
});

describe('file set', () => {
  it('covers src/ui, docs, README.md and index.html, as text files only', () => {
    const files = defaultFiles(ROOT).map((f) => f.slice(ROOT.length));
    expect(files).toContain('index.html');
    expect(files).toContain('README.md');
    expect(files).toContain('src/ui/copy.ts');
    expect(files).toContain('docs/spike.md');
    expect(files.some((f) => f.endsWith('.woff2'))).toBe(false);
    expect(files.some((f) => f.startsWith('.kiro'))).toBe(false);
  });
  it('finds no hits in the committed files', () => {
    expect(checkFiles(ROOT).map(formatHit)).toEqual([]);
  });
});

describe('command line', () => {
  it('exits 1 and prints file:line: "match" on a hit, and 0 when clean', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lang-'));
    try {
      mkdirSync(dir, { recursive: true });
      const bad = join(dir, 'bad.md');
      const good = join(dir, 'good.md');
      writeFileSync(bad, 'ok\nIt was ILLEGAL.\n');
      writeFileSync(good, 'ok\n');
      const script = join(ROOT, 'scripts/check-language.ts');
      const r = spawnSync('node', [script, bad], { cwd: '/', encoding: 'utf8' });
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('bad.md:2: "ILLEGAL"');
      expect(spawnSync('node', [script, good], { cwd: '/', encoding: 'utf8' }).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
