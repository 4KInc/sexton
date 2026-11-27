// The methodology page (Task 15, design 5.9, R9): docs/methodology.md matches the config, covers
// what the real data showed, uses only checked links, and renders at #/method.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findHits, METHODOLOGY_PATH } from '../scripts/check-language.ts';
import { CONFIG } from '../src/engine/config.ts';
import { METHODOLOGY } from '../src/ui/content.ts';
import { parseHash } from '../src/ui/router.ts';
import { headingsOf, methodHtml } from '../src/ui/views/method.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const doc = readFileSync(join(ROOT, 'docs/methodology.md'), 'utf8');

/** Every number in a value, as its absolute value (the page writes −2,000 and +2,000 as 2,000). */
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(Math.abs(value));
  else if (Array.isArray(value)) for (const v of value) numbersIn(v, out);
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) numbersIn(v, out);
  return out;
}
/** The page text with thousands separators removed, so 35,786 and 35786 both read as 35786. */
const plain = doc.replace(/(?<=\d),(?=\d{3}(?!\d))/g, '');
const hasNumber = (n: number): boolean => new RegExp(`(?<![\\d.])${String(n).replace('.', '\\.')}(?![\\d]|\\.\\d)`).test(plain);

describe('methodology.md and the config', () => {
  const nums = [...new Set(numbersIn(CONFIG))].sort((a, b) => a - b);
  it('reads every number out of the config', () => {
    // A guard against the walker silently finding nothing.
    expect(nums.length).toBeGreaterThanOrEqual(15);
    for (const n of [6378.135, 398600.8, 86400, 35786, 2000, 200, 235, 1000, 0.012, 0.045, 0.003, 247, 280, 25, 1.2, 1.5, 0.01, 0.03, 1957]) {
      expect(nums, String(n)).toContain(n);
    }
  });
  it.each(nums)('shows the config number %s', (n) => {
    expect(hasNumber(n), `${n} is in config.ts but not in docs/methodology.md`).toBe(true);
  });
  it('shows the FCC rule date', () => {
    expect(CONFIG.fccRuleDate).toBe('2002-03-18');
    expect(doc).toContain('18 March 2002');
  });
  it('shows the orbit centre, the SATCAT types and every status code the config maps', () => {
    expect(doc).toContain(`\`${CONFIG.nearGeo.orbitCenter}\``);
    for (const t of Object.values(CONFIG.satcatTypes)) expect(doc, t).toContain(`\`${t}\``);
    for (const code of [...CONFIG.status.retired, ...CONFIG.status.living]) expect(doc, code).toContain(`\`${code}\``);
    for (const key of Object.keys(CONFIG.gpzTableStatus)) expect(doc, key).toContain(`\`${key}\``);
  });
});

describe('methodology.md covers the spike findings (docs/spike.md section f)', () => {
  const must: [string, RegExp][] = [
    ['the near-GEO filter', /near-GEO filter/i],
    ['its blind spot', /blind spot/i],
    ['objects sent higher or left GEO', /sent much higher/i],
    ['SATCAT whole-km altitudes', /whole kilomet/i],
    ['the measured agreement for objects with both', /median difference in perigee is 0\.29 km/],
    ['the retired payloads with both', /largest difference is 0\.85 km/],
    ['the 48 objects', /48 payloads/],
    ['the GPZ table as the status source', /Sexton uses the table's status/],
    ['the eccentricity rounding', /1\.2e-5/],
    ['the churchyard high ground', /compressed/i],
    ['uneven year columns', /not to scale/],
    ['the FCC rule section', /47 CFR § 25\.283/],
    ['FCC-authorized only', /only satellites the FCC authorizes/],
    ['launches from 18 March 2002', /launches from 18 March 2002/],
    ['IADC being voluntary', /IADC guidelines are voluntary/],
    ['retirement dates being unknown', /never states or implies a retirement date/],
    ['the font licence', /SIL Open Font License/],
    ['the credit to Roberts', /Roberts/],
    ['CelesTrak', /CelesTrak/],
    ['IM FELL English', /IM FELL English/],
  ];
  it.each(must)('%s', (_name, pattern) => {
    expect(doc).toMatch(pattern);
  });
  it('states the +400 km start of the compressed high ground', () => {
    expect(doc).toContain('+400 km');
    expect(doc).toContain('−300 to +400 km');
  });
});

describe('methodology.md sources', () => {
  // Every link below was opened on 2026-11-23 or later (the dates are in docs/methodology.md). A new link must be opened by a person, then added here.
  const OPENED = new Set([
    'https://docs.fcc.gov/public/attachments/DA-23-888A1.txt',
    'https://www.law.cornell.edu/cfr/text/47/25.283',
    'https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf',
    'https://www.esa.int/Space_Safety/Space_Debris/ESA_Space_Environment_Report_2025',
    'https://www.sdo.esoc.esa.int/environment_report/Space_Environment_Report_I9R1_20251021.pdf',
    'https://www.sdo.esoc.esa.int/environment_report/Space_Environment_Report_I10R1_20260908.pdf',
    'https://iac.gatech.edu/publications/pub/8089',
    'https://celestrak.org/satcat/satcat-format.php',
    'https://celestrak.org/satcat/status.php',
    'https://celestrak.org/NORAD/documentation/gp-data-formats.php',
    'https://celestrak.org/',
    'https://openfontlicense.org/open-font-license-official-text/',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/OFL.txt',
    // Opened 2026-11-24: the IBM Plex licence file.
    'https://raw.githubusercontent.com/IBM/plex/master/LICENSE.txt',
    // Opened 2026-11-27 and approved by the owner (docs/source-review.md): the cause sources for the case notes.
    'https://www.jaxa.jp/press/2019/03/20190301a_j.html',
    'https://satnews.com/2020/03/31/venezuelas-only-telecoms-satellite-is-lost-in-space/',
    'https://spacenews.com/spacecom-stock-tumbles-following-amos-5-failure/',
    'https://spaceflightnow.com/2019/04/22/intelsat-declares-drifting-satellite-total-loss/',
    'https://www.datacenterdynamics.com/en/news/intelsats-33e-geo-satellite-breaks-up-in-orbit/',
    'https://www.satellitetoday.com/connectivity/2024/10/21/intelsats-is-33e-satellite-is-a-total-loss/',
    'https://spacenews.com/angola-eyes-new-satellite-as-african-space-race-accelerates/',
    'https://en.sedaily.com/finance/2026/06/08/koreas-first-geostationary-satellite-chollian-1-ends-16',
    // Opened 2026-11-27 and approved by the owner (batch 3 and the operator sources in docs/source-review.md).
    'https://www.mext.go.jp/b_menu/shingi/gijyutu/gijyutu2/059/shiryo/__icsFiles/afieldfile/2017/10/27/1397652_4.pdf',
    'https://russianforces.org/blog/2003/11/problems_with_russian_military.shtml',
    'https://satnews.com/2014/07/16/russia-the-seasoned-yamal-201-goes-nowhere-satellite/',
    'https://www.measat.com/wp-content/uploads/2021/08/EXT-MEASAT-to-Retire-MEASAT-3-210806.pdf',
    'https://www.satelliteevolution.com/post/measat-to-retire-measat-3',
    'https://www.satellitetoday.com/connectivity/2008/11/20/report-nigcomsat-1-declared-total-loss/',
    'https://cgwic.com/CommunicationsSatellite/project.html',
    'https://www.hispasat.com/es/flota-e-infraestructura/flota-de-satelites/hispasat-30w-6',
    'https://new1.isro.gov.in/INSAT_3A.html',
    'https://www.isro.gov.in/GSAT_2.html',
    'https://www.isro.gov.in/INSAT_3E.html',
    'https://www.isro.gov.in/SpacecraftMissions.html',
    'https://www.timesofisrael.com/after-loss-of-satellite-in-spacex-blast-israeli-company-brings-in-replacement/',
    'https://www.satellitetoday.com/technology/2015/07/14/rscc-transfers-traffic-from-express-am22-to-express-am6-satellite/',
    'https://satnews.com/2021/08/17/rscc-alters-the-express-am33-satellites-orbital-slot/',
    'https://cimss.ssec.wisc.edu/satellite-blog/archives/55455',
    'https://www.space.com/9110-chinese-satellite-suffers-life-shortening-leak.html',
    'https://spaceflightnow.com/2017/07/13/chinese-tv-broadcasting-satellite-reaches-operational-orbit-after-off-target-launch/',
    'https://abae.gob.ve/venezuela-celebra-17-aniversario-lanzamiento-satelite-simon-bolivar/',
  ]);
  const links = [...doc.matchAll(/https?:\/\/[^\s|)]+/g)].map((m) => m[0]);
  it('cites only links that were opened', () => {
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(OPENED.has(l), `${l} is not in the opened list`).toBe(true);
  });
  it('keeps LINK NEEDED for the ones that could not be opened', () => {
    expect((doc.match(/LINK NEEDED/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(doc).toMatch(/iadc-home\.org returned 403/);
  });
  it('shows the ESA range only with its place in the report, and never the unverified Roberts figure', () => {
    expect(doc).toMatch(/Between 70% and 95% do so successfully/);
    expect(doc).toContain('Executive summary, page 7 of 146');
    expect(doc).not.toMatch(/\b73\s?%\s+(of|compliant)/);
  });
});

describe('methodology.md language', () => {
  it('passes the language check with the "What we do not say" section skipped', () => {
    expect(findHits(doc, METHODOLOGY_PATH)).toEqual([]);
  });
  it('has the "What we do not say" section, and it is the last one', () => {
    const headings = doc.split('\n').filter((l) => l.startsWith('## '));
    expect(headings.at(-1)).toBe('## What we do not say');
  });
  it('would fail the check without the skip, so the section really lists the phrases', () => {
    expect(findHits(doc, 'docs/other.md').length).toBeGreaterThan(0);
  });
});

describe('the page at #/method', () => {
  it('is a route', () => {
    expect(parseHash('#/method').name).toBe('method');
  });
  it('bundles the file as written', () => {
    expect(METHODOLOGY).toBe(doc);
  });
  const html = methodHtml();
  it('renders the sections with h2 headings and drops the document title', () => {
    // Headings carry an id for the contents list, and can take focus when the list moves the page to them.
    expect(html).toContain('<h2 id="m-formulas" tabindex="-1">Formulas</h2>');
    expect(html).toContain('<h2 id="m-what-we-do-not-say" tabindex="-1">What we do not say</h2>');
    expect(html).not.toContain('<h1');
  });
  it('renders the sources as links, with rel on external ones', () => {
    expect(html).toContain('<a href="https://www.law.cornell.edu/cfr/text/47/25.283" rel="noopener noreferrer">');
  });
  it('wraps each table in a labelled scroll box', () => {
    const tables = html.match(/<table /g) ?? [];
    const boxes = html.match(/<div class="table-wrap method-wrap" role="region" aria-label="[^"]+" tabindex="0">/g) ?? [];
    // The Sources table is drawn as citations, so it is not one of these.
    expect(tables.length).toBeGreaterThan(4);
    expect(boxes.length).toBe(tables.length);
  });
  it('draws the Sources table as one citation per row, with its link and what was checked', () => {
    const section = doc.slice(doc.indexOf('\n## Sources\n'), doc.indexOf('## What we do not say'));
    const rows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---') && !l.startsWith('| Source '));
    expect(html.match(/<li class="cite">/g)).toHaveLength(rows.length);
    expect(html).toContain('<p class="cite-name">FCC DA 23-888, Order (DISH, EchoStar-7)</p><p class="cite-link"><a href="https://docs.fcc.gov/public/attachments/DA-23-888A1.txt" rel="noopener noreferrer">');
    expect(html).toContain('<p class="cite-link">LINK NEEDED</p>');
    expect(html).not.toContain('<th scope="col">Link</th>');
  });
  it('has a contents list built from the headings, which moves the page without changing the hash route', () => {
    const entries = headingsOf(html);
    expect(entries.map((e) => e.text)).toContain('Formulas');
    expect(entries.filter((e) => e.level === 2).length).toBeGreaterThan(10);
    const toc = html.slice(html.indexOf('<details class="toc">'), html.indexOf('</details>'));
    for (const e of entries) expect(toc).toContain(`<a href="#/method" data-toc="${e.id}">`);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    // Every id in the contents is on a heading in the text.
    for (const e of entries) expect(html).toContain(`id="${e.id}"`);
  });
  it('keeps the formulas as preformatted text', () => {
    expect(html).toContain('<pre><code>n  = mean motion');
  });
  it('escapes raw HTML in the document', () => {
    expect(methodHtml('## A\n\n<script>alert(1)</script>')).not.toContain('<script>');
  });
});
