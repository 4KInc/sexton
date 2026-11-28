// Cause counts beside verdict counts, and the Intelsat to ITSO mapping (context fix after R17).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { pathsFor, parish } from '../scripts/mcp/tools.ts';
import { CAUSE_CATEGORIES } from '../src/engine/causes.ts';
import { OPERATOR_OWNER_CODE, operatorOfOwner, ownerCodeOf } from '../src/engine/operator-owners.ts';
import { parishGroups, parishOf } from '../src/engine/parish.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { parishCsv, parishPageHtml } from '../src/ui/views/parish.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const paths = pathsFor(ROOT);
const groups = parishGroups(real.records);
const all = [...groups.operators.map((g) => ({ kind: 'operator' as const, key: g.key })), ...groups.owners.map((g) => ({ kind: 'owner' as const, key: g.key }))];

describe('the mapping table', () => {
  it('holds Intelsat and ITSO only', () => {
    expect(OPERATOR_OWNER_CODE).toEqual({ Intelsat: 'ITSO' });
    expect(ownerCodeOf('Intelsat')).toBe('ITSO');
    expect(operatorOfOwner('ITSO')).toBe('Intelsat');
    expect(ownerCodeOf('SES')).toBeNull();
    expect(ownerCodeOf('toString')).toBeNull();
    expect(operatorOfOwner('JPN')).toBeNull();
  });
  it('holds in the data: every sourced Intelsat payload has the owner ITSO', () => {
    for (const [operator, code] of Object.entries(OPERATOR_OWNER_CODE)) {
      const rows = parishOf(real.records, { kind: 'operator', key: operator }).rows;
      expect(rows.length, operator).toBeGreaterThan(0);
      for (const r of rows) expect(r.owner, `${operator} ${r.norad}`).toBe(code);
    }
  });
});

describe('cause counts on every group page', () => {
  it('add up to the group size, in the engine and on the page', () => {
    for (const g of all) {
      const page = parishOf(real.records, g);
      const sum = Object.values(page.byCause).reduce((a, b) => a + b, 0) + page.noCase;
      expect(sum, `${g.kind} ${g.key}`).toBe(page.total);
      const html = parishPageHtml(real, g.kind, g.key);
      const cells = [...html.matchAll(/data-parish-cause="[^"]*">([^<]*)</g)].map((m) => m[1]!);
      expect(cells.length).toBe(CAUSE_CATEGORIES.length + 1);
      for (const c of cells) expect(c).toMatch(new RegExp(` of ${page.total.toLocaleString('en-GB')}$`));
    }
  });
  it('shows Intelsat as 2 of 2 failed in orbit or broke up', () => {
    const html = parishPageHtml(real, 'operator', 'Intelsat');
    expect(html).toMatch(/data-parish-cause="failed in orbit or broke up before disposal">2 of 2</);
    expect(html).toContain('href="#/parish/owner/ITSO"');
  });
  it('shows ITSO with cause counts, mostly without a case file, and a link to the operator group', () => {
    const page = parishOf(real.records, { kind: 'owner', key: 'ITSO' });
    expect(page.total).toBe(60);
    expect(page.byCause['failed in orbit or broke up before disposal']).toBe(2);
    expect(page.noCase).toBe(58);
    expect(parishPageHtml(real, 'owner', 'ITSO')).toContain('href="#/parish/op/Intelsat"');
  });
  it('adds a cause column to the CSV', () => {
    const csv = parishCsv(real, 'operator', 'Intelsat');
    expect(csv).toContain('Cause category');
    expect(csv).toContain('failed in orbit or broke up before disposal');
  });
});

describe('the parish tool with the mapping', () => {
  it('Intelsat returns the operator block and the ITSO owner block, labelled', () => {
    const out = parish(paths, 'Intelsat');
    expect(out.ok).toBe(true);
    expect(out.text).toContain('operator, sourced, launched on or after 18 March 2002: 2 of 2');
    expect(out.text).toContain('SATCAT owner ITSO (country or organisation), all launch years: 60 of 60');
    expect(out.text).toContain('- failed in orbit or broke up before disposal: 2 of 2');
    expect(out.text).toContain('- Unquiet: 24 of 60');
    expect(out.text).toContain('- Buried: 22 of 60');
  });
  it('ITSO returns both blocks too, and a kind returns one', () => {
    expect(parish(paths, 'ITSO').text).toContain('operator, sourced, launched on or after 18 March 2002: 2 of 2');
    const one = parish(paths, 'Intelsat', 'operator').text;
    expect(one).not.toContain('SATCAT owner ITSO (country or organisation), all launch years');
    expect(one).toContain('- failed in orbit or broke up before disposal: 2 of 2');
  });
  it('maps nothing else: JPN and RSCC return one block', () => {
    expect(parish(paths, 'JPN').text).not.toContain('operator, sourced, launched on or after');
    expect(parish(paths, 'RSCC').text).not.toContain('SATCAT owner');
  });
  it('every output has cause counts that add up, and passes the language check', () => {
    for (const g of all) {
      const out = parish(paths, g.key, g.kind);
      const page = parishOf(real.records, g);
      expect(out.text).toContain(`- ${'no case file, or no cause note in it'}: `);
      expect(out.text).toContain(`of ${page.total.toLocaleString('en-GB')}`);
      expect(findHits(out.text, `parish-cause-${g.key}`)).toEqual([]);
    }
  });
});
