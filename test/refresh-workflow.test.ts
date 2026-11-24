// The snapshot refresh workflow (Task 16, design 8.2, R11) and its PR body script.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildPrBody } from '../scripts/pr-body.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const text = readFileSync(join(ROOT, '.github/workflows/refresh-snapshot.yml'), 'utf8');
const wf = parse(text) as Record<string, any>;
const jobs = Object.values(wf.jobs) as Record<string, any>[];

describe('refresh-snapshot.yml', () => {
  it('runs only on workflow_dispatch', () => {
    // YAML 1.1 readers turn a bare `on` key into true; the yaml package keeps the string.
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
    expect(text).not.toMatch(/^\s*schedule:/m);
    expect(text).not.toMatch(/\bcron:/);
  });
  it('pins every action by a 40-character commit SHA', () => {
    const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/);
    // And through the parsed structure, so a `uses` the regex missed still counts.
    for (const job of jobs) {
      for (const step of job.steps as Record<string, any>[]) {
        if (step.uses !== undefined) expect(String(step.uses)).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });
  it('has no workflow-level permissions, and only contents and pull-requests write on the job', () => {
    expect(wf.permissions).toBeUndefined();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.permissions).toEqual({ contents: 'write', 'pull-requests': 'write' });
  });
  it('sets a concurrency group that does not cancel a running download', () => {
    expect(typeof wf.concurrency.group).toBe('string');
    expect(wf.concurrency.group.length).toBeGreaterThan(0);
    expect(wf.concurrency['cancel-in-progress']).toBe(false);
  });
  it('does not retry', () => {
    expect(text).not.toMatch(/continue-on-error|nick-fields\/retry|\buntil\b|\bwhile\b/);
  });
});

describe('pr-body', () => {
  const manifest = {
    entries: [
      { file: 'gpz.csv', httpStatus: 200, bytes: 10, sha256: 'aa' },
      { file: 'satcat.csv', httpStatus: 200, bytes: 20, sha256: 'bb' },
    ],
  };
  const mk = (set: string, byVerdict: Record<string, number>, total: number) => ({
    snapshot: { set },
    census: { retired: { total, byVerdict } },
  });
  it('lists status, bytes and sha256 per source and the verdict diff', () => {
    const body = buildPrBody(mk('2026-11-22', { buried: 280, unquiet: 312 }, 592), mk('2026-12-01', { buried: 283, unquiet: 310 }, 593), manifest, '2026-12-01');
    expect(body).toContain('| gpz.csv | 200 | 10 | `aa` |');
    expect(body).toContain('| satcat.csv | 200 | 20 | `bb` |');
    expect(body).toContain('| buried | 280 | 283 | +3 |');
    expect(body).toContain('| unquiet | 312 | 310 | -2 |');
    expect(body).toContain('| total | 592 | 593 | +1 |');
    expect(body).not.toContain('not rebuilt');
  });
  it('says so when the register was not rebuilt from the new set', () => {
    const r = mk('2026-11-22', { buried: 1 }, 1);
    expect(buildPrBody(r, r, manifest, '2026-12-01')).toContain('not rebuilt');
  });
});
