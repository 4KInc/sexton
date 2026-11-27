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
9. WHEN both SATCAT and the GPZ table give a type or status for the same NORAD id and they disagree, THE engine SHALL keep the SATCAT value and record the disagreement on that record. EXCEPT WHEN SATCAT has a payload with a blank or unknown OPS_STATUS_CODE and the GPZ table gives a retired or living payload status, THEN THE engine SHALL use the table's status, mark the status source as "GPZ table", and still record the disagreement.
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
3. WHEN the census is shown, THE site SHALL show next to it Roberts' 73% (Georgia Tech, 2025) with a link. (Amended 2026-11-27: ESA's 70–95% figure moves to docs/methodology.md only, see R14.6.) IF a figure has not been checked against its source when the census page is built or at the final audit, THEN THE site SHALL omit that figure and SHALL say that the comparison is pending a checked source.
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

## Requirement 13: Parish register
**User story:** As an active GEO operator, an insurer, a regulator or a journalist, I want the disposal record of one owner or operator in one place, with its assumptions and data age, so that I can quote it or check it without reading 696 ledgers.
### Acceptance criteria
1. THE site SHALL give every group in the parish register its own page, with its own URL that works on GitHub Pages without a server. design.md SHALL choose the URL scheme. A list of all groups SHALL link to those pages.
2. THE register SHALL carry an `operator` field for the retired payloads launched on or after 18 March 2002 (131 in the 2026-11-22 snapshot) and for no other record. A non-null `operator` SHALL have a `operatorSource` URL of a source that was opened: an operator's own site, an FCC or ITU filing, or an agency notice. WITHOUT an opened source THE operator SHALL be `null` and the site SHALL show "operator not sourced". THE operator SHALL NOT be inferred from the satellite's name, its owner code, or anything else.
3. THE operator data SHALL live in one committed file (design.md names it), each entry holding the NORAD id, the operator name as the source gives it, the source URL and the date it was opened. A test SHALL fail if any non-null operator has no source URL, if the URL is not http(s), or if an entry names a NORAD id that is not a retired payload launched on or after 18 March 2002.
4. THE `#/parish` list SHALL group by operator where one is sourced, and otherwise by SATCAT owner code. A group made from an owner code SHALL be labelled "SATCAT owner (country or organisation)". An operator group SHALL be labelled "Operator (sourced)". THE two kinds SHALL NOT be merged, and an owner code SHALL NOT be mapped to a company or country name unless the mapping has been checked in a source and recorded in design.md section 6.
5. THE group page SHALL show that group's retired payloads by verdict (all six verdicts, including those with a count of 0), the borderline count, the era split (before the FCC rule, on or after it, unknown) and the orbit-source split (GP, SATCAT). Each count SHALL be written "n of N" and SHALL link to the table view filtered to that group and verdict.
6. WHERE a count or share is shown, THE page SHALL show beside it the snapshot date, the C_R·A/m range, the ±25 km mean-element uncertainty and the data age of the orbits behind it (GP epoch range, or "SATCAT, element date not given").
7. THE page SHALL list each of the group's retired payloads with name, NORAD id, launch date, verdict, p and data age, each linking to its ledger. An operator page SHALL show each payload's source link. An owner-code page SHALL show the code exactly as SATCAT gives it and say it is SATCAT's owner field, which may name a country or organisation and not the operator.
8. THE page SHALL NOT rank groups, score or grade them, or compare one group with another. The list SHALL be in alphabetical order, with no rank column and no sort by share.
9. THE page SHALL say that the register sees only objects still near GEO, so its counts are not all of a group's satellites, and SHALL say that the IADC guidelines are voluntary and that the FCC minimum-perigee rule applies only to satellites the FCC authorizes, launched on or after 18 March 2002.
10. THE page SHALL describe the verdicts only in the words of language.md: "below the IADC disposal threshold under the stated assumptions", never a word that says a group broke a rule. THE page SHALL NOT state or imply a retirement date. Years SHALL be labelled "since launch".
11. WHEN a group has no retired payloads, or the code is not in the register, THE site SHALL say so in one sentence and link to the list. The owner "unknown" (no owner given) SHALL have a page, titled "Owner not given".
12. THE page SHALL offer the group's rows as a CSV and JSON download that carries the snapshot date, the assumptions and the data age on every row or in a header, and the operator and its source where there is one, and SHALL have a print layout like the ledger's.
13. THE counts on every owner-code page SHALL equal `register.census.byOwner` for that code. THE counts on every operator page SHALL equal a count made directly from the records. Every page SHALL pass the language check.
14. THE census page SHALL carry an operator-coverage line, "operator sourced for n of 131", with both numbers computed from the register.
## Requirement 14: Why the post-2007 payloads that are not buried were not buried
**User story:** As a journalist or a debris researcher, I want a sourced cause for each retired payload launched after 2007 that is not buried, so that I can tell which of them are disposal decisions, which are failures and which are unknown, without reading the difference from ESA's range as a verdict.
### Acceptance criteria
1. THE register SHALL hold, for each retired payload launched after `config.validation.afterLaunchYear` whose verdict is not buried (18 in the 2026-11-22 snapshot: 16 unquiet, 1 shallow grave, 1 uncertain), a case file in `data/cases/<norad>.md` written by the orbital-coroner agent in write mode, with a "Cause" line.
2. THE "Cause" line SHALL be one of: a cause stated in a source that was opened and is in the Sources table of `docs/methodology.md` (the line quotes it and links it), or "No cause in the sources opened". A cause SHALL NOT come from the agent's own knowledge, from the satellite's name or mission, or from the shape of the orbit.
3. IF a source for a payload has not been opened, THEN THE task SHALL stop for the owner to supply or open one. THE agent SHALL NOT search the web for it itself. A thin case file is correct.
4. THE case files SHALL use language.md's words, SHALL cite every number, and SHALL NOT state or imply a retirement date.
5. THE USA 340 (NORAD 55138) record SHALL be checked and the check recorded in its case file and in the journal: its perigee (−435 km relative to GEO, SATCAT altitudes only, launched 2022-11-01) is far below the protected zone, so the check SHALL say what SATCAT and any GP or table row give for it, whether the object is correctly a retired payload near GEO, and whether its verdict is "unquiet" or should be "fallen" under the engine's own rules. A change to a verdict SHALL come only from the engine's rules and the data, never by hand, and SHALL be raised with the owner.
6. THE ESA comparison (ESA Annual Space Environment Report, Issue 9.1, page 7 of 146: 70–95%) SHALL appear only in `docs/methodology.md`, under "Validation against published figures". It SHALL be removed from the README headline, from the census page (the validation panel, chart and comparison list) and from R5.3's census comparison. THE methodology section SHALL give the numbers (n, buried, share, band), the passage quoted with its page, and the differences in what is counted, and SHALL say that no cause of the gap is established, that nothing was tuned to close it and that no verdict changes.
7. THE cause table SHALL appear where the case files are listed, not as an explanation of the ESA gap. IT SHALL count payloads by "cause stated in a source" and "no cause in the sources opened", with both counts computed from the case files.
8. THE text SHALL NOT say that Sexton or ESA is wrong, SHALL NOT judge an operator, SHALL NOT use the Roberts figure unless R5.3 allows it, and SHALL pass the language check. THE launch-year cutoff SHALL stay as configured. A table of results for other cutoffs is not part of this requirement.
9. EVERY number in the new text SHALL come from the register, the config, the case files or `copy.ts`, and a test SHALL read each back.
## Requirement 15: Automated cross-browser and accessibility checks

**User story:** As a maintainer, I want the site's layout, keyboard use and accessibility checked in more than one browser on every release, so that the manual checks left over are only the ones a machine cannot do.

### Acceptance criteria

1. THE repository SHALL have end-to-end tests, run by `npm run test:e2e`, that open the built site served under its `/sexton/` base in Chromium, Firefox and WebKit.
2. THE tests SHALL visit every route (`#/`, `#/table`, a ledger, `#/census`, `#/method`, an owner page from R13) at 1440×900, 1024×768 and 390×844.
3. WHEN each page has loaded, THE tests SHALL run axe-core with the WCAG 2.2 A and AA rule tags, and SHALL fail on any violation. A failure SHALL name the route, browser, viewport, rule id and element.
4. THE tests SHALL check at 390 px that the page has no sideways scroll outside the chart's own scroll box, and at every width that the first screen shows the chart or the key numbers above the fold (design.md steering, Layout).
5. THE tests SHALL cover the keyboard path (skip link, one Tab stop in the chart, arrow keys, Enter to select, Escape to close the filter panel) and SHALL run once with `prefers-reduced-motion: reduce` and check that no animation is running.
6. THE tests SHALL record every network request and SHALL fail on any request to another origin, and on any request other than the site's own files and `register.json` (R4.5).
7. THE e2e tests SHALL NOT run as part of `npm test` and SHALL NOT run on every push. A GitHub Action started only by workflow_dispatch SHALL run them.
8. THE README and docs SHALL say what the checks do not cover: screen readers, a real phone, and Safari itself (WebKit under test is not Safari). THE docs SHALL NOT claim WCAG conformance from these checks.
9. Any new dependency SHALL be recorded in THIRD_PARTY.md with its licence, and SHALL be dev only.

## Requirement 16: Mutation testing

**User story:** As a maintainer, I want to know which faults the property tests catch that the example tests miss, so that I can say with numbers what the property tests add.

### Acceptance criteria

1. THE repository SHALL have a mutation-testing run, started by `npm run mutate`, over `src/engine/` only.
2. THE run SHALL be done three times on the same commit and the same mutants: with the example tests only, with the property tests only, and with all tests. Each run SHALL give a mutation score per file and in total.
3. THE report SHALL list the mutants killed only by property tests, with file, line, mutator and the property that killed each, and the mutants that survive every run.
4. THE report SHALL say, for each survivor, whether it is an equivalent mutant (no change in behaviour) or a gap in the tests, with a reason. A survivor that is a gap SHALL be fixed with a new test, or left listed as open.
5. THE report SHALL be committed as `docs/mutation-report.md` with the tool version, the commit, the date, the number of mutants and the run time. It SHALL claim only what the numbers show: the score of these tests on this code.
6. THE test files SHALL be split into example tests and property tests by a rule that a test checks (for example by file name or by test-name prefix), so that each run can be repeated.
7. THE mutation run SHALL NOT run in `npm test` or in the deploy workflow, and its output folder SHALL be ignored by git.
8. IF the tool cannot run with the repository's Vitest and TypeScript versions, THEN task 30 SHALL record NO-GO with the error, and R16 SHALL stay open.

## Requirement 17: Sexton as a Kiro power

**User story:** As a Kiro user, I want to install Sexton as a power, so that I can ask Kiro about GEO disposal and get answers in Sexton's wording, with assumptions and data age.

### Acceptance criteria

1. THE repository SHALL have a power directory whose manifest, skills and MCP configuration follow the current format on kiro.dev, checked when the task is done.
2. THE manifest SHALL give the name (kebab-case), version, description, author and the keywords that activate the power. THE description SHALL say what the register sees and does not see, and SHALL NOT claim a legal finding.
3. THE power SHALL carry skills for reading a verdict, for writing about satellites in the wording of language.md, and for refreshing the snapshot by hand. Each skill SHALL have a SKILL.md with a name and a description.
4. THE power's MCP configuration SHALL start the existing Sexton MCP server (S1) with no network access, no secrets and no environment variables that hold keys.
5. THE power SHALL carry its own copy of `register.json`, built by one command from `data/register.json`. Every answer SHALL give the snapshot date. A test SHALL fail if the copy is out of date.
6. THE power's files SHALL pass the language check. THE skills SHALL tell the agent never to say an operator broke a rule, never to state a retirement date, and to give the assumptions and data age with every count.
7. A test SHALL check the manifest and skills offline: required fields present, name kebab-case, version semver, each skill's front matter, and the MCP server named in the configuration present in the power.
8. THE power SHALL be installable from the repository by a person, and the install and one question asked in Kiro SHALL be recorded in the journal. The power SHALL NOT be listed in any registry by this spec.
9. THE power SHALL NOT include steering files or hooks unless the format is checked to allow them.

## Requirement 18: Hook evidence

**User story:** As a reviewer, I want to see that each Kiro hook in the repository ran, with its output, so that I can believe the hooks do what the README says.

### Acceptance criteria

1. THE journal's "Agent hooks" section SHALL have an evidence table with one row for every hook in `.kiro/hooks/*.json`, by file and hook name.
2. A row SHALL be "seen" only when it holds: the date, the Kiro client and version, the action that triggered it (which tool saved or created which file), where the firing was seen (chat output, hook panel or Kiro log) and the hook's output quoted exactly. OTHERWISE the row SHALL say "not yet seen" and what was tried.
3. THE table SHALL show, for each hook, one run that passes. For at least one hook it SHALL also show a run that fails, with its stderr, and what the agent did next.
4. A hook SHALL be triggered by the same kind of action the docs say fires it (an agent file-save or file-create tool). A save made by a shell command SHALL NOT count as evidence.
5. A test SHALL read `.kiro/hooks/*.json` and the evidence table, and SHALL fail when a hook has no row, when a "seen" row lacks a date or a quoted output, or when a row names a hook that no longer exists.
6. WHEN a hook is added, renamed or changed, THE journal SHALL get an updated row in the same task.
7. THE journal SHALL record what could not be seen, including the case from 2026-11-23 where a hook fired but its result was not returned to the agent.

## Out of scope

- Predicting collisions, long-term propagation and legal judgements (product.md).
- Downloading data, except the on-demand Action.
- Writing the case files' contents.
- Stretch items (MCP server, owner report card). They are listed in tasks.md after the MVP tasks. The owner report card is now Requirement 13.
