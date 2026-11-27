// Cause categories for the story stones: retired payloads launched on or after the FCC rule date whose verdict is unquiet or shallow grave (R14).
// Pure: no DOM, network or clock. A case file's cause line is read as text; nothing is inferred.
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

/**
 * The story stones: retired payloads launched on or after the FCC rule date (the era is null) whose verdict is
 * unquiet or shallow grave. The same set as the headline's "in or near the protected zone". In NORAD order.
 */
export function causeGroup(records: readonly SatRecord[]): SatRecord[] {
  return records
    .filter((r) => r.verdict.kind === 'verdict' && r.verdict.era === null && (r.verdict.verdict === 'unquiet' || r.verdict.verdict === 'shallow grave'))
    .sort((a, b) => a.norad - b.norad);
}

export interface CauseCounts {
  /** Size of the group. Adds up to the sum of `byCategory` and `noCase`. */
  n: number;
  /** Group members whose case file names each category. All five keys are present, zeros kept. */
  byCategory: Record<CauseCategory, number>;
  /** Group members with no case file, or a case file with no valid cause line. */
  noCase: number;
  /** Group members whose case file says the operator reported a disposal and whose verdict is unquiet (the register reads them inside the protected zone). */
  reportedUnquiet: number;
}

/** Counts the group by cause category. `causeByNorad` holds the category for each NORAD id that has a case file. */
export function causeCounts(group: readonly SatRecord[], causeByNorad: ReadonlyMap<number, CauseCategory | null>): CauseCounts {
  const byCategory = Object.fromEntries(CAUSE_CATEGORIES.map((c) => [c, 0])) as Record<CauseCategory, number>;
  let noCase = 0;
  let reportedUnquiet = 0;
  for (const r of group) {
    const c = causeByNorad.get(r.norad) ?? null;
    if (c === null) noCase++;
    else byCategory[c]++;
    if (c === 'disposal reported by operator' && r.verdict.kind === 'verdict' && r.verdict.verdict === 'unquiet') reportedUnquiet++;
  }
  return { n: group.length, byCategory, noCase, reportedUnquiet };
}
