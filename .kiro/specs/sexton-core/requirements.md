# Requirements: sexton-core

## Introduction

Sexton is a public register of retired geostationary satellites. For each retired payload it shows whether the payload was disposed of into the graveyard orbit above GEO, as the voluntary IADC guidelines ask, or is still in or near the protected zone. See `.kiro/steering/` for product, tech, design, language and structure rules, and `docs/spike.md` for the data findings these requirements rest on.

Scope: about 5 days of work. Nothing in this spec downloads data. SATCAT is not in the snapshot yet, so the engine, its tests and the first UI must work without it. The snapshot-refresh Action (Requirement 11) is the only thing that downloads, and it runs only when a person starts it.

## Glossary

- **GEO**: the circular orbit about 35,786 km above the equator, where a satellite stays over one spot.
- **Perigee / apogee**: the lowest / highest point of an orbit, as altitude in km.
- **p**: perigee above GEO in km, that is perigee altitude − 35,786.
- **Eccentricity (e)**: how far an orbit is from a perfect circle. 0 is a circle.
- **Config**: the single engine configuration object that holds every threshold and constant.
- **GP record**: an object from the GPZ OMM CSV, with orbit computed by the WGS-72 formula.
- **SATCAT record**: an object from the CelesTrak SATCAT CSV.
- **Near-GEO set**: the objects Sexton classifies (Requirement 1.4).
- **Retired payload**: OBJECT_TYPE "PAY" with status "retired" (Requirement 1.7).
- **Apogee above GEO**: apogee altitude − 35,786 km.
- **Verdict**: one of fallen, unquiet, shallow grave, uncertain, buried, restless.
- **Unmarked bones**: rocket bodies and debris. They are shown but get no verdict.
- **Register**: `data/register.json`, the only data file the site loads.
- **Snapshot set**: one `data/raw/<date>/` folder with its `manifest.json`.

## Requirement 1: Ingest

**User story:** As a debris researcher, I want every near-GEO object as one clean record, so that each verdict rests on known, traceable inputs.

### Acceptance criteria

1. WHEN the engine is given SATCAT CSV text, THE engine SHALL parse each row using the header names listed in docs/spike.md §f, not column positions.
2. WHEN the engine is given GPZ OMM CSV text, THE engine SHALL parse NORAD_CAT_ID, OBJECT_NAME, OBJECT_ID, EPOCH, MEAN_MOTION, ECCENTRICITY and INCLINATION from each row.
3. WHEN the engine is given the GPZ status table HTML, THE engine SHALL read the NORAD id from the "NORAD Catalog Number" cell and the status from the first word of the "Latest Data" cell.
4. THE engine SHALL form the near-GEO set from SATCAT records with an empty DECAY_DATE, ORBIT_CENTER "EA", and both APOGEE and PERIGEE between GEO + the config's lower limit (default −2,000 km) and GEO + the config's upper limit (default +2,000 km), inclusive.
5. THE engine SHALL produce exactly one record per NORAD id, holding: name, international designator, object type, ops status, owner, launch date, decay date, perigee altitude, apogee altitude, eccentricity, inclination, and an orbit source for the orbit fields ("GP" with its epoch, or "SATCAT").
6. WHEN a GP record exists for a NORAD id, THE engine SHALL use the GP orbit for that record. OTHERWISE THE engine SHALL use SATCAT's whole-km APOGEE and PERIGEE, with e = (r_a − r_p) / (r_a + r_p) and r = altitude + 6,378.135 km.
7. THE engine SHALL set the status of an OBJECT_TYPE "PAY" record from SATCAT OPS_STATUS_CODE: "-" is "retired"; "+", "P", "B", "S" and "X" are "living"; "?", blank or any other code is "unknown status".
8. WHILE SATCAT is absent, or has no row for a NORAD id that is in GPZ, THE engine SHALL take that record's type and status from the GPZ table (PAY- is a retired payload, PAY+ a living payload, R/B a rocket body, DEB debris), SHALL mark the record's status source as "GPZ table", and SHALL set owner and launch date to "unknown". Such a record SHALL get no era badge.
9. WHEN both SATCAT and the GPZ table give a type or status for the same NORAD id and they disagree, THE engine SHALL keep the SATCAT value and record the disagreement on that record.
10. IF a row is malformed (missing or non-numeric required field, wrong field count, impossible value such as e < 0, e ≥ 1 or mean motion ≤ 0), THEN THE engine SHALL reject that row with its source, line number and a reason, and continue with the other rows.
11. WHEN a SATCAT row has a blank APOGEE or PERIGEE, THE engine SHALL treat it as "no orbit data", not as malformed: it SHALL leave the row out of the near-GEO set, SHALL NOT list it as a rejected row, and SHALL count it in a "no orbit data" total.
12. THE engine SHALL NOT throw on any input string.
13. THE engine SHALL produce the same records regardless of the order of input rows.

## Requirement 2: Orbit maths

**User story:** As an astrodynamics student, I want the orbit formulas stated and checked, so that I can trust and reproduce them.

### Acceptance criteria

1. THE engine SHALL compute n in rad/s as mean motion (rev/day) × 2π / 86,400, a = (μ / n²)^(1/3) with μ = 398,600.8 km³/s², perigee altitude = a(1 − e) − 6,378.135 and apogee altitude = a(1 + e) − 6,378.135.
2. THE engine SHALL compute p and apogee above GEO by subtracting 35,786 km.
3. WHEN run on the committed GPZ files, THE engine SHALL match the GPZ table's perigee height within 1 km for every object.
4. THE engine SHALL take every constant in this requirement from the config.

## Requirement 3: Classification

**User story:** As a policy analyst, I want a verdict per retired payload with its assumptions shown, so that I can see who reached the graveyard without the tool overstating certainty.

### Acceptance criteria

1. THE engine SHALL give a verdict only to retired payloads. Rocket bodies and debris SHALL be "unmarked bones". Living payloads and payloads with unknown status SHALL get no verdict.
2. THE engine SHALL compute the IADC threshold as T(x) = 235 + 1000·x km, with x = C_R·A/m in m²/kg over the config range 0.012 to 0.045, so T runs from 247 to 280 km.
3. THE engine SHALL give exactly one verdict per retired payload, in this order:
   - "fallen" WHEN apogee above GEO < −200 (the whole orbit is below the protected zone: it is not in the zone and not in the graveyard);
   - "unquiet" WHEN p ≤ 200 AND apogee above GEO ≥ −200 (the orbit reaches the protected zone);
   - "shallow grave" WHEN 200 < p < 247;
   - "restless" WHEN p ≥ 247 AND e > 0.003;
   - "uncertain" WHEN 247 ≤ p < 280 AND e ≤ 0.003;
   - "buried" WHEN p ≥ 280 AND e ≤ 0.003.
4. THE engine SHALL set a "borderline" flag, separate from the verdict, exactly WHEN the closed interval [p − 25, p + 25] contains 200, 247 or 280.
5. THE engine SHALL attach to each verdict its orbit source ("GP" with epoch, precise; or "SATCAT", whole km, element date not given) and the snapshot date.
6. WHEN a launch date is before 18 March 2002, THE engine SHALL set the era badge "launched before the FCC rule (18 Mar 2002)". The badge SHALL NOT change the verdict. WHEN the launch date is unknown, THE engine SHALL set no era badge. The era badge SHALL need a full launch date.
7. THE engine SHALL be a pure module: no DOM, no network, no clock. The snapshot date SHALL be passed in.
8. THE config SHALL hold every number in this requirement (−200, 200, 235, 1000, 0.012, 0.045, 0.003, 25, 2002-03-18), and docs/methodology.md SHALL list the same values with sources.

## Requirement 4: Build-time register

**User story:** As a maintainer, I want the site's data built once from the committed snapshot, so that the site never contacts CelesTrak.

### Acceptance criteria

1. WHEN `scripts/build-register.ts` runs, THE script SHALL read the newest snapshot set in data/raw/ whose manifest says `complete: true`.
2. THE script SHALL write `data/register.json` with: records, verdicts and flags, rejected rows, the census, the snapshot date, and each source file's URL and sha256 from the manifest.
3. IF no complete set exists, or the set has no satcat.csv, THEN THE script SHALL exit non-zero with a message naming the missing file and saying how to add it, and SHALL NOT download anything.
4. THE script SHALL produce byte-identical output when run twice on the same snapshot.
5. THE site SHALL load only `register.json` at run time.

## Requirement 5: Census

**User story:** As a journalist, I want totals I can quote, with their limits stated, so that I don't misreport them.

### Acceptance criteria

1. THE engine SHALL count classified objects by verdict, by borderline flag, by era badge, by owner, and by status disagreement, and SHALL include the snapshot date, the number of rejected rows and the "no orbit data" total.
2. THE counts for each grouping SHALL add up to the number of objects in that grouping's population.
3. WHEN the census is shown, THE site SHALL show next to it ESA's 70–95% success figure (ESA Space Environment Report 2025) and Roberts' 73% (Georgia Tech, 2025), each with a link. IF a figure has not been checked against its source when the census page is built or at the final audit, THEN THE site SHALL omit that figure and SHALL say that the comparison is pending a checked source.
4. Every source link SHALL be one that has been checked to exist. WHERE a link has not been checked, THE text SHALL say "LINK NEEDED" in its place. No URL or citation SHALL be invented.
5. WHEN totals or percentages are shown, THE site SHALL say they are not directly comparable to those figures because Sexton has no retirement dates and cannot see objects that were sent much higher or left GEO.

## Requirement 6: Churchyard view

**User story:** As a reader, I want to see at a glance who is buried and who is not, with every visual element meaning something.

### Acceptance criteria

1. THE site SHALL draw an SVG whose vertical axis is p, on a scale where −200 to +400 km is readable on a phone and a laptop.
2. WHEN an object's launch date is unknown, THE site SHALL take its launch year for the x-axis from the first four digits of its international designator (for example 2002-006A gives 2002). This year SHALL be used for placement only, not for the era badge or moss.
3. WHEN an object's p is outside the drawn range, THE site SHALL place it at the nearest edge with an arrow and its true value.
4. THE site SHALL draw four bands that match the verdicts, each labelled once with its plain meaning:
   - "the road" (p ≤ 200): the GEO protected zone;
   - "shallow ground" (200 < p < 247): above the zone, below the IADC threshold for every assumed C_R·A/m;
   - "the churchyard wall" (247 ≤ p < 280): the IADC threshold band, whose height depends on the unknown C_R·A/m;
   - "consecrated ground" (p ≥ 280): above the threshold for every assumed C_R·A/m.
5. THE site SHALL draw each retired payload as a headstone at its true p. A "fallen" headstone SHALL be drawn below the road, or at the bottom edge with an arrow and its true value if off scale.
6. THE site SHALL grow moss on a headstone with years since launch, and SHALL show data age as text (GP epoch, or "SATCAT, element date not given").
7. WHEN e > 0.003, THE site SHALL make the headstone sway slowly. WHILE prefers-reduced-motion is set, THE site SHALL show no motion.
8. THE site SHALL offer filters by owner, verdict and era, and search by name or NORAD id.
9. THE site SHALL offer a table view with the same data, reachable and usable by keyboard and screen reader.
10. THE site SHALL never use colour as the only cue, and every text pair SHALL meet WCAG AA contrast.

## Requirement 7: Ledger page

**User story:** As licensing staff, I want one page per satellite that shows its working, so that I can check or cite it.

### Acceptance criteria

1. THE site SHALL show, for each object: the verdict in plain words, the threshold maths with its numbers filled in, the assumptions (C_R·A/m range, ±25 km mean-element uncertainty), the borderline flag, the orbit source, the snapshot date, source links and the era badge.
2. THE ledger SHALL have its own URL that can be shared and that works on GitHub Pages without a server. design.md SHALL choose the URL scheme.
3. WHEN printed, THE ledger SHALL use print CSS laid out as an "exhumation report".
4. THE ledger SHALL offer the object's register entry as a JSON download.
5. THE ledger SHALL NOT state or imply a retirement date.

## Requirement 8: Case files

**User story:** As a space-law lecturer, I want short case files on notable satellites, so that I can teach from them.

### Acceptance criteria

1. THE site SHALL load markdown case files from data/cases/ at build time and show each on its satellite's ledger.
2. THE site SHALL support case files for EchoStar-7 (27378), Intelsat 511 (15873) and Luch/Olymp (40258).
3. WHEN a case file is marked provisional, THE site SHALL show that it is provisional. Luch/Olymp SHALL be provisional until SATCAT confirms where it is.
4. WHEN no case file exists yet, THE site SHALL show the ledger without one. The case files' contents are out of scope for this spec.

## Requirement 9: Methodology and honesty page

**User story:** As a reviewer, I want every formula, assumption and limit in one place.

### Acceptance criteria

1. THE site SHALL publish docs/methodology.md as a page, with every formula, constant, assumption and source, with links, and credit to Roberts for the audit method. Links SHALL follow Requirement 5.4: checked, or "LINK NEEDED".
2. THE page SHALL state that the IADC guidelines are voluntary and that the FCC minimum-perigee rule applies only to satellites the FCC authorizes, launched on or after 18 March 2002.
3. THE page SHALL state what the register cannot see and that retirement dates are unknown.
4. THE page SHALL have a "what we do not say" section listing the phrases Sexton avoids.

## Requirement 10: Language check

**User story:** As a maintainer, I want banned phrasing caught automatically.

### Acceptance criteria

1. WHEN `scripts/check-language.ts` runs, THE script SHALL scan src/ui/, data/cases/, docs/ and README.md, except the "what we do not say" section of docs/methodology.md.
2. IF any file contains a banned stem from language.md, case-insensitive, THEN THE script SHALL print file, line and match and exit non-zero. The stems are: "violat" (violated, violation, violates), "illegal", "non-compliant", "noncompliant", "non compliant", "broke the law", "breach", "unlawful".
3. THE banned stems SHALL live in one list in the script, and language.md SHALL list the same stems.
4. THE check SHALL run as part of `npm test`.

## Requirement 11: Snapshot refresh

**User story:** As a maintainer, I want to refresh the data on demand and review it before it goes live.

### Acceptance criteria

1. THE repository SHALL have a GitHub Action triggered only by workflow_dispatch.
2. WHEN started, THE Action SHALL run `scripts/snapshot.ts` and `scripts/build-register.ts` and open a pull request with the new snapshot, register and census.
3. IF either script exits non-zero, THEN THE Action SHALL fail without opening a pull request and SHALL NOT retry.

## Requirement 12: Tests

**User story:** As a maintainer, I want the engine's rules held by tests that need no network and no SATCAT.

### Acceptance criteria

1. THE engine tests SHALL use hand-made fixtures in test/fixtures/ (a SATCAT CSV in the real column order, a GPZ OMM CSV, a GPZ table HTML) and the committed GPZ files, and SHALL NOT need the full SATCAT.
2. THE tests SHALL include fast-check properties for:
   - perigee ≤ apogee for every valid record;
   - T(x) never decreases as x grows;
   - for fixed e ≤ 0.003 and apogee above GEO ≥ −200, raising p never worsens the verdict (unquiet < shallow grave < uncertain < buried);
   - for fixed e > 0.003 and apogee above GEO ≥ −200, raising p never worsens the verdict (unquiet < shallow grave < restless);
   - "fallen" exactly when apogee above GEO < −200;
   - e > 0.003 is never "buried";
   - every verdict is reachable, including "fallen";
   - the borderline flag is set exactly when [p − 25, p + 25] contains 200, 247 or 280;
   - the output does not depend on input row order, and a GP orbit always wins over SATCAT for the same NORAD id;
   - census counts add up to the number of classified objects;
   - parsing never throws on arbitrary strings.
3. THE tests SHALL include golden tests on the committed GPZ files: EchoStar-7 is "unquiet" at p = +110.4 km and Intelsat 511 is "unquiet" at p = +17.6 km.

## Out of scope

- Predicting collisions, long-term propagation and legal judgements (product.md).
- Downloading data, except the on-demand Action.
- Writing the case files' contents.
- Stretch items (MCP server, owner report card). They are listed in tasks.md after the MVP tasks.
