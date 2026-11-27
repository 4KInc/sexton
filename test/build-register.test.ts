import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/engine/config.ts';
import { main } from '../scripts/build-register.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_SET = join(ROOT, 'test/fixtures/snapshot');
const FIXTURE_REGISTER = join(ROOT, 'test/fixtures/register.json');
const REBUILD = 'node scripts/build-register.ts --set test/fixtures/snapshot --out test/fixtures/register.json --cases test/fixtures/cases';

const MISSING_SATCAT =
  'No complete snapshot with satcat.csv in data/raw/. Run scripts/snapshot.ts when CelesTrak allows it, or add satcat.csv by hand with a manifest entry. This script never downloads.';

let tmp: string;
let fetchCalls: number;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sexton-'));
  fetchCalls = 0;
  vi.stubGlobal('fetch', () => {
    fetchCalls++;
    throw new Error('fetch must not be called');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(tmp, { recursive: true, force: true });
});

function run(argv: string[], root = tmp) {
  const logs: string[] = [];
  const errors: string[] = [];
  const code = main(argv, { cwd: tmp, root, log: (l) => logs.push(l), error: (l) => errors.push(l) });
  return { code, logs, errors };
}

/** A copy of the fixture set at <tmp>/data/raw/<name>/, optionally changed by `edit`. */
function setUp(name = '2026-11-20', edit?: (dir: string, manifest: { complete: boolean; startedAt?: string; entries: Record<string, unknown>[] }) => void): string {
  const dir = join(tmp, 'data', 'raw', name);
  mkdirSync(dir, { recursive: true });
  cpSync(FIXTURE_SET, dir, { recursive: true });
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  edit?.(dir, manifest);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}
const sha = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
const registerPath = (): string => join(tmp, 'data', 'register.json');

describe('on the real data/raw/ (complete set with SATCAT)', () => {
  it('builds, is not a sample, and never calls fetch', () => {
    const out = join(tmp, 'real.json');
    const err: string[] = [];
    const code = main(['--out', out], { cwd: tmp, log: () => {}, error: (l) => err.push(l) });
    expect(err).toEqual([]);
    expect(code).toBe(0);
    const reg = JSON.parse(readFileSync(out, 'utf8'));
    expect(reg.sample).toBe(false);
    expect(reg.records.length).toBeGreaterThan(1000);
    expect(fetchCalls).toBe(0);
  });
  it('the committed data/register.json is up to date with data/raw/ (byte-identical rebuild)', () => {
    const out = join(tmp, 'real.json');
    expect(main(['--out', out], { cwd: tmp, log: () => {}, error: () => {} })).toBe(0);
    const committed = readFileSync(join(ROOT, 'data/register.json'), 'utf8');
    expect(readFileSync(out, 'utf8') === committed, 'data/register.json is stale. Run: npm run build-register').toBe(true);
    expect(JSON.parse(committed).sample).toBe(false);
  });
});
describe('snapshot problems exit 1 and write nothing', () => {
  it('a set that is not complete', () => {
    setUp('2026-11-20', (_d, m) => { m.complete = false; });
    const r = run([]);
    expect(r.code).toBe(1);
    expect(r.errors[0]).toMatch(/No complete snapshot with satcat\.csv/);
    expect(existsSync(registerPath())).toBe(false);
  });
  it('no data/raw at all', () => {
    const r = run([]);
    expect(r.code).toBe(1);
    expect(r.errors).toEqual([MISSING_SATCAT]);
  });
  it('a complete set whose manifest has no satcat.csv entry', () => {
    setUp('2026-11-20', (_d, m) => { m.entries = m.entries.filter((e) => e['file'] !== 'satcat.csv'); });
    const r = run([]);
    expect(r.code).toBe(1);
    expect(r.errors[0]).toMatch(/has no satcat\.csv/);
    expect(r.errors[0]).toMatch(/never downloads/);
    expect(existsSync(registerPath())).toBe(false);
  });
  it('a satcat.csv entry that is not HTTP 200', () => {
    setUp('2026-11-20', (_d, m) => { for (const e of m.entries) if (e['file'] === 'satcat.csv') e['httpStatus'] = 500; });
    expect(run([]).errors[0]).toMatch(/has no satcat\.csv/);
  });
  it('satcat.csv missing from the folder', () => {
    setUp('2026-11-20', (d) => rmSync(join(d, 'satcat.csv')));
    const r = run([]);
    expect(r.code).toBe(1);
    expect(r.errors[0]).toMatch(/has no satcat\.csv/);
  });
  it('another required file missing is named', () => {
    setUp('2026-11-20', (d) => rmSync(join(d, 'table-gpz.csv')));
    expect(run([]).errors[0]).toMatch(/has no table-gpz\.csv/);
  });
  it('a sha256 mismatch', () => {
    const dir = setUp('2026-11-20', (d) => writeFileSync(join(d, 'satcat.csv'), readFileSync(join(d, 'satcat.csv'), 'utf8') + 'x\n'));
    const r = run([]);
    expect(r.code).toBe(1);
    expect(r.errors[0]).toMatch(/sha256 mismatch for satcat\.csv/);
    expect(r.errors[0]).toContain(sha(join(dir, 'satcat.csv')));
    expect(existsSync(registerPath())).toBe(false);
  });
  it('an unreadable manifest', () => {
    setUp('2026-11-20', (d) => writeFileSync(join(d, 'manifest.json'), '{ not json'));
    // setUp rewrites the manifest after edit, so break it afterwards.
    writeFileSync(join(tmp, 'data/raw/2026-11-20/manifest.json'), '{ not json');
    expect(run(['--set', 'data/raw/2026-11-20']).code).toBe(1);
  });
  it('a set with no usable date', () => {
    setUp('fixture-set', (_d, m) => { delete m.startedAt; });
    const r = run(['--set', 'data/raw/fixture-set']);
    expect(r.code).toBe(1);
    expect(r.errors[0]).toMatch(/snapshot date/);
  });
  it('never calls fetch, in any of these cases', () => {
    setUp('2026-11-20', (_d, m) => { m.complete = false; });
    run([]);
    expect(fetchCalls).toBe(0);
  });
});

describe('arguments', () => {
  it('an unknown flag or a flag with no value exits 2', () => {
    expect(run(['--nope', 'x']).code).toBe(2);
    expect(run(['--set']).code).toBe(2);
  });
});

describe('which set is used', () => {
  it('takes the newest complete set, skipping a newer incomplete one', () => {
    setUp('2026-11-18');
    setUp('2026-11-19', (_d, m) => { m.complete = false; });
    const r = run([]);
    expect(r.code).toBe(0);
    expect(JSON.parse(readFileSync(registerPath(), 'utf8')).snapshot.set).toBe('2026-11-18');
  });
  it('takes the newest set when it is complete', () => {
    setUp('2026-11-18');
    setUp('2026-11-19');
    run([]);
    expect(JSON.parse(readFileSync(registerPath(), 'utf8')).snapshot.set).toBe('2026-11-19');
  });
  it('snapshotDate comes from the folder name, not the manifest', () => {
    setUp('2026-03-04');
    run([]);
    const reg = JSON.parse(readFileSync(registerPath(), 'utf8'));
    expect(reg.snapshot.set).toBe('2026-03-04');
    expect(reg.census.snapshotDate).toBe('2026-03-04');
  });
  it('a folder that is not a date falls back to the manifest startedAt date', () => {
    setUp('fixture-set');
    run(['--set', 'data/raw/fixture-set']);
    expect(JSON.parse(readFileSync(registerPath(), 'utf8')).snapshot.set).toBe('2026-11-20');
  });
  it('ignores failed manifest entries and uses the last 200 entry for a file', () => {
    setUp('2026-11-20', (_d, m) => {
      const good = m.entries.find((e) => e['file'] === 'satcat.csv')!;
      m.entries.unshift({ file: 'satcat.csv', url: 'u', httpStatus: 200, sha256: 'stale', fetchedAt: 'old', bytes: 1 });
      m.entries.push({ file: 'satcat.csv', url: 'u', fetchedAt: 'x', sha256: null, error: 'TypeError: terminated' });
      expect(good).toBeDefined();
    });
    expect(run([]).code).toBe(0);
  });
});

describe('the register', () => {
  it('has the fixed top-level keys, the sources from the manifest and the config', () => {
    setUp();
    expect(run([]).code).toBe(0);
    const reg = JSON.parse(readFileSync(registerPath(), 'utf8'));
    expect(Object.keys(reg)).toEqual(['schema', 'sample', 'snapshot', 'config', 'records', 'rejections', 'noOrbitDataCount', 'census', 'causes']);
    expect(reg.schema).toBe(1);
    expect(reg.sample).toBe(false);
    const manifest = JSON.parse(readFileSync(join(FIXTURE_SET, 'manifest.json'), 'utf8'));
    expect(reg.snapshot.sources.map((s: { file: string }) => s.file)).toEqual(['satcat.csv', 'gpz.csv', 'table-gpz.csv']);
    for (const s of reg.snapshot.sources) {
      const e = manifest.entries.find((x: { file: string }) => x.file === s.file);
      expect(s).toEqual({ file: e.file, url: e.url, fetchedAt: e.fetchedAt, sha256: e.sha256, bytes: e.bytes });
    }
    expect(reg.config).toEqual(JSON.parse(JSON.stringify(CONFIG)));
    expect([reg.config.thresholdLowKm, reg.config.thresholdHighKm]).toEqual([247, 280]);
    expect(reg.census.population.total).toBe(reg.records.length);
    expect(reg.rejections).toHaveLength(6);
    expect(reg.noOrbitDataCount).toBe(2);
    const ids = reg.records.map((r: { norad: number }) => r.norad);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
  });
  it('sets caseFile from <norad>.md files and ignores other files and unknown ids', () => {
    setUp();
    const cases = join(tmp, 'cases');
    mkdirSync(cases);
    for (const f of ['27378.md', '90002.md', '123456.md', 'notes.md', '27378.txt']) writeFileSync(join(cases, f), 'x');
    expect(run(['--cases', 'cases']).code).toBe(0);
    const reg = JSON.parse(readFileSync(registerPath(), 'utf8'));
    const flagged = reg.records.filter((r: { caseFile: boolean }) => r.caseFile).map((r: { norad: number }) => r.norad);
    expect(flagged).toEqual([27378, 90002]);
  });
  it('has no case files when the cases folder is missing', () => {
    setUp();
    expect(run(['--cases', 'nowhere']).code).toBe(0);
    const reg = JSON.parse(readFileSync(registerPath(), 'utf8'));
    expect(reg.records.some((r: { caseFile: boolean }) => r.caseFile)).toBe(false);
  });
  it('two runs give byte-identical output', () => {
    setUp();
    expect(run(['--out', 'a.json']).code).toBe(0);
    expect(run(['--out', 'b.json']).code).toBe(0);
    const a = readFileSync(join(tmp, 'a.json'));
    const b = readFileSync(join(tmp, 'b.json'));
    expect(a.equals(b)).toBe(true);
    expect(a.length).toBeGreaterThan(1000);
    expect(a.toString('utf8').endsWith('}\n')).toBe(true);
  });
  it('does not depend on when it is run', () => {
    setUp();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
    run(['--out', 'a.json']);
    vi.setSystemTime(new Date('2040-06-06T00:00:00Z'));
    run(['--out', 'b.json']);
    vi.useRealTimers();
    expect(readFileSync(join(tmp, 'a.json'), 'utf8')).toBe(readFileSync(join(tmp, 'b.json'), 'utf8'));
  });
});

describe('fixture register', () => {
  it('test/fixtures/register.json is up to date', () => {
    const r = run(['--set', FIXTURE_SET, '--out', 'fixture.json', '--cases', join(ROOT, 'test/fixtures/cases')]);
    expect(r.code).toBe(0);
    const fresh = readFileSync(join(tmp, 'fixture.json'), 'utf8');
    const committed = readFileSync(FIXTURE_REGISTER, 'utf8');
    expect(fresh === committed, `register.json is stale. Run: ${REBUILD}`).toBe(true);
  });
});
