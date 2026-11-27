import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import type { SatRecord, VerdictName } from '../src/engine/types.ts';
import { ECC_NOTE_BAND, LEDGER, verdictCopy, VERDICT_ORDER } from '../src/ui/copy.ts';
import { formatE, formatGap, formatP } from '../src/ui/format.ts';
import type { UiRegister } from '../src/ui/register.ts';
import { SCALE } from '../src/ui/svg/scale.ts';
import { eccentricityRoundingMatters, ledgerHtml, ledgerJson, ledgerPageHtml, statusLines } from '../src/ui/views/ledger.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
const retired = real.records.filter((r): r is Retired => r.verdict.kind === 'verdict');
const config = real.config;
const EDGES = [200, 247, 280];
/** The words a reader sees: tags removed, one line per element, entities decoded. */
function textOf(html: string): string {
  return html
    // A digit run wrapped for the mono face is inline text, not a block.
    .replace(/<span class="num">(\d+)<\/span>/g, '$1')
    .replace(/<[^>]*>/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
const ledgerOf = (r: Retired): string => ledgerHtml(r, real);
/** The badge markup: the word and its meaning, in separate elements. */
const badgeOf = (verdict: VerdictName): string => {
  const c = verdictCopy(verdict, real.config);
  return `<span class="badge-word">${c.word}</span><span class="badge-meaning">${c.meaning.replace(/&/g, '&amp;')}</span>`;
};
const textOfLedger = (r: Retired): string => textOf(ledgerOf(r));
const first = (pick: (r: Retired) => boolean): Retired => {
  const r = retired.find(pick);
  if (r === undefined) throw new Error('no such record in the real register');
  return r;
};
/** A real record with its perigee replaced, margins recomputed. Only the ledger reads it. */
function withP(base: Retired, pKm: number, verdict: VerdictName): Retired {
  return {
    ...base,
    pKm,
    verdict: {
      ...base.verdict,
      verdict,
      margins: { zone: pKm - config.protectedZoneKm, low: pKm - config.thresholdLowKm, high: pKm - config.thresholdHighKm },
    },
  };
}
const spokenHeight = (ph: string): string => (ph.startsWith('\u2212') ? `${ph.slice(1)} km below GEO` : `${ph.replace('+', '')} km above GEO`);

describe('the real register', () => {
  it('has the 696 retired payloads, 48 with a GPZ-table status', () => {
    expect(retired).toHaveLength(696);
    expect(retired.filter((r) => r.statusSource === 'GPZ table')).toHaveLength(48);
  });
});

describe('the rounding rule (design 5.6)', () => {
  const gp = first((r) => r.orbitSource.kind === 'GP');
  const satcat = first((r) => r.orbitSource.kind === 'SATCAT');
  it('199.96 is not shown as 200.0', () => {
    const t = textOfLedger(withP(gp, 199.96, 'unquiet'));
    expect(t).toContain('+199.96');
    expect(t).not.toMatch(/\+200\.0\b/);
    expect(t).toContain('0.04 km below 200 km');
    expect(formatP(199.96, 'GP', EDGES)).toBe('+199.96');
  });
  it('246.96 is not shown as 247.0, and not as 247 for SATCAT', () => {
    const t = textOfLedger(withP(gp, 246.96, 'shallow grave'));
    expect(t).toContain('+246.96');
    expect(t).toContain('0.04 km below 247 km');
    const s = textOfLedger(withP(satcat, 246.96, 'shallow grave'));
    expect(s).toContain('+246.96');
    expect(s).not.toMatch(/\+247\b/);
  });
  it('just above an edge keeps its side too', () => {
    expect(textOfLedger(withP(gp, 200.04, 'shallow grave'))).toContain('0.04 km above 200 km');
    expect(textOfLedger(withP(gp, 247.04, 'uncertain'))).toContain('+247.04');
  });
  it('an ordinary value keeps the normal precision', () => {
    expect(textOfLedger(withP(gp, 110.44, 'unquiet'))).toContain('+110.4 km');
    expect(textOfLedger(withP(satcat, 404, 'buried'))).toContain('+404 km');
  });
  it('a gap that rounds to zero is not shown as zero', () => {
    expect(formatGap(-0.04, 1)).toBe('0.04');
    expect(formatGap(-0.004, 1)).toBe('0.004');
    expect(formatGap(136.64, 1)).toBe('136.6');
  });
  it('an eccentricity just over the limit is not shown as the limit', () => {
    expect(formatE(0.003004, 0.003)).toBe('0.003004');
    expect(formatE(0.00302, 0.003)).toBe('0.00302');
    expect(formatE(0.00061392, 0.003)).toBe('0.00061');
    expect(formatE(0.003, 0.003)).toBe('0.00300');
  });
});

describe('every real ledger', () => {
  const html = retired.map(ledgerOf);
  const text = retired.map(textOfLedger);
  it('renders for all 696 retired payloads, with the sections in order', () => {
    expect(html).toHaveLength(696);
    // The case-file section shows only when a record has a case file (test/case-files.test.ts).
    // The page has two columns, built column by column: the verdict and its maths on the left, the object on the right.
    const H = LEDGER.headings;
    const order = [H.verdict, H.maths, H.assumptions, H.context, H.identity, H.orbit, H.status, H.snapshot, H.cite, H.actions];
    expect(new Set(order)).toEqual(new Set(Object.values(H).filter((h) => h !== H.caseFile)));
    for (const [i, t] of text.entries()) {
      let at = -1;
      for (const h of order) {
        const next = t.indexOf(h, at + 1);
        expect(next, `${retired[i]!.norad} ${h}`).toBeGreaterThan(at);
        at = next;
      }
    }
  });
  it('never states or implies a retirement date', () => {
    for (const [i, full] of text.entries()) {
      // A web address can carry a year and a word like "retire" in its path (a press release's file name). It is not a statement, so addresses are left out of this check.
      const t = full.replace(/https?:\/\/\S+/g, '');
      // A sentence that talks about retiring must carry no year, and no phrase like "retired in".
      for (const sentence of t.split(/(?<=[a-z)])\.\s|\n/)) {
        if (/retir/i.test(sentence)) expect(sentence, String(retired[i]!.norad)).not.toMatch(/\b(1[89]|20)\d\d\b/);
      }
      expect(t).not.toMatch(/retired (in|on|at|by)\b/i);
      expect(t).not.toMatch(/retirement date/i);
      expect(t).not.toMatch(/\b(retired|disposed|moved)\b[^.\n]{0,30}\b(19|20)\d\d\b/i);
    }
  });
  it('says plainly that the retirement date is not known', () => {
    for (const t of text) expect(t).toContain('We do not know when a satellite retired.');
  });
  it('passes the language check, as rendered HTML, visible text and JSON, for all 696', () => {
    const hits: string[] = [];
    for (const [i, r] of retired.entries()) {
      for (const [kind, body] of [['html', html[i]!], ['text', text[i]!], ['json', ledgerJson(r, real)]] as const) {
        for (const h of findHits(body, `ledger-${r.norad}.${kind}`)) hits.push(`${h.file}:${h.line} ${h.match}`);
      }
    }
    expect(hits).toEqual([]);
  });
  it('shows the assumptions, the data age and the voluntary-rule sentences in every ledger', () => {
    for (const [i, t] of text.entries()) {
      const r = retired[i]!;
      expect(t, String(r.norad)).toContain('Assumes C_R·A/m from 0.012 to 0.045 m²/kg and a mean-element uncertainty of ±25 km.');
      expect(t).toContain('The IADC guidelines are voluntary.');
      expect(t).toContain('applies only to satellites the FCC authorizes, launched on or after 18 March 2002.');
      // The header card's badge: the word, then its meaning under it.
      expect(html[i]).toContain(badgeOf(r.verdict.verdict));
      expect(t).toContain('T = 235 + 1000 × C_R·A/m.');
      expect(t).toContain('T is 247 to 280 km.');
      expect(t).toMatch(
        r.orbitSource.kind === 'GP' ? /GP mean elements, epoch \d{4}-\d\d-\d\d \d\d:\d\d UTC/ : /SATCAT whole-km apogee and perigee, element date not given/,
      );
    }
  });
  it('shows the era badge only for launches before the FCC rule date', () => {
    for (const [i, r] of retired.entries()) {
      expect(html[i]!.includes('class="era-badge"'), String(r.norad)).toBe(r.verdict.era === 'before FCC rule');
    }
  });
  it('says "unknown" for a missing launch date and shows no badge', () => {
    for (const r of retired.filter((x) => x.launchDate === null)) {
      expect(textOfLedger(r)).toMatch(/Launch date\s+unknown/);
      expect(ledgerOf(r)).not.toContain('era-badge');
    }
  });
});

describe('orbit source', () => {
  it('a GP ledger gives the epoch and does not mention SATCAT rounding', () => {
    const t = textOfLedger(first((x) => x.orbitSource.kind === 'GP'));
    expect(t).toContain('GP mean elements, epoch');
    expect(t).not.toContain('rounds each altitude');
  });
  it('a SATCAT ledger says the numbers are whole km, rounded to 1 km', () => {
    const t = textOfLedger(first((x) => x.orbitSource.kind === 'SATCAT'));
    expect(t).toContain('SATCAT whole-km apogee and perigee, element date not given');
    expect(t).toContain('SATCAT rounds each altitude to 1 km');
  });
});

describe('status source', () => {
  const gpzStatus = retired.filter((r) => r.statusSource === 'GPZ table');
  it('says plainly where the 48 GPZ-table statuses come from', () => {
    expect(gpzStatus).toHaveLength(48);
    for (const r of gpzStatus) {
      expect(textOfLedger(r), String(r.norad)).toContain(
        'SATCAT lists this object as a payload but gives no status. The status comes from the GPZ table (PAY-).',
      );
    }
  });
  it('the other ledgers do not say it', () => {
    for (const r of retired.filter((x) => x.statusSource === 'SATCAT')) {
      expect(textOfLedger(r)).not.toContain('gives no status');
      expect(textOfLedger(r)).toContain('Status: retired payload, from SATCAT.');
    }
  });
  it('a SATCAT status that differs from the table is kept and both are shown', () => {
    const r = { ...first((x) => x.statusSource === 'SATCAT'), disagreement: { satcat: 'retired payload', gpzTable: 'living payload' } } as Retired;
    expect(statusLines(r, config).join(' ')).toContain(
      'SATCAT gives "retired payload". The GPZ table gives "living payload" (PAY+). The register uses the SATCAT status.',
    );
  });
  it('an object with no SATCAT entry says so', () => {
    const r = { ...gpzStatus[0]!, disagreement: null } as Retired;
    expect(statusLines(r, config)[0]).toBe('SATCAT has no entry for this object. The status comes from the GPZ table (PAY-).');
  });
});

describe('eccentricity close to the limit', () => {
  const noted = retired.filter((r) => ledgerOf(r).includes('within 0.0005 of the 0.003 limit'));
  const near = retired.filter((r) => r.orbitSource.kind === 'SATCAT' && Math.abs(r.e - 0.003) <= ECC_NOTE_BAND);
  it('the note is on exactly the SATCAT-only ledgers where eccentricity decides the verdict', () => {
    const expected = near.filter((r) => r.pKm >= config.thresholdLowKm);
    expect(noted.map((r) => r.norad)).toEqual(expected.map((r) => r.norad));
    expect(noted).toHaveLength(18);
    expect(near).toHaveLength(25);
  });
  it('every noted ledger is a restless, uncertain or buried one and says the result depends on rounding', () => {
    for (const r of noted) {
      expect(['restless', 'uncertain', 'buried']).toContain(r.verdict.verdict);
      expect(textOfLedger(r)).toContain('that result depends on the whole-km rounding of the SATCAT altitudes');
      expect(eccentricityRoundingMatters(r, config)).toBe(true);
    }
  });
  it('a GP orbit near the limit gets no note', () => {
    const gp = { ...first((r) => r.orbitSource.kind === 'GP'), e: 0.003 } as Retired;
    expect(eccentricityRoundingMatters(gp, config)).toBe(false);
  });
});

describe('off-scale and high-ground objects', () => {
  const above = retired.filter((r) => r.pKm > SCALE.maxKm);
  const below = retired.filter((r) => r.pKm < SCALE.minKm);
  const high = retired.filter((r) => r.pKm > SCALE.linearMaxKm && r.pKm <= SCALE.maxKm);
  it('the real register has them', () => {
    expect(above).toHaveLength(15);
    expect(below).toHaveLength(8);
    expect(high.length).toBeGreaterThan(0);
  });
  it('shows the exact perigee and a note, above the top of the scale', () => {
    for (const r of above) {
      const t = textOfLedger(r);
      expect(t).toContain(spokenHeight(formatP(r.pKm, r.orbitSource.kind, EDGES)));
      expect(t).toContain('above the top of the drawn scale (+1,000 km)');
      expect(t).toContain('register values, not its drawn position');
    }
  });
  it('shows the exact perigee and a note, below the bottom of the scale', () => {
    for (const r of below) {
      const t = textOfLedger(r);
      expect(t).toContain('below the bottom of the drawn scale (\u2212300 km)');
      expect(t).toContain(spokenHeight(formatP(r.pKm, r.orbitSource.kind, EDGES)));
    }
  });
  it('says the scale is compressed on the high ground, and nowhere else', () => {
    for (const r of high) expect(textOfLedger(r)).toContain('stands on the high ground, above +400 km');
    for (const r of retired.filter((x) => x.pKm <= SCALE.linearMaxKm && x.pKm >= SCALE.minKm)) {
      expect(textOfLedger(r)).not.toContain('drawn position');
    }
  });
});

describe('one example per verdict, from the real register', () => {
  for (const verdict of VERDICT_ORDER) {
    it(`${verdict}`, () => {
      const r = first((x) => x.verdict.verdict === verdict);
      const t = textOfLedger(r);
      // The churchyard word is paired with its meaning once, in the badge of the header card.
      expect(ledgerOf(r).split(badgeOf(verdict))).toHaveLength(2);
      expect(t).toContain(verdictCopy(verdict, config).meaning);
      const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
      const ph = formatP(r.pKm, r.orbitSource.kind, EDGES);
      expect(t).toContain(spokenHeight(ph));
      const below = 'is below the IADC disposal threshold under the stated assumptions';
      if (verdict === 'fallen') expect(t).toContain('Its whole orbit is below the protected zone (±200 km).');
      if (verdict === 'unquiet') expect(t).toContain('Its orbit reaches the protected zone (±200 km).');
      if (verdict === 'shallow grave') expect(t).toContain('below 247 km, the lowest threshold in the assumed range.');
      if (verdict === 'restless') expect(t).toContain('above the IADC limit of 0.003.');
      if (verdict === 'uncertain') {
        expect(t).toContain('inside the IADC threshold band of 247 to 280 km. Whether it is above the IADC disposal threshold depends on C_R·A/m, which is not known.');
      }
      if (verdict === 'buried') expect(t).toContain('It is above the IADC disposal threshold for every assumed C_R·A/m.');
      if (['fallen', 'unquiet', 'shallow grave'].includes(verdict)) expect(t).toContain(below);
      else expect(t).not.toContain(below);
      // The maths has real numbers, and the gap to 247 km matches the register.
      expect(t).toContain(`p = ${ph} km. That is `);
      const gap = r.verdict.margins.low;
      expect(t).toContain(gap === 0 ? 'exactly at 247 km' : `${formatGap(gap, decimals)} km ${gap > 0 ? 'above' : 'below'} 247 km`);
    });
  }
  it('the borderline flag is stated either way', () => {
    expect(textOfLedger(first((x) => x.verdict.borderline))).toContain('Borderline: within 25 km of a band edge.');
    expect(textOfLedger(first((x) => !x.verdict.borderline))).toContain('Not borderline: more than 25 km from every band edge.');
  });
});

describe('page, download and print', () => {
  it('a missing id and an object with no verdict get a plain note, not a ledger', () => {
    // Changed on purpose (redesign 5): the page for an unknown id has the site's short message, with links to the table and the churchyard.
    expect(textOf(ledgerPageHtml(real, 999999999))).toContain('No stone carries NORAD 999999999.');
    const living = real.records.find((r) => r.verdict.kind === 'no verdict')!;
    const t = textOf(ledgerPageHtml(real, living.norad));
    expect(t).toContain('has no verdict');
    expect(t).not.toContain('The threshold maths');
  });
  it('the download holds the record, snapshot and config', () => {
    const r = retired[0]!;
    const json = JSON.parse(ledgerJson(r, real)) as { record: SatRecord; snapshot: { set: string }; config: { uncertaintyKm: number } };
    expect(json.record).toEqual(r);
    expect(json.snapshot.set).toBe('2026-11-22');
    expect(json.config.uncertaintyKm).toBe(25);
  });
  it('has both buttons, a print title, and the source hashes in the footer', () => {
    const r = retired[0]!;
    const html = ledgerOf(r);
    expect(html).toContain('data-print');
    expect(html).toContain('data-download');
    expect(html).toContain(`Exhumation report: NORAD <span class="num">${r.norad}</span>`);
    for (const s of real.snapshot.sources) expect(html).toContain(s.sha256);
  });
  it('print.css hides the nav and chart, and prints link addresses', () => {
    const css = readFileSync(join(ROOT, 'src/ui/styles/print.css'), 'utf8');
    expect(css).toContain('@media print');
    expect(css).toMatch(/\.site-header[\s\S]*display: none/);
    expect(css).toContain("a[href^='http']::after");
    expect(css).toContain('attr(href)');
  });
});
