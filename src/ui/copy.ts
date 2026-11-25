// All user-facing strings, in one place (design 5.2). The language check reads this file.
// Rules: .kiro/steering/language.md. No retirement dates. Churchyard words are always paired
// with their plain technical meaning.
import type { Config } from '../engine/config.ts';
import type { SatRecord, VerdictName } from '../engine/types.ts';
import { formatCount, formatSigned, MINUS } from './format.ts';
import { SCALE } from './svg/scale.ts';

export const SITE = {
  title: 'Sexton',
  url: 'https://4kinc.github.io/sexton/',
  tagline: 'Register of retired geostationary satellites',
  skipToMain: 'Skip to main content',
  skipToTable: 'Skip the churchyard drawing and go to the table view',
  sampleBanner: 'Sample data for layout only. This is not the register.',
  loadError: 'The register could not be loaded. Try again later.',
  loading: 'Loading the register.',
  notFound: 'There is no page at this address.',
  backToChurchyard: 'Back to the churchyard',
  /** On a ledger page, the link back to the list the visitor came from. */
  backTo: { churchyard: '\u2190 Back to churchyard', table: '\u2190 Back to table' },
} as const;

export const NAV = [
  { href: '#/', label: 'Churchyard', route: 'churchyard' },
  { href: '#/table', label: 'Table', route: 'table' },
  { href: '#/census', label: 'Census', route: 'census' },
  { href: '#/method', label: 'Method', route: 'method' },
] as const;

export const PAGE_TITLES = {
  churchyard: 'Churchyard',
  table: 'Table',
  sat: 'Ledger',
  census: 'Census',
  method: 'Method',
  notfound: 'Not found',
} as const;

/** First appearance of each term gets its one-line explanation (language.md). */
export const TERMS = {
  geo: 'GEO: the circular orbit about 35,786 km above the equator, where a satellite stays over one spot.',
  perigee: 'Perigee: the lowest point of an orbit.',
  eccentricity: 'Eccentricity: how far an orbit is from a perfect circle. 0 is a circle.',
} as const;

export const CHURCHYARD_INTRO = {
  lead: 'Each stone is a retired satellite, as tall as its perigee above GEO. The road is the protected zone: a stone standing on it has not been raised out of the zone.',
  voluntary:
    'The IADC guidelines are voluntary. The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002.',
  noRetirementDate: 'We know each launch date and current orbit. We do not know when a satellite retired.',
  blindSpot:
    'The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.',
} as const;

/** The guided tour over the churchyard (views/tour.ts). Figures: the FCC order DA 23-888 (docs/methodology.md, Sources). */
export const TOUR = {
  label: 'Guided tour',
  start: 'Take the tour',
  next: 'Next',
  back: 'Back',
  done: 'Explore freely',
  skip: 'Skip the tour',
  stepOf: (i: number, n: number): string => `Step ${i} of ${n}.`,
  steps: {
    zone: (km: number): string => `The road is the protected zone, \u00B1${km} km around GEO.`,
    rule: 'The FCC rule covers satellites launched from 18 March 2002.',
    story: (n: number, of: number): string => `${n} of ${of} launched since then sit in or near the zone.`,
    echostar: 'EchoStar 7: fined $150,000 by the FCC (DA 23-888). Perigee about 122 km against a planned 300 km.',
  },
  zoneSub: 'The protected zone is the band the IADC guidelines ask retired satellites to leave.',
  ruleSub: 'The rule applies only to satellites the FCC authorizes. Stones launched before the line are dimmed.',
  echoSub: (p: string): string => `Sexton's own reading from the snapshot: ${p} km above GEO.`,
} as const;
/** The hero of the churchyard view: one caption sentence, three tiles that link to the census, and the fine print. */
export const HERO = {
  kicker: '\u00A7 01 \u00B7 The churchyard',
  pitch: 'Which retired geostationary satellites were buried above the belt, and which still drift in it.',
  caption: 'Each stone is a retired satellite, as tall as its perigee above GEO. The road is the protected zone.',
  /** First appearance of GEO and perigee, in small type under the caption (language.md). */
  postRule: { label: 'retired payloads launched after the FCC rule', sub: 'On or after 18 March 2002.' },
  zone: {
    of: (n: number): string => `of ${formatCount(n)}`,
    label: 'in or near the protected zone',
    sub: 'Below the IADC disposal threshold, under the stated assumptions.',
  },
  /**
   * The headline above the chart: the two post-rule figures, read as one sentence, big against their short
   * label. "131" is said once here, so the tiles below the chart (census) do not repeat it. "Below the IADC
   * disposal threshold" is the plain meaning of "in or near the protected zone", said once, here.
   */
  headlineFigure: (zone: number, postRule: number): string => `${formatCount(zone)} of ${formatCount(postRule)}`,
  headlineLabel:
    'retired payloads launched on or after the FCC rule date are still in or near the protected zone.',
  /** The headline's second line. It is the one place GEO and perigee are explained on the churchyard. */
  headlineSub:
    "Below the IADC disposal threshold, under the stated assumptions. GEO is the 35,786 km belt; perigee is an orbit's lowest point.",
  validation: {
    label: (range: readonly [number, number] | null): string => `Sexton${range === null ? ': buried share' : ` vs ESA ${range[0]}\u2013${range[1]}%`}`,
    sub: (year: number): string => `Launched after ${year}. Different groups: a plausibility check.`,
  },
  /** The one-line fine print under the tiles. The full text is behind "Limits". */
  fine: (snapshot: string, config: Config): string[] => [
    snapshot,
    `C_R\u00B7A/m ${config.iadc.crAmMin}\u2013${config.iadc.crAmMax} m\u00B2/kg`,
    `\u00B1${config.uncertaintyKm} km`,
    'The register only sees objects still near GEO',
    'IADC guidelines are voluntary',
    'FCC rule covers FCC-authorized launches from 18 Mar 2002',
  ],
  limits: 'Limits',
  guide: 'How to read the churchyard',
  guideHint: 'What the marks and words mean',
} as const;
/** The methodology page is docs/methodology.md. Only its chrome is here. */
export const METHOD = {
  contents: 'On this page',
  openAll: 'Open all sections',
  closeAll: 'Close all sections',
  tableLabel: 'Table from the methodology. Scroll sideways to see every column.',
} as const;
export const CHART = {
  title: 'Churchyard of retired geostationary satellites',
  axisTitle: 'Perigee above GEO, km',
  yearAxisTitle: 'Launch year',
  unknownYear: 'Unknown',
  unknownYearTitle: 'Launch year unknown',
  geoLabel: 'GEO',
  fccLine: 'FCC minimum-perigee rule (launches from 18 Mar 2002)',
  fccLineShort: 'FCC rule line',
  /** Drawn in small mono capitals on the chart. */
  fccLabel: 'FCC rule \u00B7 18 Mar 2002',
  zoneLabel: (km: number): string => `Protected zone \u00B1${km} km`,
  empty: 'No retired payloads in this register.',
  legendTitle: 'The ground, the stones and the marks',
  designatorNote: 'Launch year from the international designator. Moss is not shown.',
  mossUnknown: 'No moss: launch date unknown.',
  highGround: 'High ground: compressed scale',
  scrollNote: 'This chart is wide. Scroll it sideways, or read the same objects in the',
  scrollLink: 'table view',
  scrollRegion: 'Churchyard chart. Scroll sideways to see every launch year.',
} as const;

export function chartDescription(config: Config): string {
  return `Height is perigee above GEO, from ${formatSigned(SCALE.minKm, 0)} to ${formatSigned(SCALE.maxKm, 0)} km. The scale is linear up to ${formatSigned(SCALE.linearMaxKm, 0)} km. Above that, the high ground, it is compressed. Columns are launch years. The bands are set by ${config.protectedZoneKm} km above and below GEO and by the IADC threshold of ${config.thresholdLowKm} to ${config.thresholdHighKm} km.`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** "2026-11-22" becomes "CelesTrak snapshot, 22 Nov 2026". Anything that is not a date is shown as given. */
export function snapshotLabel(set: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(set);
  const month = m === null ? undefined : MONTHS[Number(m[2]) - 1];
  if (m === null || month === undefined) return `CelesTrak snapshot, ${set}`;
  return `CelesTrak snapshot, ${Number(m[3])} ${month} ${m[1]}`;
}
export function countLine(shown: number, snapshotDate: string): string {
  const noun = shown === 1 ? 'retired payload' : 'retired payloads';
  return `${snapshotLabel(snapshotDate)}: ${shown} ${noun}.`;
}

export type BandCopyId = 'below' | 'road' | 'shallow' | 'wall' | 'consecrated';

/** Short name drawn in the chart, and the full label with its plain meaning for the legend. */
export function bandCopy(id: BandCopyId, config: Config): { short: string; full: string } {
  const zone = config.protectedZoneKm;
  switch (id) {
    case 'below':
      return { short: 'Below the zone', full: 'Below the protected zone' };
    case 'road':
      return { short: 'The road', full: `The road: the GEO protected zone, ±${zone} km` };
    case 'shallow':
      return { short: 'Shallow ground', full: 'Shallow ground: above the zone, below the IADC threshold' };
    case 'wall':
      return {
        short: 'The wall',
        full: 'The churchyard wall: the IADC threshold band. Where it stands depends on the unknown C_R·A/m',
      };
    case 'consecrated':
      return {
        short: 'Consecrated ground',
        full: 'Consecrated ground: above the IADC threshold for every assumed C_R·A/m',
      };
  }
}

/** The churchyard word with its plain technical meaning, once (design.md, Copy). */
export function verdictCopy(verdict: VerdictName, config: Config): { word: string; meaning: string; pair: string } {
  const zone = config.protectedZoneKm;
  const e = config.iadc.eccentricityMax;
  const table: Record<VerdictName, { word: string; meaning: string }> = {
    fallen: { word: 'Fallen', meaning: `the whole orbit is below the protected zone, apogee more than ${zone} km under GEO` },
    unquiet: { word: 'Unquiet', meaning: `the orbit reaches the protected zone, perigee at most ${zone} km above GEO` },
    'shallow grave': { word: 'Shallow grave', meaning: 'perigee below the IADC threshold' },
    restless: { word: 'Restless', meaning: `perigee high enough, but eccentricity above ${e}` },
    uncertain: { word: 'Uncertain', meaning: 'perigee inside the IADC threshold band, so the result depends on the unknown C_R·A/m' },
    buried: { word: 'Buried', meaning: `perigee above the IADC threshold for every assumed C_R·A/m, eccentricity at most ${e}` },
  };
  const t = table[verdict];
  return { ...t, pair: `${t.word} (${t.meaning})` };
}

export const VERDICT_ORDER: readonly VerdictName[] = ['buried', 'uncertain', 'shallow grave', 'unquiet', 'restless', 'fallen'];

export const MOSS_STEPS = ['under 10 years', '10 to 19 years', '20 to 29 years', '30 years or more'] as const;

/** A SATCAT-only eccentricity this close to the limit gets the rounding note (docs/spike.md, section f). */
export const ECC_NOTE_BAND = 0.0005;
export const LEGEND = {
  moss: 'Moss: years since launch',
  sway: (config: Config): string => `A swaying stone: eccentricity above ${config.iadc.eccentricityMax}. The wider the sway, the higher the eccentricity.`,
  whisker: (config: Config): string => `Dotted bar: the verdict is within ${config.uncertaintyKm} km of a band edge, the mean-element uncertainty.`,
  early: 'Faint moss stone: launched before the date of the vertical line. Stones launched on or after it are brighter.',
  ring: 'Lantern glow: launched on or after the date of the vertical line, with the perigee below the IADC disposal threshold under the stated assumptions.',
  named: 'Name beside a stone: a case file is written for it.',
  fccLine: 'Vertical line: 18 March 2002, the date from which the FCC minimum-perigee rule applies to the satellites the FCC authorizes.',
  bones: 'Small diamond: unmarked bones, a rocket body or a piece of debris. They carry no name or verdict and show only when switched on.',
  offScale: 'A count at the top or bottom edge: objects above the top limit or below the bottom limit of the scale. Their exact values are on the card and in the ledger.',
  unevenYears: 'Busy years get wider columns, so the spacing between years is not to scale.',
  highGround: 'Above +400 km the scale is compressed, and a zigzag marks the break. The same height there means a larger distance than below the break.',
} as const;

export function assumptionsLine(config: Config): string {
  const [lo, hi] = [config.iadc.crAmMin, config.iadc.crAmMax];
  return `Assumes C_R·A/m from ${lo} to ${hi} m²/kg and a mean-element uncertainty of ±${config.uncertaintyKm} km.`;
}

export function dataAge(record: Pick<SatRecord, 'orbitSource'>): string {
  const s = record.orbitSource;
  if (s.kind === 'SATCAT') return 'SATCAT, element date not given';
  const date = s.epoch.slice(0, 10);
  const time = s.epoch.slice(11, 16);
  return `GP mean elements, epoch ${date} ${time} UTC`;
}

export const TIP = {
  perigee: (absText: string, below: boolean, uncertaintyKm: number): string => `Perigee ${absText} km ${below ? 'below' : 'above'} GEO, \u00B1${uncertaintyKm} km`,
  open: 'Click to select. Double-click opens the ledger.',
} as const;
export const CARD = {
  ledger: 'Open the ledger',
  close: 'Clear selection',
  perigee: 'Perigee above GEO',
  apogee: 'Apogee above GEO',
  eccentricity: 'Eccentricity',
  dataAge: 'Data age',
  borderline: (config: Config): string => `Borderline: within ${config.uncertaintyKm} km of a band edge.`,
  beforeRule: 'Launched before the FCC minimum-perigee rule date (18 March 2002).',
  yearsSinceLaunch: (years: number): string => `${years} ${years === 1 ? 'year' : 'years'} since launch`,
  empty: 'Click a stone, or press Enter on it, to read its card. Escape clears it. Double-click, or Enter again, opens its ledger.',
} as const;

/** Spoken label for a stone link (design 5.4). */
export function stoneLabel(
  name: string,
  verdict: VerdictName,
  spokenP: string,
  offScale: 'above' | 'below' | null,
  borderline: boolean,
): string {
  const where = spokenP.startsWith('minus') ? ', below GEO' : ' above GEO';
  const parts = [name, verdict, `perigee ${spokenP} kilometres${where}`];
  if (offScale !== null) parts.push('off the drawn scale');
  if (borderline) parts.push('borderline');
  return parts.join(', ');
}

export const FILTERS = {
  more: 'Owner, era and verdict filters',
  legend: 'Filter the register',
  note: 'The churchyard and the table share these filters. They are saved in the address, so you can share a filtered view.',
  search: 'Search by name or NORAD id',
  searchHint: 'For example "echostar" or "27378".',
  owner: 'Owner',
  anyOwner: 'Any owner',
  noOwner: 'Owner not given',
  verdict: 'Verdict',
  era: 'Launch era',
  anyEra: 'Any era',
  eraBefore: 'Launched before 18 March 2002',
  eraAfter: 'Launched on or after 18 March 2002',
  eraUnknown: 'Launch date unknown',
  bones: 'Show unmarked bones (rocket bodies and debris)',
  clear: 'Clear filters',
  none: 'No objects match these filters.',
  drawnShort: (n: number): string => `${formatCount(n)} retired ${n === 1 ? 'payload' : 'payloads'} drawn; others are in the table`,
  drawn: (n: number): string => `${n} drawn in the churchyard. Living and unknown-status payloads are in the table only.`,
  drawnUnfiltered: (n: number): string => `${n} retired ${n === 1 ? 'payload' : 'payloads'} drawn. Living and unknown-status payloads, rocket bodies and debris are in the table.`,
  count: (shown: number, total: number): string => `${shown} of ${total} ${total === 1 ? 'object' : 'objects'} match.`,
} as const;
export const LEDGER = {
  printTitle: 'Exhumation report',
  provisional: 'Provisional: not yet confirmed against SATCAT',
  back: 'Back to the table',
  notFound: (norad: number): string => `The register has no object with NORAD id ${norad}.`,
  noLedger: (name: string, norad: number, reason: string): string =>
    `${name} (NORAD ${norad}) has no verdict (${reason}), so it has no ledger. Its numbers are in the table.`,
  headings: {
    verdict: 'The verdict',
    identity: 'The object',
    maths: 'The threshold maths',
    orbit: 'Orbit source and data age',
    assumptions: 'Assumptions',
    snapshot: 'Snapshot and sources',
    status: 'Status source',
    caseFile: 'Case file',
    context: 'Context',
    cite: 'Cite this',
    actions: 'Report and data',
  },
  /** One line each, so the list can be copied as it is. The snapshot date is on its own line. */
  citation: (name: string, norad: number, snapshotDate: string): string[] => [
    'Sexton, a register of retired geostationary satellites.',
    `${name}, NORAD ID ${norad}.`,
    `${snapshotLabel(snapshotDate)}.`,
    `${SITE.url}#/sat/${norad}`,
  ],
  citeNote: 'A verdict holds only under its assumptions and for the data of this snapshot. Cite them with it.',
  fields: {
    name: 'Name',
    norad: 'NORAD id',
    designator: 'International designator',
    owner: 'Owner',
    launch: 'Launch date',
    perigee: 'Perigee above GEO',
    apogee: 'Apogee above GEO',
    eccentricity: 'Eccentricity',
    perigeeAltitude: 'Perigee altitude above the equatorial radius',
    apogeeAltitude: 'Apogee altitude above the equatorial radius',
  },
  notGiven: 'not given',
  unknown: 'unknown',
  /** The words around the threshold bar (design.md, Layout: the picture first, words second). */
  bar: {
    offWords: (off: 'below' | 'above'): string => `The mark is held at the ${off === 'above' ? 'right' : 'left'} end because p is beyond the bar.`,
    zone: (km: number): string => `${km} km: the edge of the protected zone.`,
    edge: (km: number, x: number): string => `${km} km: the IADC threshold if C_R\u00B7A/m is ${x} m\u00B2/kg.`,
    band: (u: number): string => `The bar around p: \u00B1${u} km, the mean-element uncertainty.`,
  },
  formula: (config: Config): string => `T = ${config.iadc.baseKm} + ${config.iadc.factorKm} × C_R·A/m.`,
  range: (config: Config): string =>
    `With C_R·A/m from ${config.iadc.crAmMin} to ${config.iadc.crAmMax} m²/kg, T is ${config.thresholdLowKm} to ${config.thresholdHighKm} km.`,
  assumedRanges: (config: Config): string =>
    `C_R is taken from ${config.iadc.crRange[0]} to ${config.iadc.crRange[1]} and A/m from ${config.iadc.amRange[0]} to ${config.iadc.amRange[1]} m²/kg. The true values for this satellite are not known.`,
  notBorderline: (config: Config): string => `Not borderline: more than ${config.uncertaintyKm} km from every band edge.`,
  gpOrbit: 'Perigee and apogee are computed from the mean motion and eccentricity in the GP mean elements.',
  satcatSource: 'SATCAT whole-km apogee and perigee, element date not given',
  satcatOrbit:
    'SATCAT rounds each altitude to 1 km, so perigee and apogee here carry up to 0.5 km of rounding, and the eccentricity is computed from the rounded altitudes.',
  eccentricityRounding: (e: string, limit: number): string =>
    `This eccentricity (${e}) is within ${ECC_NOTE_BAND} of the ${limit} limit. Whether it is above the limit decides the Restless verdict, and that result depends on the whole-km rounding of the SATCAT altitudes.`,
  offScaleAbove: (limitKm: number): string =>
    `This object is above the top of the drawn scale (${formatSigned(limitKm, 0)} km), so the churchyard counts it at the edge. The numbers here are its register values, not its drawn position.`,
  offScaleBelow: (limitKm: number): string =>
    `This object is below the bottom of the drawn scale (${formatSigned(limitKm, 0)} km), so the churchyard counts it at the edge. The numbers here are its register values, not its drawn position.`,
  highGround: (fromKm: number): string =>
    `This object stands on the high ground, above ${formatSigned(fromKm, 0)} km, where the churchyard scale is compressed. The numbers here are its register values, not its drawn position.`,
  snapshotLine: (set: string): string => `Snapshot ${set}.`,
  fetched: 'fetched',
  sampleNote: 'This register is sample data for layout only.',
  statusFrom: (status: string, source: string): string => `Status: ${status}, from ${source}.`,
  statusGapSatcat: (code: string): string =>
    `SATCAT lists this object as a payload but gives no status. The status comes from the GPZ table (${code}).`,
  statusNoSatcat: (code: string): string => `SATCAT has no entry for this object. The status comes from the GPZ table (${code}).`,
  statusDisagree: (satcat: string, table: string, code: string): string =>
    `SATCAT gives "${satcat}". The GPZ table gives "${table}" (${code}). The register uses the SATCAT status.`,
  print: 'Print exhumation report',
  download: 'Download JSON',
  footer: (set: string): string => `Sexton register, snapshot ${set}. Source files and their SHA-256 hashes:`,
} as const;
export const TABLE = {
  intro: 'Every object the register holds, with the same numbers as the churchyard.',
  lead: 'Every object the register holds, one numbered line each, with the same numbers as the churchyard.',
  verdictKey: 'The verdict words',
  kicker: '\u00A7 02 \u00B7 The register',
  sortBy: 'Sort by',
  verdictKeySummary: 'The verdict words, and what each one means',
  caption: 'Objects near GEO in the register',
  /** Shown in the table's caption: what the short column heads mean. */
  colKey: (u: number): string => `p perigee, q apogee (above GEO, km) \u00B7 e eccentricity \u00B7 \u00B1 borderline, within \u00B1${u} km of a band edge`,
  /** The short heads. The full name is read to screen readers. */
  heads: { norad: 'NORAD', borderline: '\u00B1', p: 'p, km', q: 'q, km', e: 'e', source: 'Orbit' },
  sortedBy: (label: string, dir: 'asc' | 'desc'): string => `Sorted by ${label}, ${dir === 'asc' ? 'ascending' : 'descending'}.`,
  columns: {
    name: 'Name',
    norad: 'NORAD id',
    owner: 'Owner',
    launch: 'Launch date',
    verdict: 'Verdict',
    borderline: 'Borderline',
    p: 'Perigee above GEO, km',
    q: 'Apogee above GEO, km',
    e: 'Eccentricity',
    source: 'Orbit source',
    age: 'Data age',
  },
  unknown: 'unknown',
  notApplicable: 'n/a',
  yes: 'Yes',
  no: 'No',
  bones: (kind: string): string => `No verdict: unmarked bones (${kind})`,
  noVerdict: (reason: string): string => `No verdict: ${reason}`,
  scrollLabel: 'Table of objects. Scroll sideways to see every column.',
} as const;
export const OFF_SCALE_ARROW = { above: '\u25B2', below: '\u25BC' } as const;
/** One label per edge: how many objects are beyond the limit. */
export const offScaleEdgeText = (side: 'above' | 'below', count: number, limitKm: number): string =>
  `${OFF_SCALE_ARROW[side]} ${count} more ${side} ${formatSigned(limitKm, 0)} km`;
export { MINUS };

/**
 * The comparison figures (design 5.7 and 6). A figure is shown only when `verified` is true, and it is
 * true only when design.md section 6 marks the figure verified and records where it was found.
 * test/census-page.test.ts checks this list against section 6.
 */
export interface Comparison {
  id: 'esa' | 'roberts';
  /** Name of the source, as design.md section 6 lists it. */
  source: string;
  /** What the source says. Never rendered while `verified` is false. */
  figure: string;
  /** The checked link. Rendered only with a verified figure. */
  url: string;
  verified: boolean;
  /** Where in the source the figure was found. Required once `verified` is true. */
  where: string | null;
  /** The published range in percent, for the validation panel. Null when the source gives no range. */
  range: readonly [number, number] | null;
}
export const COMPARISONS: readonly Comparison[] = [
  {
    id: 'esa',
    source: 'ESA Annual Space Environment Report, Issue 9.1',
    figure: 'ESA: 70\u201395% of payloads reaching end of life in the last decade clear the GEO protected region successfully. It is a range over the years, not one rate.',
    url: 'https://www.sdo.esoc.esa.int/environment_report/Space_Environment_Report_I9R1_20251021.pdf',
    verified: true,
    where: 'Executive summary, page 7 of 146 (21 October 2025). Issue 10 of 8 September 2026 gives 70\u201390% in the same sentence',
    range: [70, 95],
  },
  {
    id: 'roberts',
    source: 'Roberts, Georgia Tech, 2025',
    figure: 'Roberts: 73%.',
    url: 'https://iac.gatech.edu/publications/pub/8089',
    verified: false,
    where: null,
    range: null,
  },
];
/** Method sections that a chart's caveat links to. Each is the id of a heading on the method page (tested against docs/methodology.md). */
export const METHOD_SECTIONS = {
  verdicts: 'm-verdicts',
  iadc: 'm-the-iadc-threshold',
  era: 'm-the-group-launched-on-or-after-18-march-2002',
  sources: 'm-sources-of-data',
  validation: 'm-validation-against-published-figures',
  status: 'm-the-status-mapping',
  rules: 'm-two-rules-and-who-they-bind',
  gp: 'm-perigee-and-apogee-from-gp-mean-elements',
  blind: 'm-what-the-register-cannot-see',
} as const;
/** The one short mono note under each chart: where the numbers come from, how sure they are, and a link to the method. */
export const NOTES = {
  perigee: (u: number): string => `Perigee from GP mean elements or SATCAT altitudes, \u00B1${u} km`,
  hatched: (u: number): string => `Hatched: uncertain, or within \u00B1${u} km of a band edge`,
  source: (date: string): string => `CelesTrak, ${date}`,
  era: 'Launch date from SATCAT. The FCC rule covers only satellites the FCC authorizes',
  owner: 'Owner codes as SATCAT gives them. One operator can hold several',
  validation: (u: number): string => `Band: every perigee moved \u00B1${u} km. Different groups, so a plausibility check`,
  method: 'Method',
  link: (section: string): string => `Method, section ${section}`,
} as const;
/** The big numbers at the top of the census page. */
export const CENSUS_TILES = {
  objects: 'objects near GEO in the register',
  retired: 'retired payloads, each with a verdict',
  postRule: 'launched on or after the FCC rule date, 18 March 2002',
  zone: 'of those in or near the protected zone',
} as const;
export const VALIDATION = {
  heading: 'Validation against a published range',
  /** The side note beside the picture. */
  groupsTitle: 'Different groups',
  chart: {
    axis: 'Share of payloads that are buried, per cent',
    sexton: 'Sexton',
    esa: 'ESA',
    point: (c: number, n: number): string => `${c} of ${n}`,
    band: (lo: number, hi: number, n: number): string => `${lo} to ${hi} of ${n}`,
  },
  intro: (year: number): string =>
    `Sexton's own share of buried payloads, among retired payloads launched after ${year}, next to a published range. Sexton has no retirement dates, so launch year stands in for them. The two numbers count different groups, so they are a plausibility check, not a test of one against the other.`,
  sexton: 'Sexton: buried',
  band: (u: number): string => `Band if every perigee is ${u} km lower or higher`,
  published: (source: string): string => `Published: ${source}`,
  sextonValue: (n: number, of: number): string => `${formatCount(n)} of ${formatCount(of)} (${((100 * n) / of).toFixed(1)}%)`,
  bandValue: (lo: number, hi: number, of: number): string => `${VALIDATION.sextonValue(lo, of)} to ${VALIDATION.sextonValue(hi, of)}`,
  rangeValue: (lo: number, hi: number): string => `${lo}% to ${hi}%`,
  below: 'Sexton\u2019s share, and its whole band, are below the published range. Sexton has not adjusted its method to match. Possible reasons, none of them tested, are on the method page.',
  inside: 'Sexton\u2019s share is inside the published range. Sexton has not adjusted its method to match.',
  partly: 'Sexton\u2019s band overlaps the published range, but its share is outside it. Sexton has not adjusted its method to match. Possible reasons, none of them tested, are on the method page.',
  above: 'Sexton\u2019s share is above the published range. Sexton has not adjusted its method to match.',
  noGroup: (year: number): string => `No retired payload in the register was launched after ${year}.`,
  noPublished: 'No published range has been checked against its source yet.',
  notRoberts: 'Roberts (2025) is not shown: the paper has not been opened, and its figure and its method are unchecked.',
} as const;
export const HEADLINE = {
  heading: 'Launched on or after 18 March 2002',
  lead: (postRule: number, retired: number): string =>
    `${formatCount(postRule)} of ${formatCount(retired)} retired payloads were launched on or after 18 March 2002, the date of the FCC minimum-perigee rule. This is the group the FCC rule can reach, for satellites the FCC authorizes. The IADC guidelines are voluntary.`,
  zone: (share: string): string =>
    `${share} sit in or near the protected zone: unquiet or shallow grave. Their perigee is below the IADC disposal threshold under the stated assumptions.`,
  caption: 'Retired payloads launched on or after 18 March 2002, by verdict',
  columns: { verdict: 'Verdict', count: 'Retired payloads', share: 'Share of this group' },
  predate: (n: number, retired: number): string =>
    `${formatCount(n)} of ${formatCount(retired)} retired payloads predate any guideline: they were launched before 18 March 2002. This is context, not a failure. Their verdicts are in the tables below.`,
  unknownLaunch: (n: number): string => `${formatCount(n)} retired payloads have no launch date, so they are in neither group.`,
  none: 'No retired payload in the register was launched on or after 18 March 2002.',
} as const;
export const CENSUS = {
  intro: (date: string): string =>
    `${snapshotLabel(date)}. Every number here comes from the register, and every share shows what it is a share of.`,
  restTitle: 'What these numbers are, and what is voluntary',
  kicker: '\u00A7 03 \u00B7 The census',
  lead: (date: string): string => `${snapshotLabel(date)}. Every number comes from the register, and every share shows what it is a share of. Heights are perigee (lowest point) above GEO (the 35,786 km belt).`,
  legendLabel: 'The six verdict words, each with its meaning',
  ownersShow: (n: number): string => `Show all ${n} owner codes`,
  ownersHide: 'Show the top 12 only',
  ownerBar: 'Buried, uncertain, other',
  totalLine: 'retired payloads, each with a verdict',
  fromRegister: 'Retired payloads are satellites that SATCAT or the GPZ table lists as not operational. A verdict is given only to them.',
  headings: {
    population: 'What the register holds',
    verdicts: 'Verdicts for retired payloads',
    borderline: 'Borderline verdicts',
    era: 'Launch era',
    orbit: 'Where the orbit comes from',
    status: 'Where the status comes from',
    owner: 'By owner',
    gaps: 'Rows left out',
    blind: 'What the register cannot see',
    comparison: 'Comparison with other studies',
    caveat: 'Read the shares with care',
  },
  population: {
    total: 'Objects near GEO in the register',
    outside: 'SATCAT rows outside the near-GEO filter',
    caption: 'Objects in the register, by type',
    columns: { type: 'Type', count: 'Objects', share: 'Share of the register' },
    types: {
      'retired payload': 'Retired payloads',
      'living payload': 'Living payloads',
      'unknown payload': 'Payloads with unknown status',
      'rocket body': 'Rocket bodies (unmarked bones)',
      debris: 'Debris (unmarked bones)',
      unknown: 'Unknown type',
    },
  },
  verdictTable: {
    caption: 'Retired payloads by verdict',
    columns: { verdict: 'Verdict', count: 'Retired payloads', share: 'Share of retired payloads' },
    total: 'All retired payloads',
  },
  borderline: (uncertaintyKm: number, share: string): string =>
    `${share} of the verdicts are borderline: the perigee is within ${uncertaintyKm} km of a band edge, so the mean-element uncertainty could change the verdict.`,
  era: {
    caption: 'Retired payloads by launch era',
    columns: { era: 'Launch era', count: 'Retired payloads', share: 'Share of retired payloads' },
    beforeRule: 'Launched before 18 March 2002',
    onOrAfterRule: 'Launched on or after 18 March 2002',
    unknown: 'Launch date unknown',
    note: 'The FCC minimum-perigee rule applies only to satellites the FCC authorizes, launched on or after 18 March 2002. An earlier launch does not mean no licence conditions applied.',
  },
  orbit: {
    caption: 'Retired payloads by orbit source',
    columns: { source: 'Orbit source', count: 'Retired payloads', share: 'Share of retired payloads' },
    GP: 'GP mean elements (perigee to 0.1 km, with an epoch)',
    SATCAT: 'SATCAT whole-km altitudes (perigee to 1 km, element date not given)',
    note: (share: string, config: Config): string =>
      `${share} of the verdicts rest on SATCAT whole-km altitudes, not GP mean elements. SATCAT rounds each altitude to 1 km, which is small against the \u00B1${config.uncertaintyKm} km mean-element uncertainty. GP files cover only orbits in the protected zone (\u00B1${config.protectedZoneKm} km), so an object above it has only SATCAT altitudes.`,
  },
  status: {
    gpzLine: (share: string): string =>
      `${share} of the retired payloads have a status that came from the GPZ table. For each of them SATCAT gave no status, and the table calls the object not operational.`,
    disagreements: (total: number): string =>
      `SATCAT and the GPZ table disagree on the status of ${formatCount(total)} objects. In these, the register uses the GPZ table only where SATCAT gives no status.`,
    none: 'SATCAT and the GPZ table agree on every status.',
    caption: 'Disagreements between SATCAT and the GPZ table',
    columns: { pair: 'SATCAT says', table: 'GPZ table says', count: 'Objects' },
    unknownSatcat: 'no status given',
  },
  owner: {
    caption: 'Retired payloads by SATCAT owner code and verdict',
    ownerColumn: 'Owner code',
    totalColumn: 'All',
    note: 'Owner codes are SATCAT owner codes, shown as given. Several codes can belong to one country or company, and the register does not merge them.',
    scrollLabel: 'Owner table. Scroll sideways to see every column.',
    unknown: 'unknown',
  },
  gaps: {
    rejected: 'Rows rejected as malformed',
    noOrbit: 'SATCAT rows with no apogee or perigee',
    noOrbitNote: 'A row with no apogee or perigee cannot be placed in an orbit, so the register leaves it out and gives it no verdict.',
  },
  blind: {
    filter: (lowKm: number, highKm: number, centre: string): string =>
      `The register keeps SATCAT objects with no decay date, orbit centre ${centre}, and both apogee and perigee within ${formatCount(highKm)} km of GEO altitude (from ${formatSigned(lowKm, 0)} to ${formatSigned(highKm, 0)} km), plus every object in the GPZ file.`,
    consequence:
      'Satellites sent much higher, or that left GEO, are not in the register. That includes retired satellites that were moved far above the graveyard orbit, and satellites that drift well below GEO.',
  },
  comparison: {
    intro: 'Other studies give success rates for disposal in GEO. Each figure is shown only after someone has found it in the source itself.',
    pending: (source: string): string => `Comparison with ${source} pending a checked source.`,
    verified: (source: string, where: string): string => `Source: ${source}, ${where}.`,
  },
  caveat: {
    intro: 'These shares are not directly comparable to figures from other studies.',
    points: [
      'Sexton has no retirement dates. We know each launch date and current orbit, not when a satellite retired.',
      'A verdict describes where a satellite is now, under the stated assumptions. It does not say how or when it got there.',
      'The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing, so the shares are not a success rate.',
    ],
  },
} as const;
