// The post-rule headline (polish step 1) and the validation rate (step 2). Pure: no DOM, network or clock.
// Both read the same classification as everything else. Neither changes a verdict.
import { CONFIG } from './config.ts';
import type { Config } from './config.ts';
import { classifyOrbit } from './classify.ts';
import type { SatRecord, VerdictCounts, VerdictName } from './types.ts';

type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
const isRetired = (r: SatRecord): r is Retired => r.verdict.kind === 'verdict';

const zero = (): VerdictCounts => ({ fallen: 0, unquiet: 0, 'shallow grave': 0, restless: 0, uncertain: 0, buried: 0 });

export interface PostRuleSummary {
  /** All retired payloads with a verdict. */
  retired: number;
  /** Launched before the FCC rule date. They predate any rule Sexton checks. */
  predate: number;
  /** No launch date, so the era is unknown. */
  unknownLaunch: number;
  /** Launched on or after the rule date. */
  postRule: number;
  /** Verdicts of the post-rule payloads. Adds up to `postRule`. */
  byVerdict: VerdictCounts;
  /** Post-rule payloads that sit in or near the protected zone: unquiet or shallow grave. */
  inOrNearZone: number;
  /** Post-rule payloads below the IADC disposal threshold under the stated assumptions: fallen, unquiet or shallow grave. */
  belowThreshold: number;
}

/** Splits the retired payloads by era. One pass, so predate + unknownLaunch + postRule = retired. */
export function postRuleSummary(records: readonly SatRecord[]): PostRuleSummary {
  const out: PostRuleSummary = { retired: 0, predate: 0, unknownLaunch: 0, postRule: 0, byVerdict: zero(), inOrNearZone: 0, belowThreshold: 0 };
  for (const r of records) {
    if (!isRetired(r)) continue;
    out.retired++;
    const era = r.verdict.era;
    if (era === 'before FCC rule') out.predate++;
    else if (era === 'unknown') out.unknownLaunch++;
    else {
      out.postRule++;
      const v: VerdictName = r.verdict.verdict;
      out.byVerdict[v]++;
    }
  }
  const b = out.byVerdict;
  out.inOrNearZone = b.unquiet + b['shallow grave'];
  out.belowThreshold = b.fallen + b.unquiet + b['shallow grave'];
  return out;
}

export interface DisposalRate {
  /** The first year not counted: payloads launched after this year are counted. */
  afterLaunchYear: number;
  /** Retired payloads launched after `afterLaunchYear`. */
  n: number;
  /** Retired payloads with no launch year. They are left out. */
  noLaunchYear: number;
  /** Buried even if every perigee is 25 km lower than its mean-element value. */
  lower: number;
  /** Buried, as the register's verdict says. */
  central: number;
  /** Buried or uncertain if every perigee is 25 km higher. The most the uncertainty allows. */
  upper: number;
  /** Verdicts of the counted payloads. Adds up to `n`. */
  byVerdict: VerdictCounts;
  /** Counted payloads within the uncertainty of a band edge (the verdict is borderline). */
  borderline: number;
}

/**
 * Share of retired payloads launched after `config.validation.afterLaunchYear` that are buried, with the band
 * the mean-element uncertainty allows. The band moves each perigee and apogee by ±uncertaintyKm and classifies again.
 * Launch year is a stand-in: Sexton has no retirement dates.
 */
export function disposalRate(records: readonly SatRecord[], config: Config = CONFIG): DisposalRate {
  const year = config.validation.afterLaunchYear;
  const u = config.uncertaintyKm;
  const out: DisposalRate = { afterLaunchYear: year, n: 0, noLaunchYear: 0, lower: 0, central: 0, upper: 0, byVerdict: zero(), borderline: 0 };
  for (const r of records) {
    if (!isRetired(r)) continue;
    if (r.launchYear === null) {
      out.noLaunchYear++;
      continue;
    }
    if (r.launchYear <= year) continue;
    out.n++;
    out.byVerdict[r.verdict.verdict]++;
    if (r.verdict.borderline) out.borderline++;
    if (r.verdict.verdict === 'buried') out.central++;
    if (classifyOrbit({ p: r.pKm - u, q: r.qKm - u, e: r.e }, config) === 'buried') out.lower++;
    const high = classifyOrbit({ p: r.pKm + u, q: r.qKm + u, e: r.e }, config);
    if (high === 'buried' || high === 'uncertain') out.upper++;
  }
  return out;
}
