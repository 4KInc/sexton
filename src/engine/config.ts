// The one config object. Every number in the engine lives here (tech.md).
// thresholdLowKm and thresholdHighKm are computed from the IADC numbers, not stored.
const iadc = {
  baseKm: 235, // T(x) = baseKm + factorKm * x, x = C_R·A/m
  factorKm: 1000,
  crAmMin: 0.012, // m²/kg
  crAmMax: 0.045,
  crRange: [1.2, 1.5],
  amRange: [0.01, 0.03],
  eccentricityMax: 0.003,
} as const;

export const CONFIG = {
  earth: { radiusKm: 6378.135, muKm3PerS2: 398600.8, secondsPerDay: 86400 }, // WGS-72
  geoAltitudeKm: 35786,
  nearGeo: { lowerKm: -2000, upperKm: 2000, orbitCenter: 'EA' },
  protectedZoneKm: 200,
  iadc,
  thresholdLowKm: iadc.baseKm + iadc.factorKm * iadc.crAmMin,
  thresholdHighKm: iadc.baseKm + iadc.factorKm * iadc.crAmMax,
  uncertaintyKm: 25,
  fccRuleDate: '2002-03-18',
  status: { retired: ['-'], living: ['+', 'P', 'B', 'S', 'X'] },
  gpzTableStatus: { 'PAY-': 'retired', 'PAY+': 'living', 'R/B': 'rocket body', 'DEB': 'debris' },
} as const;

export type Config = typeof CONFIG;
