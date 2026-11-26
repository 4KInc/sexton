---
inclusion: always
---

# Tech

## Stack

- Vite + TypeScript (strict). Static site. No UI framework.
- One exception, decided 2026-11-26 (redesign 4): the desktop table uses AG Grid Community (`ag-grid-community`, MIT, pinned to an exact version, Community features only, no Enterprise modules). It is not a UI framework: it is a data-grid library with no React or Vue needed. MUI was rejected because it needs React. It loads by dynamic `import()` only when `#/table` opens at a width over 600 px, with only the modules the table uses registered. The main entry chunk stays at 185 KB or less. At 600 px and below, in print, and if the import fails, the table is the plain HTML table. The ledger and method pages also load on first open, to keep the main chunk small.
- Tests: Vitest + fast-check.
- Deployed to GitHub Pages.
- No backend, no accounts, no analytics.
- SVG for the churchyard, not WebGL. Must work on a phone and a laptop.

## Data

- A committed snapshot in `data/raw/<date>/`, with a `manifest.json`. Sources:
  - **SATCAT** (`https://celestrak.org/pub/satcat.csv`): the main source. It says which objects exist near GEO, and gives their type, status, owner, launch date, apogee and perigee. It covers the graveyard orbit.
  - **GPZ OMM CSV** (`gp.php?SPECIAL=GPZ&FORMAT=csv`): precise mean elements for objects inside the GEO protected zone (perigee and apogee within ±200 km of GEO). It is the precision cross-check for SATCAT.
  - **GPZ status table** (`table.php?SPECIAL=gpz&FORMAT=csv`): returns HTML, not CSV. It holds the PAY+/PAY-/R/B/DEB status of each GPZ object.
- GPZ-PLUS and the GPZ-PLUS table are not sources. GPZ-PLUS does not reach the graveyard: no object in it has a perigee above +200 km. The 2026-11-20 `gpz-plus.csv` is kept only as evidence for docs/spike.md.
- Join sources by NORAD id.
- Only `scripts/snapshot.ts` fetches data. The site never calls CelesTrak.
- `scripts/snapshot.ts` obeys the CelesTrak usage policy:
  - At most one download per data set per 2 hours. A failed partial body counts as one download.
  - Request gzip.
  - Use `FORMAT=csv`.
  - Stop on any non-200 response. No retries.
  - After a 500 or 503, wait at least 15 minutes before trying again.
  - Resume: fetch only data sets with no download in the last 2 hours.

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
