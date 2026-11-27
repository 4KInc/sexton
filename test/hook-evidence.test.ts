// R18.5: the evidence table in the journal covers every hook in .kiro/hooks, and a "seen" row has what R18.2 asks for.
// It runs no hook, so it needs no Kiro.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

export interface HookRow {
  file: string;
  hook: string;
  date: string;
  client: string;
  action: string;
  where: string;
  output: string;
  state: string;
}
/** The rows of the evidence table: lines of the table under "### Evidence table (R18, task 35)" that start with a file name in backticks. */
export function evidenceRows(journal: string): HookRow[] {
  const start = journal.indexOf('### Evidence table (R18');
  if (start < 0) return [];
  const rows: HookRow[] = [];
  for (const line of journal.slice(start).split('\n')) {
    if (!line.startsWith('| `')) continue;
    const c = line.slice(2, -2).split(' | ');
    if (c.length !== 8) continue;
    rows.push({ file: c[0]!.replace(/`/g, ''), hook: c[1]!, date: c[2]!, client: c[3]!, action: c[4]!, where: c[5]!, output: c[6]!, state: c[7]! });
  }
  return rows;
}
/** What is wrong with the table, given the hooks that exist. Empty means it is fine. */
export function evidenceProblems(hooks: readonly { file: string; name: string }[], rows: readonly HookRow[]): string[] {
  const out: string[] = [];
  for (const h of hooks) if (!rows.some((r) => r.file === h.file && (r.hook === h.name || r.hook.startsWith(`${h.name} (`)))) out.push(`no row for ${h.file}: ${h.name}`);
  for (const r of rows) {
    if (!hooks.some((h) => h.file === r.file && (r.hook === h.name || r.hook.startsWith(`${h.name} (`)))) out.push(`row names a hook that does not exist: ${r.file}: ${r.hook}`);
    if (r.state === 'seen') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) out.push(`seen row without a date: ${r.hook}`);
      if (!/`[^`]+`/.test(r.output)) out.push(`seen row without a quoted output: ${r.hook}`);
      if (r.client.trim() === '' || r.action.trim() === '' || r.where.trim() === '') out.push(`seen row with an empty field: ${r.hook}`);
    } else if (r.state !== 'not yet seen') out.push(`unknown state "${r.state}": ${r.hook}`);
  }
  return out;
}
const hookFiles = readdirSync(join(ROOT, '.kiro/hooks')).filter((n) => n.endsWith('.json'));
const hooks = hookFiles.flatMap((f) => (JSON.parse(read(`.kiro/hooks/${f}`)) as { hooks: { name: string }[] }).hooks.map((h) => ({ file: f, name: h.name })));
const rows = evidenceRows(read('docs/kiro-journal.md'));

describe('the hook evidence table', () => {
  it('has a row for every hook in .kiro/hooks, and none for a hook that is gone', () => {
    expect(hooks).toHaveLength(4);
    expect(evidenceProblems(hooks, rows)).toEqual([]);
  });
  it('shows a run that passes for every hook, and a run that fails for at least one', () => {
    for (const h of hooks) expect(rows.filter((r) => r.file === h.file && r.hook === h.name).length, h.name).toBeGreaterThan(0);
    expect(rows.some((r) => /failing run/.test(r.hook))).toBe(true);
  });
  it('is honest: no row is "seen" while its output is "not returned to the agent"', () => {
    for (const r of rows) if (/not returned/.test(r.output)) expect(r.state, r.hook).toBe('not yet seen');
  });
  it('fails when a hook has no row', () => {
    expect(evidenceProblems([...hooks, { file: 'new.json', name: 'A new hook' }], rows)).toEqual(['no row for new.json: A new hook']);
  });
  it('fails when a row names a hook that no longer exists', () => {
    expect(evidenceProblems(hooks.slice(1), rows).some((p) => p.startsWith('row names a hook that does not exist'))).toBe(true);
  });
  it('fails when a "seen" row lacks a date or a quoted output', () => {
    const seen = { ...rows[0]!, state: 'seen', date: '2026-11-27', output: '`Language check passed.`' };
    expect(evidenceProblems(hooks, [...rows, seen])).toEqual([]);
    expect(evidenceProblems(hooks, [...rows, { ...seen, date: 'later' }]).join()).toContain('seen row without a date');
    expect(evidenceProblems(hooks, [...rows, { ...seen, output: 'it passed' }]).join()).toContain('seen row without a quoted output');
  });
});
