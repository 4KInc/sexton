// Cause categories for the retired payloads launched after the validation year that are not buried (R14).
// Pure: no DOM, network or clock. A case file's cause line is read as text; nothing is inferred.
import { CONFIG } from './config.ts';
import type { Config } from './config.ts';
import type { SatRecord } from './types.ts';

/** The five categories, in the order they are shown. */
export const CAUSE_CATEGORIES = [
  'failed in orbit or broke up before disposal',
  'disposal reported by operator',
  'disposal attempted, perigee short',
  'no disposal reported',
  'No cause in the sources opened',
] as const;
export type CauseCategory = (typeof CAUSE_CATEGORIES)[number];

/** The category a case file's `# Cause` section names on its `Cause category:` line, or null if it has none. */
export function causeOf(body: string): CauseCategory | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '# Cause');
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith('#')) return null;
    const m = /^Cause category:\s*(.+)$/.exec(line);
    if (m === null) continue;
    const name = m[1]!.trim();
    return (CAUSE_CATEGORIES as readonly string[]).includes(name) ? (name as CauseCategory) : null;
  }
  return null;
}

/** Retired payloads launched after `config.validation.afterLaunchYear` whose verdict is not buried, in NORAD order. */
export function causeGroup(records: readonly SatRecord[], config: Config = CONFIG): SatRecord[] {
  const year = config.validation.afterLaunchYear;
  return records
    .filter((r) => r.verdict.kind === 'verdict' && r.launchYear !== null && r.launchYear > year && r.verdict.verdict !== 'buried')
    .sort((a, b) => a.norad - b.norad);
}

export interface CauseCounts {
  /** Size of the group. Adds up to the sum of `byCategory` and `noCase`. */
  n: number;
  /** Group members whose case file names each category. All five keys are present, zeros kept. */
  byCategory: Record<CauseCategory, number>;
  /** Group members with no case file, or a case file with no valid cause line. */
  noCase: number;
}

/** Counts the group by cause category. `causeByNorad` holds the category for each NORAD id that has a case file. */
export function causeCounts(group: readonly SatRecord[], causeByNorad: ReadonlyMap<number, CauseCategory | null>): CauseCounts {
  const byCategory = Object.fromEntries(CAUSE_CATEGORIES.map((c) => [c, 0])) as Record<CauseCategory, number>;
  let noCase = 0;
  for (const r of group) {
    const c = causeByNorad.get(r.norad) ?? null;
    if (c === null) noCase++;
    else byCategory[c]++;
  }
  return { n: group.length, byCategory, noCase };
}
