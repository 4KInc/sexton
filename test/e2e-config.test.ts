// R15: the browser checks exist, cover every route, and are kept out of `npm test` and out of every push.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseHash } from '../src/ui/router.ts';
import vitestConfig from '../vitest.config.ts';
import { ROUTES, VIEWPORTS } from '../e2e/support.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('e2e.yml', () => {
  const text = read('.github/workflows/e2e.yml');
  const wf = parse(text) as { on: Record<string, unknown>; permissions: Record<string, string>; jobs: Record<string, { steps: { uses?: string; run?: string }[] }> };
  const steps = Object.values(wf.jobs).flatMap((j) => j.steps);
  it('runs only on workflow_dispatch, never on a push or a pull request or a schedule', () => {
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
    expect(text).not.toMatch(/\bcron:|^\s*push:|^\s*pull_request/m);
  });
  it('pins every action by a commit SHA and asks for read access only', () => {
    for (const s of steps) if (s.uses !== undefined) expect(s.uses).toMatch(/@[0-9a-f]{40}( #.*)?$/);
    expect(wf.permissions).toEqual({ contents: 'read' });
  });
  it('installs the three browsers and runs npm run test:e2e', () => {
    const run = steps.map((s) => s.run ?? '').join('\n');
    expect(run).toContain('npx playwright install --with-deps chromium firefox webkit');
    expect(run).toContain('npm run test:e2e');
  });
  it('no other workflow runs the browser checks', () => {
    for (const f of readdirSync(join(ROOT, '.github/workflows')).filter((n) => n !== 'e2e.yml')) expect(read(`.github/workflows/${f}`), f).not.toMatch(/playwright|test:e2e/);
  });
});

describe('the browser checks are not part of npm test', () => {
  it('npm test does not call Playwright, and Vitest reads only test/', () => {
    expect(pkg.scripts['test']).not.toMatch(/playwright|e2e/);
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
    expect((vitestConfig as { test: { include: string[] } }).test.include).toEqual(['test/**/*.test.ts']);
  });
});

describe('what the browser checks visit', () => {
  it('every kind of route is covered: the churchyard, the table, a ledger, the census, the method page, and the parish list, an operator and an owner code', () => {
    const kinds = new Set(ROUTES.map((r) => { const p = parseHash(r.hash); return p.name === 'parish' ? `parish-${p.scope}` : p.name; }));
    expect(kinds).toEqual(new Set(['churchyard', 'table', 'sat', 'census', 'method', 'parish-index', 'parish-operator', 'parish-owner']));
    for (const r of ROUTES) expect(parseHash(r.hash).name, r.name).not.toBe('notfound');
  });
  it('the operator and the owner it names exist in the register', () => {
    const reg = JSON.parse(read('data/register.json')) as { records: { owner: string | null; operator?: string | null }[] };
    expect(reg.records.some((r) => r.operator === 'Intelsat')).toBe(true);
    expect(reg.records.some((r) => r.owner === 'JPN')).toBe(true);
  });
  it('the sizes are 1440x900, 1024x768 and 390x844', () => {
    expect(VIEWPORTS.map((v) => `${v.width}x${v.height}`)).toEqual(['1440x900', '1024x768', '390x844']);
  });
  it('the Playwright config runs the built site under /sexton/ in the three browsers', () => {
    const cfg = read('playwright.config.ts');
    expect(cfg).toContain("http://localhost:${PORT}/sexton/");
    for (const b of ['chromium', 'firefox', 'webkit']) expect(cfg).toContain(`name: '${b}'`);
    expect(cfg).toContain('npm run build && npx vite preview');
  });
});
