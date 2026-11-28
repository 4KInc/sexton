// Polish step 3: the caption, the tooltip text, the ring and the era mark on the churchyard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { findHits } from '../scripts/check-language.ts';
import { CAUSE_CATEGORIES } from '../src/engine/causes.ts';
import { CHURCHYARD_INTRO, EPITAPH, EPITAPH_REGISTER_READS, LEDGER, LEGEND, SITE, TIP, epitaphOf } from '../src/ui/copy.ts';
import { parseHash } from '../src/ui/router.ts';
import { ledgerHtml } from '../src/ui/views/ledger.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { cardHtml, chartSvg, introHtml, isStory, legendHtml, retiredPayloads, tipHtml } from '../src/ui/views/churchyard.ts';

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
  it('a halo is drawn for exactly the unquiet and shallow-grave stones launched on or after the rule date', () => {
    const story = retired.filter(isStory);
    expect(story.length).toBe(36);
    for (const r of retired) expect(isStory(r)).toBe(r.verdict.era === null && ['unquiet', 'shallow grave'].includes(r.verdict.verdict));
    expect(svg.match(/class="story-halo"/g)?.length).toBe(story.length);
    expect(svg).not.toContain('flag-ring');
  });
  it('a faint mark is drawn for exactly the stones launched before the rule date', () => {
    const early = retired.filter((r) => r.verdict.era === 'before FCC rule').length;
    expect(early).toBe(565);
    expect(svg.match(/stone-pos stone-pos--early/g)?.length).toBe(early);
  });
  it('the stones with a case file carry their name', () => {
    const withFile = retired.filter((r) => r.caseFile);
    // More stones have a case file (R14), but only the three on the list in config.chart.labelledNorads carry a name.
    expect(withFile.length).toBeGreaterThanOrEqual(21);
    expect(real.config.chart.labelledNorads).toEqual([15873, 27378, 40258]);
    expect(svg.match(/class="stone-name"/g)?.length).toBe(3);
    expect(svg).toContain('>ECHOSTAR 7</text>');
  });
});

describe('first paint', () => {
  it('index.html asks the browser to start the register fetch early', () => {
    expect(readFileSync(join(ROOT, 'index.html'), 'utf8')).toMatch(/<link rel="preload" as="fetch" href="%BASE_URL%register\.json"/);
  });
});

describe('polish step 4: a citable ledger', () => {
  const r = retired.find((x) => x.norad === 27378)!;
  const html = ledgerHtml(r, real);
  it('the verdict is the first section, and it names the verdict in plain words', () => {
    const titles = [...html.matchAll(/<h2 id="ledger-[a-z]+-title">([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(titles[0]).toBe(LEDGER.headings.verdict);
    expect(text(html)).toContain('below the IADC disposal threshold under the stated assumptions');
  });
  it('the cite block has the name, NORAD id, snapshot date and a permalink, with the assumptions', () => {
    const cite = text(html.slice(html.indexOf('id="ledger-cite"')));
    expect(cite).toContain('ECHOSTAR 7, NORAD ID 27378.');
    expect(cite).toContain('CelesTrak snapshot, 22 Nov 2026.');
    expect(cite).toContain('https://4kinc.github.io/sexton/#/sat/27378');
    expect(cite).toContain('±25 km');
  });
  it('the permalink is the ledger route, so the router resolves it to the same satellite', () => {
    for (const x of retired.slice(0, 50)) {
      const url = LEDGER.citation(x.name, x.norad, real.snapshot.set).at(-1)!;
      expect(url.startsWith(SITE.url)).toBe(true);
      expect(parseHash(url.slice(SITE.url.length))).toMatchObject({ name: 'sat', norad: x.norad });
    }
  });
  it('the cite block has no banned stem and no sentence that pairs a retirement word with a year', () => {
    const cite = text(html.slice(html.indexOf('id="ledger-cite"')));
    expect(findHits(cite, 'cite')).toEqual([]);
    for (const line of LEDGER.citation(r.name, r.norad, real.snapshot.set)) expect(/retire/i.test(line) && /\b(19|20)\d{2}\b/.test(line)).toBe(false);
  });
});

describe('the epitaph line', () => {
  const lines = new Set<string>([...Object.values(EPITAPH), ...Object.values(EPITAPH_REGISTER_READS)]);
  const withCause = retired.filter((r) => isStory(r) && r.cause !== undefined);
  const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
  it('has a plain line for every cause category, so a future case file cannot break the tooltip', () => {
    for (const c of CAUSE_CATEGORIES) expect(EPITAPH[c], c).toBeTruthy();
    for (const l of lines) expect(findHits(l, 'epitaph')).toEqual([]);
  });
  it('gives every story stone with a cause exactly one line from the copy table, in the tooltip and on the card', () => {
    expect(withCause.length).toBeGreaterThan(0);
    for (const r of withCause) {
      const line = epitaphOf(r)!;
      expect(lines.has(line), r.name).toBe(true);
      const tip = text(tipHtml(r, real.config));
      const card = text(cardHtml(r, real.config));
      expect([...lines].filter((l) => tip.includes(l)), `tooltip of ${r.norad}`).toEqual([line]);
      expect([...lines].filter((l) => card.includes(l)), `card of ${r.norad}`).toEqual([line]);
      expect(count(tip, line)).toBe(1);
    }
  });
  it('gives no line to a stone without a cause', () => {
    const r = retired.find((x) => x.cause === undefined)!;
    expect(epitaphOf(r)).toBeNull();
    expect([...lines].some((l) => text(tipHtml(r, real.config)).includes(l))).toBe(false);
  });
  it('Kodama (27516) reads: the operator reports a disposal, the register reads it inside the zone', () => {
    const r = retired.find((x) => x.norad === 27516)!;
    expect(r.verdict.verdict).toBe('unquiet');
    expect(epitaphOf(r)).toBe('Its operator reports a disposal; the register reads it inside the zone.');
    expect(text(tipHtml(r, real.config))).toContain('the register reads it inside the zone.');
  });
  it('the operator line is the short form when the verdict is not unquiet or shallow grave', () => {
    const r = retired.find((x) => x.norad === 27516)!;
    expect(epitaphOf({ cause: 'disposal reported by operator', verdict: { ...r.verdict, verdict: 'buried' } })).toBe('Its operator reports a disposal.');
  });
  it("puts the line in the stone's aria-label, once", () => {
    const svg = chartSvg(real, false);
    for (const r of withCause) {
      const m = new RegExp(`data-norad="${r.norad}"[^>]*aria-label="([^"]*)"`).exec(svg);
      expect(m, String(r.norad)).not.toBeNull();
      const label = m![1]!.replace(/&amp;/g, '&');
      expect(label).toContain(epitaphOf(r)!.replace(/\.$/, ''));
    }
  });
});
