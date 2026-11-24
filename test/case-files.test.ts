import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkCaseDir } from '../scripts/check-cases.ts';
import { BANNED_STEMS, SCAN_DIRS } from '../scripts/check-language.ts';
import type { SatRecord } from '../src/engine/types.ts';
import { CaseFileError, parseCaseFile, parseCaseFiles } from '../src/ui/case-file.ts';
import { CASES } from '../src/ui/content.ts';
import { LEDGER } from '../src/ui/copy.ts';
import { isSafeHref, renderMarkdown } from '../src/ui/markdown.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { caseFileSection, ledgerHtml, ledgerPageHtml } from '../src/ui/views/ledger.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const fixture = readFileSync(join(ROOT, 'test/fixtures/cases/40258.md'), 'utf8');
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
const luch = real.records.find((r): r is Retired => r.norad === 40258 && r.verdict.kind === 'verdict')!;

const FM = (body: string, front = 'norad: 40258\ntitle: T\nprovisional: false'): string => `---\n${front}\n---\n${body}`;

describe('parseCaseFile', () => {
  it('reads the fixture case file', () => {
    const c = parseCaseFile('test/fixtures/cases/40258.md', fixture);
    expect(c.norad).toBe(40258);
    expect(c.title).toBe('Fixture case: Luch/Olymp');
    expect(c.provisional).toBe(true);
    expect(c.body.startsWith('This is fixture text')).toBe(true);
    expect(c.body).not.toContain('---');
  });
  it('treats a missing provisional key as false, accepts quotes and CRLF', () => {
    const c = parseCaseFile('27378.md', '---\r\nnorad: 27378\r\ntitle: "EchoStar 7"\r\n---\r\nText.\r\n');
    expect(c).toEqual({ norad: 27378, title: 'EchoStar 7', provisional: false, body: 'Text.' });
  });
  it('is not provisional when the file says false', () => {
    expect(parseCaseFile('40258.md', FM('Text.')).provisional).toBe(false);
  });

  const bad: Array<[string, string, string, string]> = [
    ['no front matter', '40258.md', 'Just text.', 'must start with a "---"'],
    ['no closing line', '40258.md', '---\nnorad: 40258\ntitle: T\nText.', 'no closing "---"'],
    ['a line without a colon', '40258.md', FM('Text.', 'norad: 40258\ntitle T'), 'is not "key: value"'],
    ['an unknown key', '40258.md', FM('Text.', 'norad: 40258\ntitle: T\nauthor: me'), 'unknown key "author"'],
    ['a repeated key', '40258.md', FM('Text.', 'norad: 40258\ntitle: T\ntitle: U'), 'repeats the key "title"'],
    ['no norad', '40258.md', FM('Text.', 'title: T'), 'no "norad" key'],
    ['a non-numeric norad', '40258.md', FM('Text.', 'norad: abc\ntitle: T'), '"norad" must be a whole number'],
    ['a norad that disagrees with the file name', '40258.md', FM('Text.', 'norad: 27378\ntitle: T'), 'but the file name says 40258'],
    ['no title', '40258.md', FM('Text.', 'norad: 40258'), 'no "title" key'],
    ['an empty title', '40258.md', FM('Text.', 'norad: 40258\ntitle:'), '"title" is empty'],
    ['a provisional that is not a boolean', '40258.md', FM('Text.', 'norad: 40258\ntitle: T\nprovisional: yes'), '"provisional" must be true or false'],
    ['an empty body', '40258.md', FM('  \n'), 'no text after the front matter'],
    ['a wrong file name', 'notes.md', FM('Text.'), 'file name must be <norad>.md'],
  ];
  it.each(bad)('rejects %s, naming the file and the problem', (_label, name, text, problem) => {
    const path = `data/cases/${name}`;
    let error: unknown;
    try {
      parseCaseFile(path, text);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CaseFileError);
    const message = (error as Error).message;
    expect(message).toContain(path);
    expect(message).toContain(problem);
  });

  it('parseCaseFiles stops at the first bad file and names it', () => {
    expect(() => parseCaseFiles({ '/data/cases/1.md': FM('x', 'norad: 1\ntitle: A'), '/data/cases/2.md': 'oops' })).toThrow('/data/cases/2.md');
  });
});

describe('renderMarkdown', () => {
  it('renders ordinary markdown', () => {
    const html = renderMarkdown('Some **bold** and a [link](https://example.org/a?b=1&c=2).\n\n- one\n- two');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<a href="https://example.org/a?b=1&amp;c=2" rel="noopener noreferrer">link</a>');
    expect(html).toContain('<li>one</li>');
  });
  it('escapes a script tag, block or inline', () => {
    for (const text of ['<script>alert(1)</script>', 'before <script>alert(1)</script> after', 'a\n\n<script src="https://x.test/a.js"></script>\n\nb']) {
      const html = renderMarkdown(text);
      expect(html).not.toMatch(/<script/i);
      expect(html).toContain('&lt;script');
    }
  });
  it('escapes an onerror attribute, so no element carries it', () => {
    for (const text of ['<img src=x onerror=alert(1)>', 'text <img src=x onerror="alert(1)"> text', '<div onclick="x()">hi</div>', '<a href="https://x.test" onmouseover="x()">y</a>']) {
      const html = renderMarkdown(text);
      expect(html).not.toMatch(/<(img|div|a)\b/i);
      expect(html).toContain('&lt;');
    }
  });
  it('drops a javascript: link and keeps its text', () => {
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', '&#106;avascript:alert(1)', '&#x6A;avascript:alert(1)', ' javascript:alert(1)', 'java%0Ascript:alert(1)']) {
      const html = renderMarkdown(`[click me](<${href}>)`);
      expect(html).not.toMatch(/href/i);
      expect(html).not.toMatch(/<a\b/i);
      expect(html).toContain('click me');
    }
  });
  it('drops a data: link and a data: image', () => {
    const html = renderMarkdown('[open](data:text/html;base64,PHNjcmlwdD4=) ![pic](data:image/svg+xml,x)');
    expect(html).not.toMatch(/href|src=|<a\b|<img/i);
    expect(html).toContain('open');
    expect(html).toContain('pic');
  });
  it('drops vbscript:, relative and protocol-relative links, and autolinks that are not http', () => {
    for (const text of ['[x](vbscript:a)', '[x](/etc/passwd)', '[x](//evil.test/a)', '[x](file:///etc/passwd)', '<javascript:alert(1)>']) {
      expect(renderMarkdown(text)).not.toMatch(/<a\b/i);
    }
  });
  it('drops a javascript: reference link', () => {
    expect(renderMarkdown('[x][1]\n\n[1]: javascript:alert(1)')).not.toMatch(/<a\b/i);
  });
  it('escapes a title attribute', () => {
    const html = renderMarkdown('[x](https://example.org "a\\" onclick=\\"b")');
    expect(html).toContain('title="a&quot; onclick=&quot;b"');
    expect(html.match(/"/g)!.length).toBe(6);
  });
  it('keeps http, https and in-page links', () => {
    expect(isSafeHref('http://a.test')).toBe(true);
    expect(isSafeHref('HTTPS://a.test')).toBe(true);
    expect(isSafeHref('#/sat/27378')).toBe(true);
    expect(isSafeHref('javascript:x')).toBe(false);
    expect(isSafeHref('data:text/html,x')).toBe(false);
    expect(renderMarkdown('[x](#/sat/27378)')).toContain('<a href="#/sat/27378">x</a>');
  });
  it('turns an image into its alt text only', () => {
    expect(renderMarkdown('![a chart](https://x.test/a.png)')).not.toMatch(/<img/i);
  });
  it('shifts headings down three levels, to at most h6', () => {
    const html = renderMarkdown('# One\n\n### Three\n\n###### Six');
    expect(html).toContain('<h4>One</h4>');
    expect(html).toContain('<h6>Three</h6>');
    expect(html).toContain('<h6>Six</h6>');
    expect(html).not.toMatch(/<h[1-3]/);
  });
  it('escapes HTML inside code', () => {
    expect(renderMarkdown('`<b>x</b>`')).toContain('&lt;b&gt;');
  });
});

describe('case file on the ledger (section 8)', () => {
  const cases = new Map([[40258, parseCaseFile('40258.md', fixture)]]);
  const withFile = { ...luch, caseFile: true } as Retired;
  const sectionTitles = (html: string): string[] => [...html.matchAll(/<h2 id="ledger-[a-z]+-title">([^<]*)<\/h2>/g)].map((m) => m[1]!);

  it('shows the case file, its title and the provisional notice when caseFile is true', () => {
    const html = ledgerHtml(withFile, real, cases);
    expect(html).toContain('id="ledger-case"');
    expect(html).toContain('Fixture case: Luch/Olymp');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain(`>${LEDGER.provisional}<`);
    expect(LEDGER.provisional).toBe('Provisional: not yet confirmed against SATCAT');
  });
  it('puts the notice above the body, and the section after the two columns (the last column section is Report and data)', () => {
    const html = ledgerHtml(withFile, real, cases);
    expect(html.indexOf('case-provisional')).toBeLessThan(html.indexOf('case-body'));
    const titles = sectionTitles(html);
    expect(titles.indexOf(LEDGER.headings.caseFile)).toBe(titles.indexOf(LEDGER.headings.actions) + 1);
  });
  it('shows no notice for a file that is not provisional', () => {
    const final = new Map([[40258, parseCaseFile('40258.md', FM('Text.'))]]);
    const html = ledgerHtml(withFile, real, final);
    expect(html).toContain('id="ledger-case"');
    expect(html).not.toContain(LEDGER.provisional);
  });
  it('shows no section when the register says caseFile is false, even if a file is loaded', () => {
    expect(ledgerHtml({ ...luch, caseFile: false } as Retired, real, cases)).not.toContain('ledger-case');
  });
  it('shows no section when there are no case files (R8.4)', () => {
    expect(ledgerHtml(withFile, real, new Map())).not.toContain('ledger-case');
    expect(caseFileSection(withFile, new Map())).toBe('');
  });
  it('escapes a hostile case file inside the ledger', () => {
    const hostile = new Map([[40258, parseCaseFile('40258.md', FM('<script>x()</script> [a](javascript:x()) <img src=x onerror=y()>', 'norad: 40258\ntitle: <b>T</b>'))]]);
    const html = ledgerHtml(withFile, real, hostile);
    expect(html).not.toMatch(/<script|<img|<b>|<a [^>]*javascript:|href="javascript/i);
    expect(html).toContain('&lt;script&gt;');
  });
  it('is part of the page for the ledger url', () => {
    const reg = { ...real, records: real.records.map((r) => (r.norad === 40258 ? { ...r, caseFile: true } : r)) } as UiRegister;
    expect(ledgerPageHtml(reg, 40258, cases)).toContain('id="ledger-case"');
  });
  it('the real register has no case files yet, and the real loader finds none or only valid ones', () => {
    expect(CASES.size).toBe(checkCaseDir(join(ROOT, 'data/cases')));
  });
});

describe('the build stops on a bad case file', () => {
  const vite = join(ROOT, 'node_modules/vite/bin/vite.js');
  const build = (casesDir: string) => {
    const out = mkdtempSync(join(tmpdir(), 'build-out-'));
    return spawnSync('node', [vite, 'build', '--outDir', out, '--emptyOutDir'], {
      cwd: ROOT,
      env: { ...process.env, SEXTON_CASES_DIR: casesDir },
      encoding: 'utf8',
    });
  };
  const caseDir = (files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'cases-'));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    return dir;
  };

  it('checkCaseDir names the file and the problem', () => {
    const dir = caseDir({ '40258.md': FM('Text.'), '27378.md': '---\nnorad: 27378\n---\nText.' });
    expect(() => checkCaseDir(dir)).toThrow('data/cases/27378.md: front matter has no "title" key');
  });
  it('checkCaseDir treats a missing folder as no case files', () => {
    expect(checkCaseDir(join(tmpdir(), 'no-such-cases-folder'))).toBe(0);
  });
  it('fails `vite build` with a message naming the file and the problem', () => {
    const r = build(caseDir({ '27378.md': '---\nnorad: 27378\ntitle: EchoStar 7\nprovisional: maybe\n---\nText.' }));
    expect(r.status).not.toBe(0);
    const output = `${r.stdout}${r.stderr}`;
    expect(output).toContain('data/cases/27378.md');
    expect(output).toContain('"provisional" must be true or false, not "maybe"');
  }, 60_000);
  it('builds when the case files are good', () => {
    expect(build(caseDir({ '40258.md': fixture })).status).toBe(0);
  }, 60_000);
});

describe('the language check covers data/cases', () => {
  it('lists data/cases among the scanned folders', () => {
    expect(SCAN_DIRS).toContain('data/cases');
  });
  it.each(BANNED_STEMS)('fails with exit 1, naming the file and line, for "%s" in a case file', (stem) => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'lang-root-'));
    mkdirSync(join(root, 'scripts'));
    cpSync(join(ROOT, 'scripts/check-language.ts'), join(root, 'scripts/check-language.ts'));
    cpSync(join(ROOT, 'scripts/is-main.ts'), join(root, 'scripts/is-main.ts'));
    mkdirSync(join(root, 'data/cases'), { recursive: true });
    writeFileSync(join(root, 'data/cases/40258.md'), FM(`Fine line.\nThe operator ${stem} it.`));
    const r = spawnSync('node', [join(root, 'scripts/check-language.ts')], { cwd: '/', encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(`data/cases/40258.md:`);
    expect(r.stdout).toContain(stem);
  });
  it('passes a clean case file', () => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'lang-root-'));
    mkdirSync(join(root, 'scripts'));
    cpSync(join(ROOT, 'scripts/check-language.ts'), join(root, 'scripts/check-language.ts'));
    cpSync(join(ROOT, 'scripts/is-main.ts'), join(root, 'scripts/is-main.ts'));
    mkdirSync(join(root, 'data/cases'), { recursive: true });
    writeFileSync(join(root, 'data/cases/40258.md'), fixture);
    expect(spawnSync('node', [join(root, 'scripts/check-language.ts')], { cwd: '/', encoding: 'utf8' }).status).toBe(0);
  });
});
