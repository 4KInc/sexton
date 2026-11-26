// A lazily loaded view that fails to load shows a short message with a retry link, not a blank page.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE } from '../src/ui/copy.ts';
import { loadFailedHtml, runLazy } from '../src/ui/lazy.ts';
describe('runLazy', () => {
  const run = async (load: () => Promise<() => () => void>, current = true) => {
    const seen = { done: 0, fail: [] as string[] };
    await runLazy(load, () => current, () => void seen.done++, (html) => void seen.fail.push(html), '#/method');
    return seen;
  };
  it('mounts the view when the code loads', async () => {
    let mounted = 0;
    const seen = await run(() => Promise.resolve(() => (mounted++, () => {})));
    expect(seen).toEqual({ done: 1, fail: [] });
    expect(mounted).toBe(1);
  });
  it('shows the message with a retry link when the code does not load', async () => {
    const seen = await run(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    expect(seen.done).toBe(0);
    expect(seen.fail).toHaveLength(1);
    expect(seen.fail[0]).toContain(SITE.viewLoadError);
    expect(seen.fail[0]).toMatch(/<a href="#\/method" data-retry>Try again<\/a>/);
    expect(seen.fail[0]).toContain('role="alert"');
  });
  it('does nothing, on success or failure, when the reader has moved on', async () => {
    expect(await run(() => Promise.resolve(() => () => {}), false)).toEqual({ done: 0, fail: [] });
    expect(await run(() => Promise.reject(new Error('x')), false)).toEqual({ done: 0, fail: [] });
  });
  it('escapes the address in the link, and falls back to the churchyard', () => {
    expect(loadFailedHtml('#/a"b')).not.toContain('"b"');
    expect(loadFailedHtml('')).toContain('href="#/"');
  });
  it('the app loads the ledger and the method page through it', () => {
    const main = readFileSync(new URL('../src/ui/main.ts', import.meta.url), 'utf8');
    expect(main).toContain("import('./views/ledger.ts')");
    expect(main).toContain("import('./views/method.ts')");
    expect(main).toContain('runLazy(');
  });
});
