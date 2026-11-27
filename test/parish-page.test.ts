// The parish pages (R13, task 24): routes, the table's operator filter, counts that link to the table, assumptions beside every count,
// no ranking, no retirement date, CSV and JSON with the assumptions on every row.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { OWNER_NOT_GIVEN, parishGroups, parishOf } from '../src/engine/parish.ts';
import { parseCsv } from '../src/engine/csv.ts';
import { NAV, VERDICT_ORDER } from '../src/ui/copy.ts';
import { PARISH } from '../src/ui/parish-copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { parseHash } from '../src/ui/router.ts';
import { applyFilters, hashFor, parseFilters, parseState, toQuery } from '../src/ui/state.ts';
import { operatorCoverageHtml } from '../src/ui/views/census.ts';
import { parishCsv, parishFileName, parishHash, parishIndexHtml, parishJson, parishPageHtml } from '../src/ui/views/parish.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const text = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const groups = parishGroups(real.records);
const all = [...groups.operators.map((g) => ({ scope: 'operator' as const, key: g.key })), ...groups.owners.map((g) => ({ scope: 'owner' as const, key: g.key }))];

describe('routes', () => {
  it('every operator name and owner code in the real register round-trips through the address', () => {
    expect(all.length).toBeGreaterThan(50);
    for (const g of all) {
      const route = parseHash(parishHash(g.scope, g.key));
      expect(route, `${g.scope} ${g.key}`).toMatchObject({ name: 'parish', scope: g.scope, key: g.key });
    }
  });
  it('property: any name round-trips, including slashes, question marks, hashes, percent signs and spaces', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.constantFrom('operator' as const, 'owner' as const), (key, scope) => {
        const route = parseHash(parishHash(scope, key));
        return route.name === 'parish' && route.scope === scope && route.key === key;
      }),
    );
  });
  it('knows the list, and rejects a bad address', () => {
    expect(parseHash('#/parish')).toMatchObject({ name: 'parish', scope: 'index' });
    for (const bad of ['#/parish/op', '#/parish/op/', '#/parish/owner/%E0%A4%A', '#/parish/other/x', '#/parish/op/a/b']) expect(parseHash(bad).name, bad).toBe('notfound');
  });
  it('the nav has one Parish item, after the census', () => {
    expect(NAV.map((n) => n.label)).toEqual(['Churchyard', 'Table', 'Census', 'Parish', 'Method']);
    expect(NAV.find((n) => n.route === 'parish')!.href).toBe('#/parish');
  });
});

describe('the table\u2019s operator filter', () => {
  it('reads operator= from the address, keeps it in the canonical query, and filters to that operator', () => {
    const f = parseFilters(new URLSearchParams({ operator: 'JAXA', verdict: 'unquiet' }));
    expect(f.operator).toBe('JAXA');
    expect(toQuery(parseState(new URLSearchParams('operator=JAXA&verdict=unquiet'))).toString()).toBe('operator=JAXA&verdict=unquiet');
    const rows = applyFilters(real.records, f);
    expect(rows.map((r) => r.norad)).toEqual([32500]);
  });
  it('a record with no sourced operator is never matched', () => {
    expect(applyFilters(real.records, { ...parseFilters(new URLSearchParams()), operator: 'null' })).toEqual([]);
  });
});

describe('every group page', () => {
  it('has all six verdicts, each count written "n of N" and linking to a table with that many rows', () => {
    for (const g of all) {
      const html = parishPageHtml(real, g.scope, g.key);
      const page = parishOf(real.records, { kind: g.scope, key: g.key });
      for (const v of VERDICT_ORDER) {
        const m = new RegExp(`data-parish-count="${v}"><a href="([^"]+)">([^<]+)</a>`).exec(html);
        expect(m, `${g.key} ${v}`).not.toBeNull();
        expect(m![2]).toBe(`${page.byVerdict[v]} of ${page.total}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
        const query = new URLSearchParams(m![1]!.replace(/^#\/table\??/, '').replace(/&amp;/g, '&'));
        expect(applyFilters(real.records, parseFilters(query)).length, `${g.key} ${v}`).toBe(page.byVerdict[v]);
      }
    }
  });
  it('the era links land on a table with that many rows', () => {
    for (const g of all.slice(0, 40)) {
      const html = parishPageHtml(real, g.scope, g.key);
      const page = parishOf(real.records, { kind: g.scope, key: g.key });
      const want = { before: page.era.beforeRule, after: page.era.onOrAfterRule, unknown: page.era.unknown };
      for (const [era, n] of Object.entries(want)) {
        const m = new RegExp(`<a href="([^"]+)" data-parish-era="${era}">`).exec(html);
        const query = new URLSearchParams(m![1]!.replace(/^#\/table\??/, '').replace(/&amp;/g, '&'));
        expect(applyFilters(real.records, parseFilters(query)).length, `${g.key} ${era}`).toBe(n);
      }
    }
  });
  it('shows the snapshot date, the C_R·A/m range, the ±25 km uncertainty and the data age beside the counts', () => {
    for (const g of all) {
      const t = text(parishPageHtml(real, g.scope, g.key));
      expect(t, g.key).toContain('Snapshot: 22 Nov 2026.');
      expect(t, g.key).toContain('C_R·A/m from 0.012 to 0.045 m²/kg');
      expect(t, g.key).toContain('±25 km');
      expect(t, g.key).toMatch(/Data age: (GP mean elements, epochs? |SATCAT, element date not given)/);
    }
  });
  it('says the register sees only objects near GEO, that the IADC guidelines are voluntary and that the FCC rule covers only what it authorizes', () => {
    const t = text(parishPageHtml(real, 'owner', 'US'));
    expect(t).toContain('only sees objects still near GEO');
    expect(t).toContain('The IADC guidelines are voluntary');
    expect(t).toContain('applies only to satellites the FCC authorizes, launched on or after 18 March 2002');
  });
  it('passes the language check, and has no ranking or score wording', () => {
    for (const g of all) {
      const t = text(parishPageHtml(real, g.scope, g.key));
      expect(findHits(t, 'parish.html'), g.key).toEqual([]);
      expect(t, g.key).not.toMatch(/\b(rank|ranks|ranked|ranking|score|scores|grade|grades|best|worst|league|top)\b/i);
      expect(t, g.key).not.toMatch(/%/);
    }
    for (const t of [text(parishIndexHtml(real))]) {
      expect(findHits(t, 'parish-index.html')).toEqual([]);
      expect(t).not.toMatch(/\b(rank|ranking|score|grade|best|worst|league|top)\b|%/i);
    }
  });
  it('states no retirement date', () => {
    for (const g of all) {
      const t = text(parishPageHtml(real, g.scope, g.key)).replace(/https?:\/\/\S+/g, '');
      for (const sentence of t.split(/(?<=[a-z)])\.\s/)) if (/retir/i.test(sentence) && !/retired payloads?\b/i.test(sentence)) expect(sentence).not.toMatch(/\b(19|20)\d\d\b/);
      expect(t).not.toMatch(/retired (in|on|at|by)\b|retirement date/i);
    }
  });
  it('an owner page says SATCAT\u2019s field may not name the operator, and an operator page links its source on every row', () => {
    expect(text(parishPageHtml(real, 'owner', 'JPN'))).toContain('It may name a country or an organisation, and not the operator.');
    const op = parishPageHtml(real, 'operator', 'Intelsat');
    const page = parishOf(real.records, { kind: 'operator', key: 'Intelsat' });
    expect(page.total).toBe(2);
    expect(op.match(/rel="noopener noreferrer">Operator source</g)).toHaveLength(2);
    expect(text(op)).toContain('2 retired payloads launched on or after 18 March 2002 are here because a source that was opened names this operator.');
  });
  it('the unknown owner has a page, titled "Owner not given", and a group with no payload gets one sentence and a link to the list', () => {
    // The 2026-11-22 register has no retired payload without an owner, so the page says so. A register with one gets the full page.
    expect(text(parishPageHtml(real, 'owner', OWNER_NOT_GIVEN))).toContain('The register has no retired payloads for SATCAT owner (country or organisation): Owner not given.');
    const withOne: UiRegister = { ...real, records: real.records.map((r) => (r.norad === 32500 ? { ...r, owner: null } : r)) };
    expect(text(parishPageHtml(withOne, 'owner', OWNER_NOT_GIVEN))).toContain('SATCAT gives no owner for these payloads.');
    expect(parishIndexHtml(withOne)).toContain('Owner not given');
    const none = parishPageHtml(real, 'owner', 'NO-SUCH');
    expect(text(none)).toContain('The register has no retired payloads for SATCAT owner (country or organisation): NO-SUCH.');
    expect(none).toContain('href="#/parish"');
  });
});

describe('the list', () => {
  it('has the two kinds apart, each alphabetical, with counts only', () => {
    const html = parishIndexHtml(real);
    expect(html.indexOf('Operator (sourced)')).toBeLessThan(html.indexOf('SATCAT owner (country or organisation)'));
    const names = (kind: string): string[] => [...html.slice(html.indexOf(`data-parish="${kind}"`)).split('</ul>')[0]!.matchAll(/<li><a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]!.toLowerCase());
    expect(names('operators')).toEqual([...names('operators')].sort());
    expect(names('operators')).toHaveLength(groups.operators.length);
    expect(names('owners')).toHaveLength(groups.owners.length);
  });
});

describe('the downloads', () => {
  it('the CSV has one line per payload, and the snapshot, the assumptions, the data age, the operator and its source on every line', () => {
    for (const g of [{ scope: 'operator' as const, key: 'Intelsat' }, { scope: 'owner' as const, key: 'JPN' }, { scope: 'owner' as const, key: 'US' }]) {
      const rows = parseCsv(parishCsv(real, g.scope, g.key));
      const page = parishOf(real.records, { kind: g.scope, key: g.key });
      expect(rows[0]!.fields[0]).toContain('C_R·A/m');
      expect(rows[0]!.fields[0]).toContain('The IADC guidelines are voluntary');
      expect(rows[1]!.fields).toEqual([...PARISH.csvColumns]);
      expect(rows).toHaveLength(page.total + 2);
      const col = (name: string): number => PARISH.csvColumns.indexOf(name as (typeof PARISH.csvColumns)[number]);
      for (const r of rows.slice(2)) {
        expect(r.fields).toHaveLength(PARISH.csvColumns.length);
        expect(r.fields[col('Snapshot')]).toBe('2026-11-22');
        expect(r.fields[col('C_R·A/m range (m²/kg)')]).toBe('0.012 to 0.045');
        expect(r.fields[col('Mean-element uncertainty (km)')]).toBe('25');
        expect(r.fields[col('Data age')]).not.toBe('');
        if (g.scope === 'operator') expect(r.fields[col('Operator source')]).toMatch(/^https?:\/\//);
      }
    }
  });
  it('the JSON carries the snapshot, the assumptions, the notes and each row\u2019s operator source', () => {
    const j = JSON.parse(parishJson(real, 'operator', 'JAXA')) as { snapshot: string; assumptions: { crAmRangeM2PerKg: number[] }; notes: string[]; rows: { operator: { source: string } | null }[] };
    expect(j.snapshot).toBe('2026-11-22');
    expect(j.assumptions.crAmRangeM2PerKg).toEqual([0.012, 0.045]);
    expect(j.notes.join(' ')).toContain('voluntary');
    expect(j.rows[0]!.operator!.source).toMatch(/^https:\/\//);
  });
  it('file names are plain', () => {
    expect(parishFileName('operator', 'RSCC (Russian Satellite Communications Company)', '2026-11-22', 'csv')).toBe('sexton-parish-operator-RSCC-Russian-Satellite-Communications-Company-2026-11-22.csv');
  });
});

describe('the census coverage line', () => {
  it('reads "Operator sourced for 19 of 131", with both numbers counted from the records', () => {
    expect(text(operatorCoverageHtml(real.records))).toContain('Operator sourced for 19 of 131 retired payloads launched on or after 18 March 2002.');
    expect(operatorCoverageHtml(real.records)).toContain('href="#/parish"');
    expect(hashFor('table', parseState(new URLSearchParams('operator=JAXA')))).toBe('#/table?operator=JAXA');
  });
});
