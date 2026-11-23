// Case-file parser (design 5.8, R8). Pure: no DOM, no Vite. The build plugin, content.ts and the
// tests all use it. The front matter is three keys, parsed by hand.

export interface CaseFile {
  norad: number;
  title: string;
  provisional: boolean;
  /** The markdown after the front matter. */
  body: string;
}

/** A bad case file. The message names the file and the problem. */
export class CaseFileError extends Error {
  readonly file: string;
  readonly problem: string;
  constructor(file: string, problem: string) {
    super(`Bad case file ${file}: ${problem}`);
    this.name = 'CaseFileError';
    this.file = file;
    this.problem = problem;
  }
}

const KEYS = ['norad', 'title', 'provisional'] as const;
const FILE_NAME = /^([1-9]\d*)\.md$/;

/** The last part of a path, with "/" or "\" separators. */
const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/**
 * Parses one case file. `file` is the path shown in error messages; its last part must be
 * `<norad>.md`. Throws CaseFileError.
 */
export function parseCaseFile(file: string, text: string): CaseFile {
  const fail = (problem: string): never => {
    throw new CaseFileError(file, problem);
  };
  const nameMatch = FILE_NAME.exec(baseName(file));
  if (nameMatch === null) return fail('the file name must be <norad>.md, for example 40258.md');
  const fileNorad = Number(nameMatch[1]);
  if (!Number.isSafeInteger(fileNorad)) return fail('the NORAD id in the file name is too large');

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trimEnd() !== '---') return fail('the file must start with a "---" line that opens the front matter');
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trimEnd() === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return fail('the front matter has no closing "---" line');

  const values = new Map<string, string>();
  for (let i = 1; i < close; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const colon = line.indexOf(':');
    if (colon < 0) return fail(`front matter line ${i + 1} is not "key: value": "${line.trim()}"`);
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!(KEYS as readonly string[]).includes(key)) return fail(`front matter line ${i + 1} has an unknown key "${key}" (allowed: ${KEYS.join(', ')})`);
    if (values.has(key)) return fail(`front matter line ${i + 1} repeats the key "${key}"`);
    values.set(key, value);
  }

  const noradText = values.get('norad');
  if (noradText === undefined) return fail('front matter has no "norad" key');
  if (!/^[1-9]\d*$/.test(noradText) || !Number.isSafeInteger(Number(noradText))) return fail(`"norad" must be a whole number, not "${noradText}"`);
  if (Number(noradText) !== fileNorad) return fail(`"norad" is ${noradText}, but the file name says ${fileNorad}`);

  let title = values.get('title');
  if (title === undefined) return fail('front matter has no "title" key');
  const quoted = /^"(.*)"$/.exec(title) ?? /^'(.*)'$/.exec(title);
  if (quoted !== null) title = quoted[1]!;
  if (title.trim() === '') return fail('"title" is empty');

  const provisionalText = values.get('provisional');
  if (provisionalText !== undefined && provisionalText !== 'true' && provisionalText !== 'false') {
    return fail(`"provisional" must be true or false, not "${provisionalText}"`);
  }

  const body = lines.slice(close + 1).join('\n').trim();
  if (body === '') return fail('the file has no text after the front matter');

  return { norad: fileNorad, title: title.trim(), provisional: provisionalText === 'true', body };
}

/** Parses every file. Any bad file throws, naming that file. Files are taken in name order. */
export function parseCaseFiles(files: Readonly<Record<string, string>>): Map<number, CaseFile> {
  const out = new Map<number, CaseFile>();
  for (const file of Object.keys(files).sort()) {
    const parsed = parseCaseFile(file, files[file]!);
    out.set(parsed.norad, parsed);
  }
  return out;
}
