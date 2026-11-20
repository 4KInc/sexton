// The one config object. Every number in the engine lives here (tech.md).
// Task 2 adds the derived thresholdLowKm and thresholdHighKm.
export const CONFIG = {
  earth: { radiusKm: 6378.135, muKm3PerS2: 398600.8, secondsPerDay: 86400 }, // WGS-72
  geoAltitudeKm: 35786,
  nearGeo: { lowerKm: -2000, upperKm: 2000, orbitCenter: 'EA' },
  protectedZoneKm: 200,
  iadc: {
    baseKm: 235,
    factorKm: 1000,
    crAmMin: 0.012,
    crAmMax: 0.045,
    crRange: [1.2, 1.5],
    amRange: [0.01, 0.03],
    eccentricityMax: 0.003,
  },
  uncertaintyKm: 25,
  fccRuleDate: '2002-03-18',
  status: { retired: ['-'], living: ['+', 'P', 'B', 'S', 'X'] },
  gpzTableStatus: { 'PAY-': 'retired', 'PAY+': 'living', 'R/B': 'rocket body', 'DEB': 'debris' },
} as const;
