// Language check (design 4, R10). Reads files only.
// Usage: node scripts/check-language.ts            scan the default set
//        node scripts/check-language.ts <file>...  scan only the given files, with the same rules
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './is-main.ts';

/** Banned stems. Keep identical to the list in .kiro/steering/language.md (a test checks it). */
export const BANNED_STEMS: readonly string[] = [
  'violat',
  'illegal',
  'non-compliant',
  'noncompliant',
  'non compliant',
  'broke the law',
  'breach',
  'unlawful',
];

/** Text file types that are scanned. */
export const TEXT_EXTENSIONS: readonly string[] = ['.ts', '.css', '.html', '.md', '.json', '.svg'];
/** Folders scanned recursively, relative to the repo root. */
export const SCAN_DIRS: readonly string[] = ['src/ui', 'data/cases', 'docs', 'powers'];
/** Single files scanned, relative to the repo root. */
export const SCAN_FILES: readonly string[] = ['README.md', 'index.html'];
/** The one file with a skipped section, and the heading that starts it. */
export const METHODOLOGY_PATH = 'docs/methodology.md';
export const SKIPPED_HEADING = '## What we do not say';

export interface Hit {
  file: string;
  line: number;
  match: string;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stemRe = (): RegExp => new RegExp(BANNED_STEMS.map(escapeRe).join('|'), 'gi');

/** Line numbers (1-based) inside the skipped section: after its heading, up to the next "## " heading. */
export function skippedLines(text: string): Set<number> {
  const skipped = new Set<number>();
  let inside = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^## /.test(line)) {
      inside = line.trim().toLowerCase() === SKIPPED_HEADING.toLowerCase();
      if (inside) skipped.add(i + 1);
      return;
    }
    if (inside) skipped.add(i + 1);
  });
  return skipped;
}

/** Every banned match in one file's text. `file` is a path relative to the root, with "/" separators. */
export function findHits(text: string, file: string): Hit[] {
  const skip = file === METHODOLOGY_PATH ? skippedLines(text) : new Set<number>();
  const hits: Hit[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (skip.has(i + 1)) return;
    for (const m of line.matchAll(stemRe())) hits.push({ file, line: i + 1, match: m[0] });
  });
  return hits;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (TEXT_EXTENSIONS.includes(extname(name))) out.push(path);
  }
}

/** The default file set, as absolute paths. */
export function defaultFiles(root: string): string[] {
  const out: string[] = [];
  for (const d of SCAN_DIRS) walk(join(root, d), out);
  for (const f of SCAN_FILES) if (existsSync(join(root, f))) out.push(join(root, f));
  return out;
}

/** Scan the given files (absolute paths), or the default set. */
export function checkFiles(root: string, files: string[] = defaultFiles(root)): Hit[] {
  const hits: Hit[] = [];
  for (const path of files) {
    const rel = relative(root, path).split(sep).join('/');
    hits.push(...findHits(readFileSync(path, 'utf8'), rel));
  }
  return hits;
}

export function formatHit(h: Hit): string {
  return `${h.file}:${h.line}: "${h.match}"`;
}

function main(): number {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const args = process.argv.slice(2);
  const hits = checkFiles(root, args.length > 0 ? args.map((a) => resolve(a)) : undefined);
  for (const h of hits) console.log(formatHit(h));
  if (hits.length > 0) {
    console.error(`Language check failed: ${hits.length} hit(s). See .kiro/steering/language.md.`);
    return 1;
  }
  console.log('Language check passed.');
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = main();
