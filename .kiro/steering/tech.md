---
inclusion: always
---

# Tech

## Stack

- Vite + TypeScript (strict). Static site. No UI framework.
- Tests: Vitest + fast-check.
- Deployed to GitHub Pages.
- No backend, no accounts, no analytics.
- SVG for the churchyard, not WebGL. Must work on a phone and a laptop.

## Data

- A committed snapshot in `data/`:
  - CelesTrak GPZ and GPZ-PLUS OMM CSV.
  - The GPZ and GPZ-PLUS status tables.
  - SATCAT.
- Only `scripts/snapshot.ts` fetches data. The site never calls CelesTrak.
- `scripts/snapshot.ts` obeys the CelesTrak usage policy:
  - At most one download per data set per 2 hours.
  - Request gzip.
  - Use `FORMAT=csv`.
  - Stop on any non-200 response. No retries.
  - After a 500 or 503, wait at least 15 minutes before trying again.
- GPZ and GPZ-PLUS overlap. Always merge them and de-duplicate by NORAD id, keeping the newer epoch.

## Physics constants (WGS-72)

- Earth radius: 6378.135 km.
- μ = 398600.8 km³/s².
- GEO altitude: 35,786 km.
- Units are km and kg. A/m is in m²/kg.
- OMM mean motion is rev/day. Convert to rad/s before use.

## Classifier

- A pure module: no DOM, no network, no clock. Time is passed in as an argument.
- All thresholds live in one config object. No magic numbers elsewhere.
- Property-test the classifier with fast-check.
