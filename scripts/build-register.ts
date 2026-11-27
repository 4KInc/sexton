// Builds data/register.json from the newest complete snapshot set in data/raw/.
// Reads files only. This script never downloads anything.
//
// Run: node scripts/build-register.ts [--set <dir>] [--out <file>] [--cases <dir>]
//   --set    use this snapshot folder instead of the newest complete one
//   --out    write here instead of data/register.json
//   --cases  folder of <norad>.md case files (default data/cases)
//   The operators come from operators.json in the folder that holds the cases folder (data/operators.json). No file means no operator is sourced.
// Exit codes: 0 done, 1 the snapshot is not usable (nothing is written), 2 bad arguments.
import { causeCounts, causeGroup, causeOf } from '../src/engine/causes.ts';
import type { CauseCategory } from '../src/engine/causes.ts';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './is-main.ts';
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

/** The cause category each case file in `casesDir` names, by NORAD id. Null when the file has no valid `Cause category:` line. */
export function readCauses(casesDir: string): Map<number, CauseCategory | null> {
  const out = new Map<number, CauseCategory | null>();
  if (!existsSync(casesDir)) return out;
  for (const name of readdirSync(casesDir)) {
    const m = /^([1-9]\d*)\.md$/.exec(name);
    if (m !== null) out.set(Number(m[1]), causeOf(readFileSync(join(casesDir, name), 'utf8')));
  }
  return out;
}
interface OperatorEntry {
  norad: number;
  operator: string;
  relation: string;
  sourceUrl: string;
  openedOn: string;
}
/**
 * Reads operators.json. An operator is recorded only with a source that was opened (R13.2, R13.3), so a bad entry stops the build:
 * no name, no relation label, no http(s) URL, no date opened, or a NORAD id given twice.
 */
export function readOperators(path: string): Map<number, OperatorEntry> {
  const out = new Map<number, OperatorEntry>();
  if (!existsSync(path)) return out;
  let data: { entries?: unknown };
  try {
    data = JSON.parse(readFileSync(path, 'utf8')) as { entries?: unknown };
  } catch (e) {
    throw new SnapshotError(`${path} is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(data.entries)) throw new SnapshotError(`${path} has no "entries" list.`);
  for (const raw of data.entries as Partial<OperatorEntry>[]) {
    const bad = (problem: string): never => {
      throw new SnapshotError(`${path}: entry for NORAD ${String(raw.norad)}: ${problem}`);
    };
    if (!Number.isSafeInteger(raw.norad)) bad('norad is not a whole number');
    if (typeof raw.operator !== 'string' || raw.operator.trim() === '') bad('no operator name');
    if (typeof raw.relation !== 'string' || raw.relation.trim() === '') bad('no relation label');
    if (typeof raw.sourceUrl !== 'string' || !/^https?:\/\/\S+$/.test(raw.sourceUrl)) bad('no http(s) source URL');
    if (typeof raw.openedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.openedOn)) bad('no date opened');
    if (out.has(raw.norad as number)) bad('given twice');
    out.set(raw.norad as number, raw as OperatorEntry);
  }
  return out;
}
/** Builds the register text for one snapshot folder. Throws SnapshotError if the set is not usable. */
export function buildRegisterText(setDir: string, casesDir: string, operatorsPath: string = join(dirname(casesDir), 'operators.json')): string {
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
  const operators = readOperators(operatorsPath);
  // Only a retired payload launched on or after the FCC rule date can carry an operator. Every other record gets none of these fields.
  const postRule = new Set(result.records.filter((r) => r.verdict.kind === 'verdict' && r.verdict.era === null).map((r) => r.norad));
  for (const norad of operators.keys()) {
    if (!postRule.has(norad)) throw new SnapshotError(`${operatorsPath}: NORAD ${norad} is not a retired payload launched on or after the FCC rule date, so it cannot have an operator here.`);
  }
  const register: Register = {
    schema: 1,
    sample: false,
    snapshot: { set: snapshotDate, sources },
    config: CONFIG,
    records: result.records.map((r) => {
      const base = { ...r, caseFile: withCase.has(r.norad) };
      if (!postRule.has(r.norad)) return base;
      const op = operators.get(r.norad);
      return op === undefined ? { ...base, operator: null, operatorRelation: null, operatorSource: null } : { ...base, operator: op.operator, operatorRelation: op.relation, operatorSource: op.sourceUrl };
    }),
    rejections: result.rejections,
    noOrbitDataCount: result.noOrbitDataCount,
    census: result.census,
  };
  register.causes = causeCounts(causeGroup(register.records), readCauses(casesDir));
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

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
