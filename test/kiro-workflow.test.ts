// The Kiro CLI workflow (polish step 5). It cannot be run here: it needs the KIRO_API_KEY secret.
// These tests check its shape: manual only, pinned, least privilege, and a decision that does not rest on the model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const text = readFileSync(join(ROOT, '.github/workflows/kiro-verify.yml'), 'utf8');
const wf = parse(text) as Record<string, any>;
const steps = Object.values(wf.jobs as Record<string, any>).flatMap((j) => j.steps as Record<string, any>[]);

describe('kiro-verify.yml', () => {
  it('runs only on workflow_dispatch', () => {
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
    expect(text).not.toMatch(/\bcron:|^\s*push:|^\s*pull_request/m);
  });
  it('pins every action by a commit SHA and asks for read access only', () => {
    for (const s of steps) if (s.uses !== undefined) expect(String(s.uses)).toMatch(/@[0-9a-f]{40}$/);
    expect(wf.permissions).toBeUndefined();
    expect((Object.values(wf.jobs)[0] as any).permissions).toEqual({ contents: 'read' });
  });
  it('keeps the API key in a repository secret and never writes it into the file', () => {
    expect(text).toContain('${{ secrets.KIRO_API_KEY }}');
    expect(text).not.toMatch(/KIRO_API_KEY:\s*[^$\s]/);
  });
  it('runs Kiro headless with named harness and scoped tools, not all tools', () => {
    const run = steps.map((s) => String(s.run ?? '')).join('\n');
    expect(run).toMatch(/kiro-cli chat --v3 --no-interactive --trust-tools=/);
    expect(run).not.toMatch(/--trust-all-tools/);
  });
  it('fails on any difference by running the tests and diffing the committed files itself', () => {
    const run = steps.map((s) => String(s.run ?? ''));
    expect(run.some((r) => r.trim() === 'npm test')).toBe(true);
    expect(run.some((r) => /npm run census/.test(r) && /git diff --exit-code -- README\.md data\/register\.json/.test(r))).toBe(true);
    expect(text).not.toMatch(/continue-on-error/);
  });
});
