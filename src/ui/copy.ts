// All user-facing strings, in one place (design 5.2). The language check reads this file.
// Rules: .kiro/steering/language.md. No retirement dates. Churchyard words are always paired
// with their plain technical meaning.
import type { Config } from '../engine/config.ts';
import type { SatRecord, VerdictName } from '../engine/types.ts';
import { formatCount, formatSigned, MINUS } from './format.ts';
import { SCALE } from './svg/scale.ts';

export const SITE = {
  title: 'Sexton',
  tagline: 'A register of retired geostationary satellites',
  skipToMain: 'Skip to main content',
  skipToTable: 'Skip the churchyard drawing and go to the table view',
  sampleBanner: 'Sample data for layout only. This is not the register.',
  loadError: 'The register could not be loaded. Try again later.',
  loading: 'Loading the register.',
  notFound: 'There is no page at this address.',
  backToChurchyard: 'Back to the churchyard',
  notBuilt: 'This page is not built yet.',
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
  lead: 'Each stone is a retired satellite. Its height is its perigee above GEO. Satellites that were moved up into the graveyard orbit stand high. Satellites still near the belt stand low.',
  voluntary:
    'The IADC guidelines are voluntary. The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002.',
  noRetirementDate: 'We know each launch date and current orbit. We do not know when a satellite retired.',
  blindSpot:
    'The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.',
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
  empty: 'No retired payloads in this register.',
  legendTitle: 'How to read the churchyard',
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

export function countLine(shown: number, snapshotDate: string): string {
  const noun = shown === 1 ? 'retired payload' : 'retired payloads';
  return `${shown} ${noun} in the ${snapshotDate} snapshot.`;
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
  empty: 'Select a stone to see its numbers.',
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
    identity: 'The object',
    verdict: 'The verdict',
    maths: 'The threshold maths',
    assumptions: 'Assumptions',
    orbit: 'Orbit source and data age',
    snapshot: 'Snapshot and sources',
    status: 'Status source',
    caseFile: 'Case file',
    context: 'Context',
    actions: 'Report and data',
  },
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
  intro: 'Every object the register holds, with the same numbers as the churchyard. Sort a column with its button.',
  verdictKey: 'The verdict words',
  caption: 'Objects near GEO in the register',
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
}
export const COMPARISONS: readonly Comparison[] = [
  {
    id: 'esa',
    source: 'ESA Space Environment Report 2025',
    figure: 'ESA: 70\u201395% of GEO retirements succeed.',
    url: 'https://www.esa.int/Space_Safety/Space_Debris/ESA_Space_Environment_Report_2025',
    verified: false,
    where: null,
  },
  {
    id: 'roberts',
    source: 'Roberts, Georgia Tech, 2025',
    figure: 'Roberts: 73%.',
    url: 'https://iac.gatech.edu/publications/pub/8089',
    verified: false,
    where: null,
  },
];
export const CENSUS = {
  intro: (date: string): string =>
    `Counts from the snapshot of ${date}. Every number here comes from the register, and every share shows what it is a share of.`,
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
