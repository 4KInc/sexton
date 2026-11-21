// Builds data/register.json from the newest complete snapshot set in data/raw/.
// Reads files only. This script never downloads anything.
//
// Run: node scripts/build-register.ts [--set <dir>] [--out <file>] [--cases <dir>]
//   --set    use this snapshot folder instead of the newest complete one
//   --out    write here instead of data/register.json
//   --cases  folder of <norad>.md case files (default data/cases)
// Exit codes: 0 done, 1 the snapshot is not usable (nothing is written), 2 bad arguments.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONFIG } from '../src/engine/config.ts';
import { runEngine } from '../src/engine/engine.ts';
import type { Register, RegisterSource } from '../src/engine/types.ts';
import { isIsoDate } from '../src/engine/values.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SATCAT = 'satcat.csv';
const GPZ = 'gpz.csv';
const TABLE = 'table-gpz.csv';
/** The files a register is built from, in the order they appear in register.json. */
export const REQUIRED_FILES = [SATCAT, GPZ, TABLE] as const;

export interface Io {
  /** Folder that relative paths in the arguments are resolved against. Default: the current directory. */
  cwd?: string;
  /** Project root, where data/raw, data/register.json and data/cases live. Default: this repository. */
  root?: string;
  log?: (line: string) => void;
  error?: (line: string) => void;
}

interface ManifestEntry {
  file?: unknown;
  url?: unknown;
  fetchedAt?: unknown;
  httpStatus?: unknown;
  bytes?: unknown;
  sha256?: unknown;
}
interface Manifest {
  complete?: unknown;
  startedAt?: unknown;
  entries?: unknown;
}

/** Thrown for a snapshot that can't be used. The message is printed and the exit code is 1. */
class SnapshotError extends Error {}

const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

function readManifest(dir: string): Manifest | null {
  const path = join(dir, 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Manifest) : null;
  } catch {
    return null;
  }
}

function noCompleteSet(rawDir: string): SnapshotError {
  return new SnapshotError(
    `No complete snapshot with ${SATCAT} in ${rawDir}. Run scripts/snapshot.ts when CelesTrak allows it, or add ${SATCAT} by hand with a manifest entry. This script never downloads.`,
  );
}

/** Newest data/raw/<date>/ whose manifest says complete: true. */
function newestCompleteSet(rawDir: string): string {
  const names = existsSync(rawDir) ? readdirSync(rawDir).filter((n) => DATE_DIR.test(n)) : [];
  names.sort().reverse();
  for (const name of names) {
    if (readManifest(join(rawDir, name))?.complete === true) return join(rawDir, name);
  }
  throw noCompleteSet('data/raw/');
}

/** The last manifest entry for this file with HTTP status 200. */
function entryFor(manifest: Manifest, file: string): ManifestEntry | null {
  const entries = Array.isArray(manifest.entries) ? (manifest.entries as ManifestEntry[]) : [];
  const ok = entries.filter((e) => e !== null && typeof e === 'object' && e.file === file && e.httpStatus === 200);
  return ok.length > 0 ? ok[ok.length - 1]! : null;
}

/** The set's date: its folder name if that is a date, otherwise the date part of the manifest's startedAt. */
function snapshotDateOf(dir: string, manifest: Manifest): string {
  const name = basename(dir);
  if (DATE_DIR.test(name) && isIsoDate(name)) return name;
  const started = typeof manifest.startedAt === 'string' ? manifest.startedAt.slice(0, 10) : '';
  if (isIsoDate(started)) return started;
  throw new SnapshotError(`Can't tell the snapshot date: folder "${name}" is not YYYY-MM-DD and manifest.json has no startedAt date.`);
}

function caseNorads(casesDir: string): Set<number> {
  const out = new Set<number>();
  if (!existsSync(casesDir)) return out;
  for (const name of readdirSync(casesDir)) {
    const m = /^(\d+)\.md$/.exec(name);
    if (m !== null) out.add(Number(m[1]));
  }
  return out;
}

/** Builds the register text for one snapshot folder. Throws SnapshotError if the set is not usable. */
export function buildRegisterText(setDir: string, casesDir: string): string {
  const manifest = readManifest(setDir);
  if (manifest === null) throw new SnapshotError(`${setDir} has no readable manifest.json. This script never downloads.`);
  if (manifest.complete !== true) throw noCompleteSet(setDir);

  const texts = new Map<string, string>();
  const sources: RegisterSource[] = [];
  for (const file of REQUIRED_FILES) {
    const entry = entryFor(manifest, file);
    const path = join(setDir, file);
    if (entry === null || !existsSync(path)) {
      throw new SnapshotError(
        `${basename(setDir)} has no ${file} (it needs the file and a manifest entry with httpStatus 200). Run scripts/snapshot.ts when CelesTrak allows it, or add ${file} by hand with a manifest entry. This script never downloads.`,
      );
    }
    const bytes = readFileSync(path);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== entry.sha256) {
      throw new SnapshotError(`sha256 mismatch for ${file} in ${basename(setDir)}: manifest says ${String(entry.sha256)}, the file is ${actual}. Nothing was written.`);
    }
    texts.set(file, bytes.toString('utf8'));
    sources.push({
      file,
      url: String(entry.url),
      fetchedAt: String(entry.fetchedAt),
      sha256: actual,
      bytes: typeof entry.bytes === 'number' ? entry.bytes : bytes.length,
    });
  }

  const snapshotDate = snapshotDateOf(setDir, manifest);
  const result = runEngine({
    satcatCsv: texts.get(SATCAT)!,
    gpzCsv: texts.get(GPZ)!,
    gpzTableHtml: texts.get(TABLE)!,
    snapshotDate,
  });
  const withCase = caseNorads(casesDir);
  const register: Register = {
    schema: 1,
    sample: false,
    snapshot: { set: snapshotDate, sources },
    config: CONFIG,
    records: result.records.map((r) => ({ ...r, caseFile: withCase.has(r.norad) })),
    rejections: result.rejections,
    noOrbitDataCount: result.noOrbitDataCount,
    census: result.census,
  };
  return JSON.stringify(register, null, 2) + '\n';
}

export function main(argv: string[], io: Io = {}): number {
  const log = io.log ?? ((line: string) => console.log(line));
  const error = io.error ?? ((line: string) => console.error(line));
  const root = io.root ?? ROOT;
  const cwd = io.cwd ?? process.cwd();

  let set: string | null = null;
  let out = join(root, 'data', 'register.json');
  let cases = join(root, 'data', 'cases');
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined || (flag !== '--set' && flag !== '--out' && flag !== '--cases')) {
      error('Usage: node scripts/build-register.ts [--set <dir>] [--out <file>] [--cases <dir>]');
      return 2;
    }
    if (flag === '--set') set = resolve(cwd, value);
    else if (flag === '--out') out = resolve(cwd, value);
    else cases = resolve(cwd, value);
  }

  try {
    const setDir = set ?? newestCompleteSet(join(root, 'data', 'raw'));
    const text = buildRegisterText(setDir, cases);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    log(`Wrote ${out} from ${basename(setDir)}.`);
    return 0;
  } catch (e) {
    if (e instanceof SnapshotError) {
      error(e.message);
      return 1;
    }
    throw e;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
