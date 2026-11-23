// The ledger: one page per retired payload (design 5.6, R7). The page is a string built by pure
// functions, so tests can read it without a DOM. Sections follow design 5.6.
import type { Config } from '../../engine/config.ts';
import type { ObjectKind, SatRecord, VerdictName } from '../../engine/types.ts';
import { CARD, dataAge, ECC_NOTE_BAND, LEDGER, assumptionsLine, CHURCHYARD_INTRO, verdictCopy } from '../copy.ts';
import { formatE, formatGap, formatP, formatSigned, MINUS } from '../format.ts';
import type { CaseFile } from '../case-file.ts';
import { CASES } from '../content.ts';
import { esc } from '../html.ts';
import { renderMarkdown } from '../markdown.ts';
import type { UiRegister } from '../register.ts';
import { SCALE, offScale } from '../svg/scale.ts';
type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
const isRetired = (r: SatRecord): r is Retired => r.verdict.kind === 'verdict';
const edgesOf = (c: Config): number[] => [c.protectedZoneKm, c.thresholdLowKm, c.thresholdHighKm];
/** "+110.4" becomes "110.4 km above GEO", and "\u221289.6" becomes "89.6 km below GEO". */
function height(signedText: string): string {
  return signedText.startsWith(MINUS) ? `${signedText.slice(1)} km below GEO` : `${signedText.replace('+', '')} km above GEO`;
}
/** A distance from an edge: "136.6 km below 247 km", or "exactly at 247 km". */
function against(margin: number, edgeKm: number, decimals: number): string {
  if (margin === 0) return `exactly at ${edgeKm} km`;
  return `${formatGap(margin, decimals)} km ${margin > 0 ? 'above' : 'below'} ${edgeKm} km`;
}
/** The verdict in plain words, with the numbers filled in. */
export function verdictSentence(r: Retired, config: Config): string {
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const ph = height(formatP(r.pKm, r.orbitSource.kind, edgesOf(config)));
  const qh = height(formatSigned(r.qKm, decimals));
  const e = formatE(r.e, config.iadc.eccentricityMax);
  const limit = config.iadc.eccentricityMax;
  const [zone, low, high] = [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];
  const stated = 'is below the IADC disposal threshold under the stated assumptions';
  const byVerdict: Record<VerdictName, string> = {
    fallen: `Its whole orbit is below the protected zone (±${zone} km). Its apogee is ${qh} and its perigee is ${ph}. Its perigee ${stated}.`,
    unquiet: `Its perigee is ${ph}. Its orbit reaches the protected zone (±${zone} km). Its perigee ${stated}.`,
    'shallow grave': `Its perigee is ${ph}, above the protected zone (±${zone} km) but below ${low} km, the lowest threshold in the assumed range. Its perigee ${stated}.`,
    restless: `Its perigee is ${ph}, at or above ${low} km, the lowest threshold in the assumed range. Its eccentricity is ${e}, above the IADC limit of ${limit}.`,
    uncertain: `Its perigee is ${ph}, inside the IADC threshold band of ${low} to ${high} km. Whether it is above the IADC disposal threshold depends on C_R·A/m, which is not known. Its eccentricity is ${e}, within the limit of ${limit}.`,
    buried: `Its perigee is ${ph}, at or above ${high} km, the highest threshold in the assumed range. It is above the IADC disposal threshold for every assumed C_R·A/m. Its eccentricity is ${e}, within the limit of ${limit}.`,
  };
  return byVerdict[r.verdict.verdict];
}
/** True for a SATCAT-only orbit whose eccentricity is close enough to the limit that whole-km rounding can decide it. */
export function eccentricityRoundingMatters(r: SatRecord, config: Config): boolean {
  if (r.verdict.kind !== 'verdict' || r.orbitSource.kind !== 'SATCAT') return false;
  // Eccentricity only decides the verdict when the perigee is at or above the lowest threshold.
  if (r.pKm < config.thresholdLowKm) return false;
  return Math.abs(r.e - config.iadc.eccentricityMax) <= ECC_NOTE_BAND;
}
const GPZ_VALUE: Partial<Record<ObjectKind, string>> = { 'retired payload': 'retired', 'living payload': 'living' };
/** The GPZ table code for a kind, such as "PAY-". */
function tableCode(kind: ObjectKind, config: Config): string {
  const want = GPZ_VALUE[kind] ?? kind;
  const hit = Object.entries(config.gpzTableStatus).find(([, v]) => v === want);
  return hit === undefined ? kind : hit[0];
}
/** The sentences for section 7. */
export function statusLines(r: SatRecord, config: Config): string[] {
  const d = r.disagreement;
  if (r.statusSource === 'GPZ table') {
    const code = tableCode(r.status, config);
    return [d !== null && d.satcat === 'unknown' ? LEDGER.statusGapSatcat(code) : LEDGER.statusNoSatcat(code), LEDGER.statusFrom(r.status, 'the GPZ table')];
  }
  const lines = [LEDGER.statusFrom(r.status, 'SATCAT')];
  if (d !== null) lines.push(LEDGER.statusDisagree(d.satcat, d.gpzTable, tableCode(d.gpzTable, config)));
  return lines;
}
const row = (k: string, v: string): string => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
const section = (id: string, title: string, body: string): string =>
  `<section class="ledger-section" id="ledger-${id}" aria-labelledby="ledger-${id}-title"><h2 id="ledger-${id}-title">${esc(title)}</h2>${body}</section>`;
const paras = (lines: readonly string[]): string => lines.map((l) => `<p>${esc(l)}</p>`).join('');
/** Section 8: the case file, when the register says the record has one and the file is loaded. */
export function caseFileSection(r: SatRecord, cases: ReadonlyMap<number, CaseFile>): string {
  const file = r.caseFile ? cases.get(r.norad) : undefined;
  if (file === undefined) return '';
  const notice = file.provisional ? `<p class="case-provisional" role="note"><strong>${esc(LEDGER.provisional)}</strong></p>` : '';
  return section('case', LEDGER.headings.caseFile, `${notice}<h3 class="case-title">${esc(file.title)}</h3><div class="case-body">${renderMarkdown(file.body)}</div>`);
}
/** The whole ledger for one retired payload. `cases` is the loaded case files. */
export function ledgerHtml(r: Retired, reg: UiRegister, cases: ReadonlyMap<number, CaseFile> = CASES): string {
  const config = reg.config;
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const pText = formatP(r.pKm, r.orbitSource.kind, edgesOf(config));
  const F = LEDGER.fields;
  const H = LEDGER.headings;
  const era = v.era === 'before FCC rule' ? `<p class="era-badge">${esc(CARD.beforeRule)}</p>` : '';
  const identity = section(
    'identity',
    H.identity,
    `<dl class="ledger-data">${row(F.name, r.name)}${row(F.norad, String(r.norad))}${row(F.designator, r.intlDes ?? LEDGER.notGiven)}${row(F.owner, r.owner ?? LEDGER.notGiven)}${row(F.launch, r.launchDate ?? LEDGER.unknown)}</dl>${era}`,
  );
  const verdict = section('verdict', H.verdict, `<p class="verdict-line"><strong>${esc(verdictCopy(v.verdict, config).pair)}</strong></p>${paras([verdictSentence(r, config)])}`);
  const m = v.margins;
  const maths = section(
    'maths',
    H.maths,
    paras([
      `${LEDGER.formula(config)} ${LEDGER.range(config)}`,
      `p = ${pText} km. That is ${against(m.low, config.thresholdLowKm, decimals)}, ${against(m.high, config.thresholdHighKm, decimals)}, and ${against(m.zone, config.protectedZoneKm, decimals)}, the edge of the protected zone.`,
      `Eccentricity e = ${formatE(r.e, config.iadc.eccentricityMax)}. The IADC limit is ${config.iadc.eccentricityMax}.`,
    ]),
  );
  const assumptions = section(
    'assumptions',
    H.assumptions,
    paras([assumptionsLine(config), LEDGER.assumedRanges(config), v.borderline ? CARD.borderline(config) : LEDGER.notBorderline(config)]),
  );
  const notes: string[] = [];
  if (r.orbitSource.kind === 'GP') notes.push(LEDGER.gpOrbit);
  else notes.push(LEDGER.satcatOrbit);
  if (eccentricityRoundingMatters(r, config)) notes.push(LEDGER.eccentricityRounding(formatE(r.e, config.iadc.eccentricityMax), config.iadc.eccentricityMax));
  const off = offScale(r.pKm);
  if (off === 'above') notes.push(LEDGER.offScaleAbove(SCALE.maxKm));
  else if (off === 'below') notes.push(LEDGER.offScaleBelow(SCALE.minKm));
  else if (r.pKm > SCALE.linearMaxKm) notes.push(LEDGER.highGround(SCALE.linearMaxKm));
  const orbit = section(
    'orbit',
    H.orbit,
    `<p><strong>${esc(r.orbitSource.kind === 'GP' ? dataAge(r) : LEDGER.satcatSource)}</strong></p>` +
      `<dl class="ledger-data">${row(F.perigee, `${pText} km`)}${row(F.apogee, `${formatSigned(r.qKm, decimals)} km`)}${row(F.eccentricity, formatE(r.e, config.iadc.eccentricityMax))}` +
      `${row(F.perigeeAltitude, `${formatSigned(r.perigeeKm, decimals).replace('+', '')} km`)}${row(F.apogeeAltitude, `${formatSigned(r.apogeeKm, decimals).replace('+', '')} km`)}</dl>` +
      paras(notes),
  );
  const sources = reg.snapshot.sources
    .map((s) => `<li><a href="${esc(s.url)}">${esc(s.file)}</a>, ${esc(LEDGER.fetched)} ${esc(s.fetchedAt)}</li>`)
    .join('');
  const snapshot = section('snapshot', H.snapshot, `${paras([LEDGER.snapshotLine(reg.snapshot.set), ...(reg.sample ? [LEDGER.sampleNote] : [])])}<ul>${sources}</ul>`);
  const status = section('status', H.status, paras(statusLines(r, config)));
  const context = section('context', H.context, paras([CHURCHYARD_INTRO.voluntary, CHURCHYARD_INTRO.noRetirementDate]));
  const actions = section(
    'actions',
    H.actions,
    `<p class="ledger-actions"><button type="button" class="button" data-print>${esc(LEDGER.print)}</button> <button type="button" class="button" data-download>${esc(LEDGER.download)}</button></p>`,
  );
  const footer =
    `<footer class="ledger-footer"><p>${esc(LEDGER.footer(reg.snapshot.set))}</p><ul>` +
    reg.snapshot.sources.map((s) => `<li>${esc(s.file)}: <code>${esc(s.sha256)}</code></li>`).join('') +
    `</ul></footer>`;
  return (
    `<article class="ledger"><p class="print-title">${esc(LEDGER.printTitle)}: NORAD <span class="num">${r.norad}</span></p>` +
    identity + verdict + maths + assumptions + orbit + snapshot + status + caseFileSection(r, cases) + context + actions + footer +
    `<p class="ledger-back"><a href="#/table">${esc(LEDGER.back)}</a></p></article>`
  );
}
/** The page for any NORAD id: a ledger, or a plain note when the object has no verdict or is not in the register. */
export function ledgerPageHtml(reg: UiRegister, norad: number, cases: ReadonlyMap<number, CaseFile> = CASES): string {
  const r = reg.records.find((x) => x.norad === norad);
  if (r === undefined) return `<p>${esc(LEDGER.notFound(norad))}</p><p><a href="#/table">${esc(LEDGER.back)}</a></p>`;
  if (!isRetired(r)) {
    const reason = r.verdict.kind === 'no verdict' ? r.verdict.reason : `unmarked bones, ${r.status}`;
    return `<p>${esc(LEDGER.noLedger(r.name, r.norad, reason))}</p><p><a href="#/table">${esc(LEDGER.back)}</a></p>`;
  }
  return ledgerHtml(r, reg, cases);
}
/** The "Download JSON" file: this record, the snapshot and the config. */
export function ledgerJson(r: SatRecord, reg: UiRegister): string {
  return `${JSON.stringify({ sample: reg.sample, snapshot: reg.snapshot, config: reg.config, record: r }, null, 2)}\n`;
}
/** Draws the ledger into `root`. Returns a function that removes the listeners. */
export function mountLedger(root: HTMLElement, reg: UiRegister, norad: number): () => void {
  root.innerHTML = ledgerPageHtml(reg, norad);
  const onClick = (event: Event): void => {
    const target = event.target as Element;
    if (target.closest('[data-print]') !== null) {
      window.print();
      return;
    }
    if (target.closest('[data-download]') === null) return;
    const r = reg.records.find((x) => x.norad === norad);
    if (r === undefined) return;
    const url = URL.createObjectURL(new Blob([ledgerJson(r, reg)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sexton-${norad}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
