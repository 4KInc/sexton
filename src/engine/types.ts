// Shared types for the engine and the register (design 2.3, 2.7, 2.8, 3.1).
import type { CauseCounts } from './causes.ts';

export type VerdictName = 'fallen' | 'unquiet' | 'shallow grave' | 'restless' | 'uncertain' | 'buried';

export type ObjectKind = 'retired payload' | 'living payload' | 'unknown payload' | 'rocket body' | 'debris' | 'unknown';

/** Orbit numbers. Altitudes are km above the WGS-72 equatorial radius. */
export interface Orbit {
  semiMajorAxisKm: number;
  perigeeKm: number;
  apogeeKm: number;
  /** Perigee above GEO, km. */
  pKm: number;
  /** Apogee above GEO, km. */
  qKm: number;
  e: number;
}

export interface Rejection {
  source: string;
  line: number;
  reason: string;
}

export type OrbitSource = { kind: 'GP'; epoch: string } | { kind: 'SATCAT' };

export interface Margins {
  /** p − 200 */
  zone: number;
  /** p − 247 */
  low: number;
  /** p − 280 */
  high: number;
}

export type Era = 'before FCC rule' | null | 'unknown';

export type Classification =
  | {
      kind: 'verdict';
      verdict: VerdictName;
      borderline: boolean;
      margins: Margins;
      era: Era;
      yearsSinceLaunch: number | null;
    }
  | { kind: 'unmarked bones' }
  | { kind: 'no verdict'; reason: string };

export interface Disagreement {
  /** The SATCAT kind. "unknown payload" is written as "unknown" here. */
  satcat: ObjectKind;
  gpzTable: ObjectKind;
}

/** What merge produces: one record per NORAD id, before classification. */
export interface MergedRecord {
  norad: number;
  name: string;
  intlDes: string | null;
  /** SATCAT OBJECT_TYPE, or the type implied by the GPZ table, or null. */
  objectType: string | null;
  status: ObjectKind;
  statusSource: 'SATCAT' | 'GPZ table' | null;
  owner: string | null;
  launchDate: string | null;
  /** Year used only to place the object on the x axis (design 2.7). */
  launchYear: number | null;
  launchYearSource: 'launch date' | 'designator' | null;
  decayDate: string | null;
  perigeeKm: number;
  apogeeKm: number;
  pKm: number;
  qKm: number;
  e: number;
  inclinationDeg: number | null;
  orbitSource: OrbitSource;
  disagreement: Disagreement | null;
}

export interface SatRecord extends MergedRecord {
  verdict: Classification;
  caseFile: boolean;
}
export type VerdictCounts = Record<VerdictName, number>;

export interface Census {
  snapshotDate: string;
  population: {
    total: number;
    outsidePopulation: number;
    rejectedRows: number;
    noOrbitData: number;
  };
  byType: Record<ObjectKind, number>;
  retired: {
    total: number;
    byVerdict: VerdictCounts;
    borderline: { yes: number; no: number };
    era: { beforeRule: number; onOrAfterRule: number; unknown: number };
    orbitSource: { GP: number; SATCAT: number };
    byOwner: Record<string, VerdictCounts>;
  };
  disagreements: { total: number; pairs: Record<string, number> };
}

/** One source file in a register, copied from the snapshot manifest (design 3.1). */
export interface RegisterSource {
  file: string;
  url: string;
  fetchedAt: string;
  sha256: string;
  bytes: number;
}

/** The shape of data/register.json (design 3.1). Keys are written in this order. */
export interface Register {
  schema: 1;
  sample: boolean;
  snapshot: { set: string; sources: RegisterSource[] };
  config: unknown;
  records: SatRecord[];
  rejections: Rejection[];
  noOrbitDataCount: number;
  census: Census;
  /** Cause counts for the group in R14, from the case files. Written by build-register. Absent in old files and fixtures. */
  causes?: CauseCounts;
}
