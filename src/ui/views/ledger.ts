// The ledger: one page per retired payload (design 5.6, R7). The page is a string built by pure
// functions, so tests can read it without a DOM. Sections follow design 5.6.
// The sentences live in ../ledger-text.ts, which the MCP server shares.
import { noStoneHtml } from '../messages.ts';
import { EXTERNAL, perigeeAside } from '../external.ts';
import type { SatRecord } from '../../engine/types.ts';
import { CARD, dataAge, LEDGER, assumptionsLine, CHURCHYARD_INTRO, METHOD_SECTIONS, NOTES, snapshotLabel, verdictCopy } from '../copy.ts';
import { formatE, formatP, formatSigned } from '../format.ts';
import type { CaseFile } from '../case-file.ts';
import { CASES } from '../content.ts';
import { esc, withSansDigits } from '../html.ts';
import { eccentricityRoundingMatters, edgesOf, isRetired, marginsSentence, orbitNotes, statusLines, verdictSentence } from '../ledger-text.ts';
import type { Retired } from '../ledger-text.ts';
import { renderMarkdown } from '../markdown.ts';
import type { UiRegister } from '../register.ts';
import { badgeHtml } from './badge.ts';
import { noteHtml } from './note.ts';
import { thresholdBarHtml } from './threshold.ts';
export { eccentricityRoundingMatters, statusLines, verdictSentence };
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
  const date = snapshotLabel(reg.snapshot.set).replace('CelesTrak snapshot, ', '');
  const era = v.era === 'before FCC rule' ? `<p class="era-badge">${esc(CARD.beforeRule)}</p>` : '';
  // A figure from outside the register that the case file cites (src/ui/external.ts). The link prints with its address.
  const ext = EXTERNAL.get(r.norad);
  const fine = ext?.fine === undefined ? '' : `<p class="ledger-fine">${esc(ext.fine.before)}<a href="${esc(ext.fine.url)}">${esc(ext.fine.linkText)}</a>${esc(ext.fine.after)}</p>`;
  const aside = ext?.perigee === undefined ? '' : `<span class="dd-aside">${esc(perigeeAside(ext.perigee, r.pKm))}</span>`;
  const identity = section(
    'identity',
    H.identity,
    `<dl class="ledger-data">${row(F.name, r.name)}${row(F.norad, String(r.norad))}${row(F.designator, r.intlDes ?? LEDGER.notGiven)}${row(F.owner, r.owner ?? LEDGER.notGiven)}${row(F.launch, r.launchDate ?? LEDGER.unknown)}</dl>${era}${fine}`,
  );
  // The header card's badge carries the churchyard word and its meaning once, so this section holds the sentence only.
  const verdict = section('verdict', H.verdict, paras([verdictSentence(r, config)]));
  const maths = section(
    'maths',
    H.maths,
    thresholdBarHtml(r, config) +
      paras([
        `${LEDGER.formula(config)} ${LEDGER.range(config)}`,
        marginsSentence(r, config),
        `Eccentricity e = ${formatE(r.e, config.iadc.eccentricityMax)}. The IADC limit is ${config.iadc.eccentricityMax}.`,
      ]) +
      noteHtml([LEDGER.formula(config).slice(0, -1), NOTES.perigee(config.uncertaintyKm), NOTES.source(date)], METHOD_SECTIONS.iadc),
  );
  const assumptions = section(
    'assumptions',
    H.assumptions,
    paras([assumptionsLine(config), LEDGER.assumedRanges(config), v.borderline ? CARD.borderline(config) : LEDGER.notBorderline(config)]),
  );
  const orbit = section(
    'orbit',
    H.orbit,
    `<p><strong>${esc(r.orbitSource.kind === 'GP' ? dataAge(r) : LEDGER.satcatSource)}</strong></p>` +
      `<dl class="ledger-data"><div><dt>${esc(F.perigee)}</dt><dd>${esc(`${pText} km`)}${aside}</dd></div>${row(F.apogee, `${formatSigned(r.qKm, decimals)} km`)}${row(F.eccentricity, formatE(r.e, config.iadc.eccentricityMax))}` +
      `${row(F.perigeeAltitude, `${formatSigned(r.perigeeKm, decimals).replace('+', '')} km`)}${row(F.apogeeAltitude, `${formatSigned(r.apogeeKm, decimals).replace('+', '')} km`)}</dl>` +
      paras(orbitNotes(r, config)) +
      noteHtml([NOTES.perigee(config.uncertaintyKm), NOTES.source(date)], METHOD_SECTIONS.gp),
  );
  const sources = reg.snapshot.sources
    .map((s) => `<li><a href="${esc(s.url)}">${esc(s.file)}</a>, ${esc(LEDGER.fetched)} ${esc(s.fetchedAt)}</li>`)
    .join('');
  const snapshot = section('snapshot', H.snapshot, `${paras([LEDGER.snapshotLine(reg.snapshot.set), ...(reg.sample ? [LEDGER.sampleNote] : [])])}<ul>${sources}</ul>`);
  const status = section('status', H.status, paras(statusLines(r, config)) + noteHtml([`Status from ${r.statusSource ?? 'SATCAT'}`, NOTES.source(date)], METHOD_SECTIONS.status));
  const context = section('context', H.context, paras([CHURCHYARD_INTRO.voluntary, CHURCHYARD_INTRO.noRetirementDate]));
  const cite = section(
    'cite',
    H.cite,
    `<ul class="cite">${LEDGER.citation(r.name, r.norad, reg.snapshot.set).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` +
      paras([LEDGER.citeNote]),
  );
  const actions = section(
    'actions',
    H.actions,
    `<p class="ledger-actions"><button type="button" class="button" data-print>${esc(LEDGER.print)}</button> <button type="button" class="button" data-download>${esc(LEDGER.download)}</button></p>`,
  );
  const footer =
    `<footer class="ledger-footer"><p>${esc(LEDGER.footer(reg.snapshot.set))}</p><ul>` +
    reg.snapshot.sources.map((s) => `<li>${esc(s.file)}: <code>${esc(s.sha256)}</code></li>`).join('') +
    `</ul></footer>`;
  // The header card: who, the verdict as a badge, and the age and assumptions the verdict rests on.
  // The register entry: a mono number, the name in IM Fell, the verdict, and a strip of readings with the age and the assumptions they rest on.
  const readings: [string, string][] = [
    [F.perigee, `${pText} km`],
    [F.apogee, `${formatSigned(r.qKm, decimals)} km`],
    [F.eccentricity, formatE(r.e, config.iadc.eccentricityMax)],
    [H.orbit, r.orbitSource.kind === 'GP' ? LEDGER.strip.gp(r.orbitSource.epoch) : LEDGER.strip.satcat],
    [H.snapshot, date],
    [H.assumptions, LEDGER.strip.assumptions(config)],
  ];
  const head =
    `<header class="ledger-head"><p class="entry-no">No. ${r.norad}</p>` +
    `<div class="ledger-head-main"><p class="ledger-name">${withSansDigits(r.name)}</p>${badgeHtml(v.verdict, config)}</div>` +
    `<dl class="readings">${readings.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl></header>`;
  // Two columns. Left: the verdict and the maths behind it. Right: the object, its elements, its sources and how to cite it.
  return (
    `<article class="ledger"><p class="print-title">${esc(LEDGER.printTitle)}: NORAD <span class="num">${r.norad}</span></p>` +
    head +
    `<div class="ledger-grid"><div class="ledger-col ledger-col--main">${verdict}${maths}${assumptions}${context}</div>` +
    `<div class="ledger-col ledger-col--side">${identity}${orbit}${status}${snapshot}${cite}${actions}</div></div>` +
    caseFileSection(r, cases) +
    footer +
    `</article>`
  );
}
/** The page for any NORAD id: a ledger, or a plain note when the object has no verdict or is not in the register. */
export function ledgerPageHtml(reg: UiRegister, norad: number, cases: ReadonlyMap<number, CaseFile> = CASES): string {
  const r = reg.records.find((x) => x.norad === norad);
  if (r === undefined) return noStoneHtml(norad);
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
