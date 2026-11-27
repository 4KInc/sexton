// The parish register (R13, design 10): the retired payloads of one group, counted by verdict. Pure: no DOM, network or clock.
// A group is an operator (named by a source that was opened, never inferred) or a SATCAT owner code. The two are never merged.
import type { SatRecord, VerdictCounts, VerdictName } from './types.ts';

export type GroupKind = 'operator' | 'owner';
export interface Group {
  kind: GroupKind;
  /** The operator's name, or the SATCAT owner code as given. */
  key: string;
}
/** The key of the owner group for retired payloads whose SATCAT owner is not given. It matches `census.retired.byOwner`. */
export const OWNER_NOT_GIVEN = 'unknown';
const VERDICTS: readonly VerdictName[] = ['fallen', 'unquiet', 'shallow grave', 'restless', 'uncertain', 'buried'];
type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
const isRetired = (r: SatRecord): r is Retired => r.verdict.kind === 'verdict';
const zero = (): VerdictCounts => Object.fromEntries(VERDICTS.map((v) => [v, 0])) as VerdictCounts;

/** Whether a retired payload belongs to a group. An operator group holds only records with that exact operator name. */
export function inGroup(r: SatRecord, group: Group): boolean {
  if (!isRetired(r)) return false;
  if (group.kind === 'operator') return typeof r.operator === 'string' && r.operator === group.key;
  return group.key === OWNER_NOT_GIVEN ? r.owner === null : r.owner === group.key;
}

export interface ParishPage {
  group: Group;
  /** Retired payloads in the group. */
  total: number;
  /** All six verdicts, zeros kept. Adds up to `total`. */
  byVerdict: VerdictCounts;
  borderline: number;
  era: { beforeRule: number; onOrAfterRule: number; unknown: number };
  orbitSource: { GP: number; SATCAT: number };
  /** The group's retired payloads, by NORAD id. */
  rows: Retired[];
  /** The earliest and latest GP epoch among the group's GP orbits, or null when none is from GP. */
  gpEpochs: { first: string; last: string } | null;
  /** How many members have a sourced operator. For an operator group this is `total`. */
  withOperator: number;
}

/** One group's counts and rows. The result does not depend on the order of `records`. */
export function parishOf(records: readonly SatRecord[], group: Group): ParishPage {
  const rows = records.filter((r): r is Retired => inGroup(r, group)).sort((a, b) => a.norad - b.norad);
  const byVerdict = zero();
  const era = { beforeRule: 0, onOrAfterRule: 0, unknown: 0 };
  const orbitSource = { GP: 0, SATCAT: 0 };
  let borderline = 0;
  let withOperator = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const r of rows) {
    byVerdict[r.verdict.verdict]++;
    if (r.verdict.borderline) borderline++;
    if (r.verdict.era === 'before FCC rule') era.beforeRule++;
    else if (r.verdict.era === 'unknown') era.unknown++;
    else era.onOrAfterRule++;
    orbitSource[r.orbitSource.kind]++;
    if (r.orbitSource.kind === 'GP') {
      const e = r.orbitSource.epoch;
      if (first === null || e < first) first = e;
      if (last === null || e > last) last = e;
    }
    if (typeof r.operator === 'string') withOperator++;
  }
  return { group, total: rows.length, byVerdict, borderline, era, orbitSource, rows, gpEpochs: first === null || last === null ? null : { first, last }, withOperator };
}

export interface GroupCount {
  key: string;
  /** Retired payloads in the group. */
  count: number;
}
const byKey = (a: GroupCount, b: GroupCount): number => {
  const x = a.key.toLowerCase();
  const y = b.key.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
};
/**
 * Every group that has at least one retired payload, in two lists: operators (named by a source) and SATCAT owner codes.
 * Each is in alphabetical order. There is no ranking field and no share.
 */
export function parishGroups(records: readonly SatRecord[]): { operators: GroupCount[]; owners: GroupCount[] } {
  const operators = new Map<string, number>();
  const owners = new Map<string, number>();
  for (const r of records) {
    if (!isRetired(r)) continue;
    if (typeof r.operator === 'string') operators.set(r.operator, (operators.get(r.operator) ?? 0) + 1);
    const owner = r.owner === null ? OWNER_NOT_GIVEN : r.owner;
    owners.set(owner, (owners.get(owner) ?? 0) + 1);
  }
  const list = (m: Map<string, number>): GroupCount[] => [...m].map(([key, count]) => ({ key, count })).sort(byKey);
  return { operators: list(operators), owners: list(owners) };
}

export { isPostRule, operatorCoverage } from './operator-coverage.ts';
