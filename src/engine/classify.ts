// Classification (design 2.7, R3). Pure: no DOM, network or clock.
// Time comes in as `snapshotDate`. Every threshold comes from the config.
import { CONFIG } from './config.ts';
import type { Config } from './config.ts';
import type { Classification, Era, Margins, MergedRecord, VerdictName } from './types.ts';

/** IADC threshold T(x) = baseKm + factorKm · x, with x = C_R·A/m in m²/kg. Result in km above GEO. */
export function iadcThresholdKm(x: number, config: Config = CONFIG): number {
  return config.iadc.baseKm + config.iadc.factorKm * x;
}

/** The three edges drawn on the churchyard: the zone edge, and the two ends of the threshold band. */
export function edgesKm(config: Config = CONFIG): [number, number, number] {
  return [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];
}

/**
 * The verdict for an orbit, from perigee p and apogee q above GEO (km) and eccentricity e.
 * The first matching rule wins (design 2.7).
 */
export function classifyOrbit(orbit: { p: number; q: number; e: number }, config: Config = CONFIG): VerdictName {
  const { p, q, e } = orbit;
  const zone = config.protectedZoneKm;
  if (q < -zone) return 'fallen';
  if (p <= zone) return 'unquiet';
  if (p < config.thresholdLowKm) return 'shallow grave';
  if (e > config.iadc.eccentricityMax) return 'restless';
  if (p < config.thresholdHighKm) return 'uncertain';
  return 'buried';
}

/** True when the closed interval [p − u, p + u] contains an edge, u being the mean-element uncertainty. */
export function isBorderline(p: number, config: Config = CONFIG): boolean {
  const u = config.uncertaintyKm;
  return edgesKm(config).some((edge) => p - u <= edge && edge <= p + u);
}

export function marginsOf(p: number, config: Config = CONFIG): Margins {
  return { zone: p - config.protectedZoneKm, low: p - config.thresholdLowKm, high: p - config.thresholdHighKm };
}

/** "before FCC rule" for an earlier launch date, null on or after the rule date, "unknown" with no launch date. */
export function eraOf(launchDate: string | null, config: Config = CONFIG): Era {
  if (launchDate === null) return 'unknown';
  return launchDate < config.fccRuleDate ? 'before FCC rule' : null;
}

/**
 * Whole years from the launch date to the snapshot date, or null with no launch date.
 * A launch date after the snapshot date (bad data) gives 0.
 */
export function yearsSinceLaunch(launchDate: string | null, snapshotDate: string): number | null {
  if (launchDate === null) return null;
  const y = (s: string): number => Number(s.slice(0, 4));
  const monthDay = (s: string): string => s.slice(5, 10);
  let years = y(snapshotDate) - y(launchDate);
  if (monthDay(snapshotDate) < monthDay(launchDate)) years--;
  return Math.max(0, years);
}

/**
 * Only retired payloads get a verdict (R3.1). Rocket bodies and debris are unmarked bones.
 * Living payloads and payloads of unknown status or type get no verdict.
 * The orbit source and snapshot date are not repeated here: the record holds `orbitSource`
 * and the register holds the snapshot date.
 */
export function classify(record: MergedRecord, snapshotDate: string, config: Config = CONFIG): Classification {
  switch (record.status) {
    case 'rocket body':
    case 'debris':
      return { kind: 'unmarked bones' };
    case 'living payload':
      return { kind: 'no verdict', reason: 'living payload' };
    case 'unknown payload':
      return { kind: 'no verdict', reason: 'unknown status' };
    case 'unknown':
      return { kind: 'no verdict', reason: 'unknown type' };
    case 'retired payload':
      return {
        kind: 'verdict',
        verdict: classifyOrbit({ p: record.pKm, q: record.qKm, e: record.e }, config),
        borderline: isBorderline(record.pKm, config),
        margins: marginsOf(record.pKm, config),
        era: eraOf(record.launchDate, config),
        yearsSinceLaunch: yearsSinceLaunch(record.launchDate, snapshotDate),
      };
  }
}
