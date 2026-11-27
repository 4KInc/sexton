// The operator on the ledger (R13): its name, how the source names it, and a link to the source; "operator not sourced" where null.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { ledgerPageHtml } from '../src/ui/views/ledger.ts';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const text = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const post = real.records.filter((r) => r.operator !== undefined);
describe('the operator on #/sat/<id>', () => {
  it('shows it for each of the 131 post-rule retired payloads: the name, the relation and the source link, or "operator not sourced"', () => {
    expect(post).toHaveLength(131);
    for (const r of post) {
      const html = ledgerPageHtml(real, r.norad, new Map());
      if (typeof r.operator === 'string') {
        expect(html, String(r.norad)).toContain('data-operator="sourced"');
        expect(html, String(r.norad)).toContain(`href="${r.operatorSource!.replace(/&/g, '&amp;')}" rel="noopener noreferrer">Operator source</a>`);
        const shown = text(html);
        expect(shown, String(r.norad)).toContain(r.operatorRelation === 'operator' ? r.operator : `${r.operator} (${r.operatorRelation})`);
      } else {
        expect(html, String(r.norad)).toContain('data-operator="none">operator not sourced<');
        expect(html, String(r.norad)).not.toContain('Operator source');
      }
    }
  });
  it('shows the label as written: ISRO is "listed as owner", SUPARCO a customer, Hispasat "by implication"', () => {
    const t = (n: number): string => text(ledgerPageHtml(real, n, new Map()));
    expect(t(27714)).toContain('ISRO (listed as owner)');
    expect(t(37779)).toContain('SUPARCO (customer (delivered in orbit to SUPARCO))');
    expect(t(27528)).toContain('Hispasat (by implication)');
    expect(t(29155)).toContain('NOAA (operates it; U.S. Space Force mission)');
  });
  it('shows nothing for a payload launched before the FCC rule, which was never looked at', () => {
    const r = real.records.find((x) => x.operator === undefined && x.verdict.kind === 'verdict')!;
    expect(ledgerPageHtml(real, r.norad, new Map())).not.toContain('data-operator');
  });
  it('passes the language check', () => {
    for (const r of post.slice(0, 40)) expect(findHits(text(ledgerPageHtml(real, r.norad, new Map())), `ledger-${r.norad}`)).toEqual([]);
  });
});
