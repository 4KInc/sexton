// How many retired payloads launched on or after the FCC rule date have a sourced operator (R13.14). Pure: no DOM, network or clock.
// This sits apart from parish.ts so the census page can use it without loading the parish register's code.
import type { SatRecord } from './types.ts';

type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
/** A retired payload launched on or after the FCC rule date. These are the only records that can carry an operator. */
export const isPostRule = (r: SatRecord): r is Retired => r.verdict.kind === 'verdict' && r.verdict.era === null;

/** `sourced` of `of`: both counted from the records, never typed. */
export function operatorCoverage(records: readonly SatRecord[]): { sourced: number; of: number } {
  let sourced = 0;
  let of = 0;
  for (const r of records) {
    if (!isPostRule(r)) continue;
    of++;
    if (typeof r.operator === 'string') sourced++;
  }
  return { sourced, of };
}
