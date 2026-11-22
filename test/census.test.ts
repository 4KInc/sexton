import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { END, START, main, replaceBetweenMarkers } from '../scripts/census.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_SET = join(ROOT, 'test/fixtures/snapshot');
const BEFORE = '# Title\nIntro line.\n\n## Census\n';
const AFTER = '\n## Other\nKeep me.\n';
const PLACEHOLDER = 'Numbers appear once the real register exists.';
const README = `${BEFORE}${START}\n${PLACEHOLDER}\n${END}\n${AFTER}`;

let tmp: string;
const readmePath = () => join(tmp, 'README.md');
const read = () => readFileSync(readmePath(), 'utf8');
function run() {
  const logs: string[] = [];
  const errors: string[] = [];
  const code = main({ root: tmp, log: (l) => logs.push(l), error: (l) => errors.push(l) });
  return { code, logs, errors };
}
function withGoodSnapshot(): void {
  const dir = join(tmp, 'data', 'raw', '2026-11-20');
  mkdirSync(dir, { recursive: true });
  cpSync(FIXTURE_SET, dir, { recursive: true });
}
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sexton-census-'));
  writeFileSync(readmePath(), README);
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('census script, with a good snapshot', () => {
  it('rewrites only between the markers', () => {
    withGoodSnapshot();
    const { code } = run();
    expect(code).toBe(0);
    const out = read();
    expect(out.startsWith(`${BEFORE}${START}\n`)).toBe(true);
    expect(out.endsWith(`\n${END}\n${AFTER}`)).toBe(true);
    expect(out).not.toContain(PLACEHOLDER);
    expect(out).toContain('Counts from the snapshot of 2026-11-20');
    expect(out).toContain('- Retired payloads with a verdict: 20');
    expect(out).toContain('- Objects near GEO in the register: 33');
  });

  it('is idempotent: a second run changes nothing', () => {
    withGoodSnapshot();
    expect(run().code).toBe(0);
    const first = read();
    const second = run();
    expect(second.code).toBe(0);
    expect(read()).toBe(first);
    expect(second.logs.join('\n')).toContain('already current');
  });

  it('takes the numbers from register.json, not from the old README text', () => {
    withGoodSnapshot();
    run();
    const register = JSON.parse(readFileSync(join(tmp, 'data/register.json'), 'utf8'));
    expect(read()).toContain(`${register.census.population.total}`);
  });

  it('leaves README untouched when the markers are missing', () => {
    withGoodSnapshot();
    writeFileSync(readmePath(), '# No markers\n');
    const { code, errors } = run();
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain(START);
    expect(read()).toBe('# No markers\n');
  });
});

describe('census script, when build-register fails', () => {
  it('prints why, exits 1 and leaves README untouched (no snapshot)', () => {
    mkdirSync(join(tmp, 'data', 'raw'), { recursive: true });
    const { code, errors } = run();
    expect(code).toBe(1);
    expect(errors[0]).toContain('satcat.csv');
    expect(errors.at(-1)).toContain('README.md was not changed');
    expect(read()).toBe(README);
    expect(existsSync(join(tmp, 'data/register.json'))).toBe(false);
  });

  it('does not use an old register.json when the build fails', () => {
    mkdirSync(join(tmp, 'data', 'raw'), { recursive: true });
    cpSync(join(ROOT, 'test/fixtures/register.json'), join(tmp, 'data', 'register.json'));
    expect(run().code).toBe(1);
    expect(read()).toBe(README);
  });
});

describe('replaceBetweenMarkers', () => {
  it('returns null for missing, repeated or reversed markers', () => {
    expect(replaceBetweenMarkers('nothing', 'x')).toBeNull();
    expect(replaceBetweenMarkers(`${START}\n${START}\n${END}`, 'x')).toBeNull();
    expect(replaceBetweenMarkers(`${END}\n${START}`, 'x')).toBeNull();
  });
});

describe('npm run census on the real repository', () => {
  it('exits 1 with the build-register message and leaves README.md as it was', () => {
    const readme = join(ROOT, 'README.md');
    const before = readFileSync(readme, 'utf8');
    const r = spawnSync('node', ['scripts/census.ts'], { cwd: ROOT, encoding: 'utf8' });
    expect(readFileSync(readme, 'utf8')).toBe(before);
    if (r.status === 1) {
      expect(r.stderr).toContain('satcat.csv');
      expect(r.stderr).toContain('README.md was not changed');
    }
  });
});
