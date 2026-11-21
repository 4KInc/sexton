// Orbit maths (design 2.6, R2). Every constant comes from the config.
// Pure: no DOM, network or clock. Fields keep full float precision.
import type { Config } from './config.ts';
import type { Orbit } from './types.ts';

/** Mean motion (rev/day) and eccentricity to a, perigee and apogee altitude, p and q. */
export function orbitFromMeanMotion(meanMotionRevPerDay: number, e: number, config: Config): Orbit {
  const { radiusKm, muKm3PerS2, secondsPerDay } = config.earth;
  const nRadPerS = (meanMotionRevPerDay * 2 * Math.PI) / secondsPerDay;
  const a = Math.cbrt(muKm3PerS2 / (nRadPerS * nRadPerS));
  const perigeeKm = a * (1 - e) - radiusKm;
  const apogeeKm = a * (1 + e) - radiusKm;
  return {
    semiMajorAxisKm: a,
    perigeeKm,
    apogeeKm,
    pKm: perigeeKm - config.geoAltitudeKm,
    qKm: apogeeKm - config.geoAltitudeKm,
    e,
  };
}

/** SATCAT whole-km altitudes to eccentricity: e = (ra − rp) / (ra + rp), r = altitude + Earth radius. */
export function eccentricityFromAltitudes(apogeeKm: number, perigeeKm: number, config: Config): number {
  const ra = apogeeKm + config.earth.radiusKm;
  const rp = perigeeKm + config.earth.radiusKm;
  return (ra - rp) / (ra + rp);
}

/** SATCAT altitudes to the same Orbit shape as the GP path. */
export function orbitFromAltitudes(apogeeKm: number, perigeeKm: number, config: Config): Orbit {
  const e = eccentricityFromAltitudes(apogeeKm, perigeeKm, config);
  const a = (apogeeKm + perigeeKm) / 2 + config.earth.radiusKm;
  return {
    semiMajorAxisKm: a,
    perigeeKm,
    apogeeKm,
    pKm: perigeeKm - config.geoAltitudeKm,
    qKm: apogeeKm - config.geoAltitudeKm,
    e,
  };
}
