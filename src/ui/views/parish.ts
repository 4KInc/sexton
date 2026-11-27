// The parish register (R13, design 10): one operator or one SATCAT owner code, its retired payloads by verdict.
// Pure string builders plus mountParish. Every number comes from `parishOf` and the register; the words are in parish-copy.ts.
// The two kinds of group are never merged, and nothing here ranks, scores or compares groups.
import type { Group, ParishPage } from '../../engine/parish.ts';
import { OWNER_NOT_GIVEN, parishGroups, parishOf } from '../../engine/parish.ts';
import type { SatRecord, VerdictName } from '../../engine/types.ts';
import { assumptionsLine, CHURCHYARD_INTRO, dataAge, PAGE_TITLES, SITE, snapshotLabel, VERDICT_ORDER, verdictCopy } from '../copy.ts';
import { csvLine, safeText } from '../csv.ts';
import { formatSigned } from '../format.ts';
import { esc } from '../html.ts';
import { PARISH } from '../parish-copy.ts';
import type { ParishScope } from '../router.ts';
import type { UiRegister } from '../register.ts';
import { DEFAULT_SORT, hashFor, NO_FILTERS, OWNER_NONE } from '../state.ts';
import type { EraFilter, Filters } from '../state.ts';

/** The address of a parish page. The name or code goes through encodeURIComponent, so any character is safe. */
export const parishHash = (scope: ParishScope, key = ''): string =>
  scope === 'index' ? '#/parish' : `#/parish/${scope === 'operator' ? 'op' : 'owner'}/${encodeURIComponent(key)}`;
const groupOf = (scope: Exclude<ParishScope, 'index'>, key: string): Group => ({ kind: scope, key });
/** What the page calls a group: the operator's name, the owner code as given, or "Owner not given". */
const titleOf = (g: Group): string => (g.kind === 'owner' && g.key === OWNER_NOT_GIVEN ? PARISH.notGiven : g.key);
/** The table filters that select exactly this group. */
const groupFilters = (g: Group): Partial<Filters> => (g.kind === 'operator' ? { operator: g.key } : { owner: g.key === OWNER_NOT_GIVEN ? OWNER_NONE : g.key });
const tableLink = (g: Group, extra: Partial<Filters>): string => hashFor('table', { filters: { ...NO_FILTERS, ...groupFilters(g), ...extra }, sort: DEFAULT_SORT });
const orbitDecimals = (r: SatRecord): number => (r.orbitSource.kind === 'GP' ? 1 : 0);

/** The list of groups: operators first, then SATCAT owner codes, each alphabetical, with counts only. */
export function parishIndexHtml(reg: UiRegister): string {
  const { operators, owners } = parishGroups(reg.records);
  const item = (scope: 'operator' | 'owner', key: string, count: number): string =>
    `<li><a href="${esc(parishHash(scope, key))}">${esc(scope === 'owner' && key === OWNER_NOT_GIVEN ? PARISH.notGiven : key)}</a> <span class="mono parish-count">${esc(PARISH.groupCount(count))}</span></li>`;
  const ops =
    operators.length === 0 ? `<p>${esc(PARISH.operators.none)}</p>` : `<ul class="parish-list" data-parish="operators">${operators.map((o) => item('operator', o.key, o.count)).join('')}</ul>`;
  return (
    `<div class="parish">` +
    `<p class="lead">${esc(PARISH.indexLead)}</p>` +
    `<section class="parish-block" aria-labelledby="parish-operators"><h2 id="parish-operators">${esc(PARISH.operators.heading)}</h2><p>${esc(PARISH.operators.note)}</p>${ops}</section>` +
    `<section class="parish-block" aria-labelledby="parish-owners"><h2 id="parish-owners">${esc(PARISH.owners.heading)}</h2><p>${esc(PARISH.owners.note)}</p>` +
    `<ul class="parish-list parish-list--owners" data-parish="owners">${owners.map((o) => item('owner', o.key, o.count)).join('')}</ul></section>` +
    `<p class="parish-caveats">${esc(CHURCHYARD_INTRO.blindSpot)} ${esc(CHURCHYARD_INTRO.voluntary)}</p>` +
    `</div>`
  );
}

/** One verdict row: the word with its plain meaning (its first appearance on the page), and a count that links to the filtered table. */
function countsHtml(page: ParishPage, reg: UiRegister): string {
  const C = PARISH.counts;
  const rows = VERDICT_ORDER.map((v: VerdictName) => {
    const n = page.byVerdict[v];
    return `<tr><th scope="row">${esc(verdictCopy(v, reg.config).pair)}</th><td class="num-cell" data-parish-count="${esc(v)}"><a href="${esc(tableLink(page.group, { verdicts: [v] }))}">${esc(C.of(n, page.total))}</a></td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="register-table parish-table"><caption>${esc(C.caption)}</caption><thead><tr><th scope="col">${esc(C.verdict)}</th><th scope="col" class="num-head">${esc(C.count)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function detailsHtml(page: ParishPage, reg: UiRegister): string {
  const D = PARISH.details;
  const era = (key: EraFilter, label: string, n: number): string =>
    `<li>${esc(label)}: <a href="${esc(tableLink(page.group, { era: key }))}" data-parish-era="${key}">${esc(PARISH.counts.of(n, page.total))}</a></li>`;
  return (
    `<p data-parish="borderline">${esc(D.borderline(page.borderline, page.total, reg.config.uncertaintyKm))}</p>` +
    `<h3>${esc(D.era)}</h3><ul>${era('before', D.before, page.era.beforeRule)}${era('after', D.after, page.era.onOrAfterRule)}${era('unknown', D.unknown, page.era.unknown)}</ul>` +
    `<h3>${esc(D.source)}</h3><ul><li>${esc(D.gp)}: ${esc(PARISH.counts.of(page.orbitSource.GP, page.total))}</li><li>${esc(D.satcat)}: ${esc(PARISH.counts.of(page.orbitSource.SATCAT, page.total))}</li></ul>`
  );
}

/** The assumptions, the snapshot and the data age, beside every count (R13.6). */
function assumptionsHtml(page: ParishPage, reg: UiRegister): string {
  const gp = page.gpEpochs === null ? null : { ...page.gpEpochs, n: page.orbitSource.GP };
  return `<p class="parish-assumptions" data-parish="assumptions">${esc(PARISH.snapshot(snapshotLabel(reg.snapshot.set).replace('CelesTrak snapshot, ', '')))} ${esc(assumptionsLine(reg.config))} ${esc(PARISH.dataAge(gp, page.orbitSource.SATCAT))}</p>`;
}

function operatorCell(r: SatRecord, group: Group): string {
  if (typeof r.operator === 'string') {
    const link = r.operatorSource === null || r.operatorSource === undefined ? '' : ` <a href="${esc(r.operatorSource)}" rel="noopener noreferrer">${esc(PARISH.rows.source)}</a>`;
    return `${esc(PARISH.relation(r.operator, r.operatorRelation ?? 'operator'))}${link}`;
  }
  if (r.operator === null) return esc(PARISH.rows.notSourced);
  return group.kind === 'operator' ? '' : esc(PARISH.rows.outOfScope);
}

function rowsHtml(page: ParishPage): string {
  const R = PARISH.rows;
  const body = page.rows
    .map((r) => {
      const v = r.verdict.verdict;
      return (
        `<tr><th scope="row"><a href="#/sat/${r.norad}">${esc(r.name)}</a></th><td class="mono">${r.norad}</td><td class="mono">${esc(r.launchDate ?? R.unknownLaunch)}</td>` +
        `<td>${esc(verdictShort(v))}</td><td class="num-cell">${esc(formatSigned(r.pKm, orbitDecimals(r)))}</td><td>${esc(dataAge(r))}</td><td>${operatorCell(r, page.group)}</td></tr>`
      );
    })
    .join('');
  const head = [R.name, R.norad, R.launch, R.verdict, R.p, R.age, R.operator].map((h) => `<th scope="col">${esc(h)}</th>`).join('');
  return `<div class="table-wrap"><table class="register-table parish-table parish-rows"><caption>${esc(R.caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
/** The verdict word alone: its meaning was given once, in the counts table. */
const verdictShort = (v: VerdictName): string => v.charAt(0).toUpperCase() + v.slice(1);

/** The page for one operator or one owner code. A group with no retired payload gets one sentence and a link to the list. */
export function parishPageHtml(reg: UiRegister, scope: Exclude<ParishScope, 'index'>, key: string): string {
  const g = groupOf(scope, key);
  const page = parishOf(reg.records, g);
  const back = `<p><a href="${esc(parishHash('index'))}">${esc(PARISH.allGroups)}</a></p>`;
  if (page.total === 0) return `<div class="parish"><p>${esc(PARISH.empty(`${PARISH.kind[scope]}: ${titleOf(g)}`))}</p>${back}</div>`;
  const note = scope === 'owner' ? PARISH.ownerNote(key, page.withOperator, page.total) : PARISH.operatorNote(page.total);
  return (
    `<div class="parish">` +
    `<p class="print-title">${esc(PARISH.printTitle)}: ${esc(titleOf(g))}</p>` +
    `<p class="kicker">${esc(PARISH.kind[scope])}</p>` +
    `<p class="parish-note" data-parish="note">${esc(note)}</p>` +
    countsHtml(page, reg) +
    assumptionsHtml(page, reg) +
    detailsHtml(page, reg) +
    rowsHtml(page) +
    `<p class="parish-caveats" data-parish="caveats">${esc(PARISH.caveats.counts)} ${esc(CHURCHYARD_INTRO.blindSpot)} ${esc(CHURCHYARD_INTRO.voluntary)} ${esc(CHURCHYARD_INTRO.noRetirementDate)}</p>` +
    `<p class="parish-actions"><button type="button" class="button" data-print>${esc(PARISH.print)}</button> <button type="button" class="button" data-parish-csv>${esc(PARISH.csv)}</button> <button type="button" class="button" data-parish-json>${esc(PARISH.json)}</button></p>` +
    back +
    `</div>`
  );
}

/** The page's rows as one line per payload, each with the group, the operator and its source, the assumptions and the data age. */
export function parishCsv(reg: UiRegister, scope: Exclude<ParishScope, 'index'>, key: string): string {
  const g = groupOf(scope, key);
  const page = parishOf(reg.records, g);
  const c = reg.config;
  const range = `${c.iadc.crAmMin} to ${c.iadc.crAmMax}`;
  const note = `Sexton parish register, ${PARISH.kind[scope]}: ${titleOf(g)}. CelesTrak snapshot ${reg.snapshot.set}. ${assumptionsLine(c)} ${CHURCHYARD_INTRO.voluntary} ${CHURCHYARD_INTRO.blindSpot} ${CHURCHYARD_INTRO.noRetirementDate}`;
  const lines = [
    csvLine([note]),
    csvLine(PARISH.csvColumns),
    ...page.rows.map((r, i) =>
      csvLine([
        String(i + 1),
        PARISH.kind[scope],
        safeText(titleOf(g)),
        safeText(r.name),
        String(r.norad),
        safeText(r.owner ?? ''),
        safeText(typeof r.operator === 'string' ? r.operator : ''),
        safeText(typeof r.operator === 'string' ? (r.operatorRelation ?? '') : ''),
        typeof r.operator === 'string' ? (r.operatorSource ?? '') : '',
        r.launchDate ?? '',
        verdictCopy(r.verdict.verdict, c).word,
        r.verdict.borderline ? 'yes' : 'no',
        r.pKm.toFixed(orbitDecimals(r)),
        r.qKm.toFixed(orbitDecimals(r)),
        r.e.toFixed(5),
        r.orbitSource.kind,
        dataAge(r),
        reg.snapshot.set,
        range,
        String(c.uncertaintyKm),
      ]),
    ),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** The same rows as JSON, with the snapshot, the assumptions and the caveats in the header. */
export function parishJson(reg: UiRegister, scope: Exclude<ParishScope, 'index'>, key: string): string {
  const g = groupOf(scope, key);
  const page = parishOf(reg.records, g);
  const c = reg.config;
  return `${JSON.stringify(
    {
      snapshot: reg.snapshot.set,
      group: { kind: PARISH.kind[scope], name: titleOf(g), key },
      assumptions: { crAmRangeM2PerKg: [c.iadc.crAmMin, c.iadc.crAmMax], meanElementUncertaintyKm: c.uncertaintyKm },
      notes: [CHURCHYARD_INTRO.voluntary, CHURCHYARD_INTRO.blindSpot, CHURCHYARD_INTRO.noRetirementDate],
      counts: { total: page.total, byVerdict: page.byVerdict, borderline: page.borderline, era: page.era, orbitSource: page.orbitSource },
      rows: page.rows.map((r) => ({
        norad: r.norad,
        name: r.name,
        owner: r.owner,
        operator: typeof r.operator === 'string' ? { name: r.operator, relation: r.operatorRelation ?? null, source: r.operatorSource ?? null } : null,
        launchDate: r.launchDate,
        verdict: r.verdict.verdict,
        borderline: r.verdict.borderline,
        pKm: r.pKm,
        qKm: r.qKm,
        e: r.e,
        orbitSource: r.orbitSource.kind,
        dataAge: dataAge(r),
      })),
    },
    null,
    2,
  )}\n`;
}

/** "sexton-parish-operator-JAXA-2026-11-22.csv": letters, digits and dashes only. */
export const parishFileName = (scope: Exclude<ParishScope, 'index'>, key: string, snapshot: string, ext: 'csv' | 'json'): string =>
  `sexton-parish-${scope}-${key.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '') || 'group'}-${snapshot.replace(/[^0-9A-Za-z-]/g, '')}.${ext}`;

function save(name: string, text: string, type: string, bom: boolean): void {
  const url = URL.createObjectURL(new Blob(bom ? ['\uFEFF', text] : [text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Draws the list or one group into `root`. Returns a function that removes the listeners. */
export function mountParish(root: HTMLElement, reg: UiRegister, scope: ParishScope, key: string): () => void {
  if (scope === 'index') {
    root.innerHTML = parishIndexHtml(reg);
    return () => undefined;
  }
  root.innerHTML = parishPageHtml(reg, scope, key);
  // The unknown owner is titled "Owner not given" (R13.11). The heading in the page chrome says the code, so the view corrects it.
  if (scope === 'owner' && key === OWNER_NOT_GIVEN) {
    const title = `${PAGE_TITLES.parish}: ${PARISH.notGiven}`;
    const h1 = document.getElementById('page-title');
    if (h1 !== null) h1.textContent = title;
    document.title = `${title} · ${SITE.title}`;
  }
  const onClick = (event: Event): void => {
    const target = event.target as Element;
    if (target.closest('[data-print]') !== null) window.print();
    else if (target.closest('[data-parish-csv]') !== null) save(parishFileName(scope, key, reg.snapshot.set, 'csv'), parishCsv(reg, scope, key), 'text/csv;charset=utf-8', true);
    else if (target.closest('[data-parish-json]') !== null) save(parishFileName(scope, key, reg.snapshot.set, 'json'), parishJson(reg, scope, key), 'application/json', false);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

