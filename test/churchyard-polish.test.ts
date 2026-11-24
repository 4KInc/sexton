// Polish step 3: the caption, the tooltip text, the ring and the era mark on the churchyard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { findHits } from '../scripts/check-language.ts';
import { CHURCHYARD_INTRO, LEGEND, TIP } from '../src/ui/copy.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { chartSvg, introHtml, isFlagged, legendHtml, retiredPayloads, tipHtml } from '../src/ui/views/churchyard.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
const retired = retiredPayloads(real.records);
const text = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('caption and legend', () => {
  it('the caption says what height, the road and the zone mean, without judging', () => {
    expect(CHURCHYARD_INTRO.lead).toMatch(/perigee above GEO/);
    expect(CHURCHYARD_INTRO.lead).toMatch(/road is the protected zone/);
    expect(findHits(CHURCHYARD_INTRO.lead, 'lead')).toEqual([]);
    expect(text(introHtml(real))).toContain(CHURCHYARD_INTRO.lead);
  });
  it('the legend explains the faint stone, the ring and the name, and still lists all six verdicts', () => {
    const html = legendHtml(real.config);
    for (const line of [LEGEND.early, LEGEND.ring, LEGEND.named]) expect(text(html)).toContain(line);
    for (const v of ['Fallen', 'Unquiet', 'Shallow grave', 'Restless', 'Uncertain', 'Buried']) expect(html).toContain(v);
    expect(text(html)).toContain('within 25 km of a band edge');
  });
});

describe('the tooltip text', () => {
  it('EchoStar-7: name, NORAD id, perigee with the uncertainty, verdict word', () => {
    const r = retired.find((x) => x.norad === 27378)!;
    const t = text(tipHtml(r, real.config));
    expect(t).toContain('ECHOSTAR 7');
    expect(t).toContain('NORAD 27378');
    expect(t).toContain('Perigee 110.1 km above GEO, ±25 km');
    expect(t).toContain('Unquiet');
    expect(t).toContain(TIP.open);
  });
  it('a perigee below GEO says below, and the text carries no banned stem', () => {
    const r = retired.find((x) => x.pKm < 0)!;
    expect(text(tipHtml(r, real.config))).toContain('km below GEO');
    expect(findHits(text(tipHtml(r, real.config)), 'tip')).toEqual([]);
  });
  it('property: every stone has a tooltip with its id and ±25 km, and escapes its name', () => {
    fc.assert(
      fc.property(fc.constantFrom(...retired), (r) => {
        const html = tipHtml({ ...r, name: `${r.name}<b>"&` }, real.config);
        return html.includes(`NORAD ${r.norad}`) && html.includes('±25 km') && !html.includes('<b>');
      }),
      { numRuns: 100 },
    );
  });
});

describe('ring, faint stones and names on the real register', () => {
  const svg = chartSvg(real, false);
  it('a ring is drawn for exactly the stones launched on or after the rule date and below the threshold', () => {
    const flagged = retired.filter(isFlagged);
    expect(flagged.length).toBe(36);
    for (const r of retired) expect(isFlagged(r)).toBe(r.verdict.era === null && ['fallen', 'unquiet', 'shallow grave'].includes(r.verdict.verdict));
    expect(svg.match(/class="flag-ring"/g)?.length).toBe(flagged.length);
  });
  it('a faint mark is drawn for exactly the stones launched before the rule date', () => {
    const early = retired.filter((r) => r.verdict.era === 'before FCC rule').length;
    expect(early).toBe(565);
    expect(svg.match(/stone-pos stone-pos--early/g)?.length).toBe(early);
  });
  it('the stones with a case file carry their name', () => {
    const withFile = retired.filter((r) => r.caseFile);
    expect(withFile.length).toBe(3);
    expect(svg.match(/class="stone-name"/g)?.length).toBe(3);
    expect(svg).toContain('>ECHOSTAR 7</text>');
  });
});

describe('first paint', () => {
  it('index.html asks the browser to start the register fetch early', () => {
    expect(readFileSync(join(ROOT, 'index.html'), 'utf8')).toMatch(/<link rel="preload" as="fetch" href="%BASE_URL%register\.json"/);
  });
});
