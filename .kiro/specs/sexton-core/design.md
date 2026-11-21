# Design: sexton-core

This design implements `requirements.md`. It follows `.kiro/steering/` and the data findings in `docs/spike.md`. Requirement numbers are written R1.6 and so on.

## 1. Overview

```
data/raw/<date>/ (committed)      test/fixtures/ (committed)
        │                                  │
        └──────────── scripts/build-register.ts ────────────┐
                         │ reads files, checks sha256        │
                         ▼                                   ▼
                  src/engine/ (pure)                 test/fixtures/register.json
                         │                                   │
                         ▼                                   │
                  data/register.json ──────── Vite build ◄───┘ (fallback, labelled "sample data")
                                                  │
                                                  ▼
                                   GitHub Pages: static site in src/ui/
```

The site has three layers:

- **Engine** (`src/engine/`): pure TypeScript. It takes file contents as strings, plus a snapshot date and a config. It returns records, verdicts, rejections and a census. It has no DOM, no network, no clock and no `fs`.
- **Scripts** (`scripts/`): Node 24 runs the `.ts` files directly, with type stripping. `build-register.ts` is the only code that reads `data/raw/` and writes `data/register.json`. Nothing in this spec downloads data, except the on-demand Action (R11) calling the existing `snapshot.ts`.
- **Site** (`src/ui/`): Vite + TypeScript, no framework. At run time it fetches one file, `register.json`. Case files and the methodology are bundled at build time.

TypeScript runs strict, with `erasableSyntaxOnly`, so Node can strip types: no enums, no namespaces, no parameter properties. It also uses `allowImportingTsExtensions` and `noEmit`, and imports use `.ts` extensions.

### 1.1 Project setup
Choices the first task made where this design was silent:
- `package.json` has `"type": "module"` and `engines.node >= 24`. `@types/node` is pinned to the 24 line.
- `tsconfig.json` adds `verbatimModuleSyntax`, `isolatedModules`, `moduleResolution: bundler` and `lib` ES2023 + DOM. `include` covers `src`, `scripts`, `test`, `vite.config.ts` and `vitest.config.ts`, so `tsc --noEmit` also checks the scripts and tests.
- `vitest.config.ts` is separate from `vite.config.ts` and runs only `test/**/*.test.ts`.
- `src/engine/config.ts` was created in task 1 (the smoke test must import it) with the design 2.2 object. Task 2 adds the derived thresholds.
- `.gitignore` excludes `node_modules/`, `dist/` and `*.tsbuildinfo`. `package-lock.json` is committed, for `npm ci` in the deploy workflow.
- `npm run build-register` points at `scripts/build-register.ts`, which task 7 creates. It fails until then.
## 2. Engine

### 2.1 Modules

| File | Job |
| --- | --- |
| `config.ts` | The one config object (2.2). |
| `types.ts` | Record, verdict, rejection, census and register types. |
| `values.ts` | Strict number, integer and date checks for the parsers. |
| `csv.ts` | RFC 4180 CSV parser: quoted fields, `""` escapes, CRLF and LF. It returns rows with line numbers. It never throws. |
| `satcat.ts` | SATCAT rows to `SatcatRow`, or a rejection. |
| `gp.ts` | GPZ OMM rows to `GpRow`, or a rejection. |
| `gpz-table.ts` | GPZ table HTML to `{ norad, status }` rows, or a rejection. It uses string scanning, not a DOM, matching the method in `scripts/spike-2026-11-20.ts`. |
| `orbit.ts` | Mean motion to a, perigee, apogee and height above GEO. SATCAT whole-km altitudes to e. |
| `merge.ts` | The near-GEO filter, joins by NORAD id, source selection and status disagreements. |
| `classify.ts` | `classifyOrbit`, the threshold, the borderline flag and the era badge. |
| `census.ts` | Counts. |
| `engine.ts` | `runEngine(input, config)`, which ties the modules together. |

### 2.2 Config

This file holds every number in the engine (tech.md). Other modules import it and never repeat a literal.

```ts
export const CONFIG = {
  earth: { radiusKm: 6378.135, muKm3PerS2: 398600.8, secondsPerDay: 86400 }, // WGS-72
  geoAltitudeKm: 35786,
  nearGeo: { lowerKm: -2000, upperKm: 2000, orbitCenter: 'EA' },   // spike to confirm
  protectedZoneKm: 200,                                            // ± around GEO
  iadc: {
    baseKm: 235, factorKm: 1000,                                   // T(x) = 235 + 1000·x
    crAmMin: 0.012, crAmMax: 0.045,                                // m²/kg
    crRange: [1.2, 1.5], amRange: [0.01, 0.03],                    // shown as assumptions
    eccentricityMax: 0.003,
  },
  uncertaintyKm: 25,                                               // ± mean-element uncertainty
  fccRuleDate: '2002-03-18',
  status: { retired: ['-'], living: ['+', 'P', 'B', 'S', 'X'] },   // anything else: unknown
  gpzTableStatus: { 'PAY-': 'retired', 'PAY+': 'living', 'R/B': 'rocket body', 'DEB': 'debris' },
} as const;
```

The threshold edges are computed, not stored: `thresholdLowKm = baseKm + factorKm·crAmMin` (247) and `thresholdHighKm = baseKm + factorKm·crAmMax` (280). A test asserts they equal exactly 247 and 280. `register.json` carries the config it was built with, so the site draws bands and fills in the maths from the same numbers.

### 2.3 Engine API

```ts
interface EngineInput {
  satcatCsv?: string;        // absent until SATCAT is downloaded
  gpzCsv?: string;
  gpzTableHtml?: string;
  snapshotDate: string;      // ISO date, passed in (no clock)
}
function runEngine(input: EngineInput, config = CONFIG): EngineResult;
// EngineResult = { records, rejections, noOrbitDataCount, census }
```

### 2.4 Parsing and rejection (R1.1–R1.3, R1.10–R1.12)

- Columns are found by header name. A file missing a required header gives one file-level rejection, and none of its rows are used.
- A row is rejected with `{ source, line, reason }` in these cases: wrong field count, a required field missing or non-numeric, a date that is not `YYYY-MM-DD`, `e < 0` or `e ≥ 1`, mean motion ≤ 0, or apogee below perigee.
- A SATCAT row with blank APOGEE or PERIGEE is not rejected. It adds 1 to `noOrbitDataCount` and is left out (R1.11).
- Duplicate NORAD ids are resolved by rules that don't depend on row order:
  - GP: the newer EPOCH wins. If epochs tie, the smaller raw line wins, compared as strings.
  - SATCAT and the GPZ table: the smaller raw line wins. The others are rejected as "duplicate NORAD id".
- Choices made in task 3:
- Extra module `values.ts`: strict number, whole-number and calendar-date checks. `Number('')` is 0, so blank is never passed to `Number`. Dates are checked by calendar arithmetic, not a Date object.
- Every parser returns `{ rows, rejections }` (SATCAT also `noOrbitDataCount`). Rows come back sorted by NORAD id and rejections by line. `source` is the file name: `satcat.csv`, `gpz.csv` or `table-gpz.csv`.
- A file-level problem (empty file, missing required header, no table head or body) is one rejection with `line` 0, or the header's line, and no rows.
- Required headers. SATCAT: OBJECT_NAME, OBJECT_ID, NORAD_CAT_ID, OBJECT_TYPE, OPS_STATUS_CODE, OWNER, LAUNCH_DATE, DECAY_DATE, INCLINATION, APOGEE, PERIGEE, ORBIT_CENTER. GP: the seven in R1.2. Table: "NORAD Catalog Number" and "Latest Data".
- Row checks run in this order, and the first failure is the reason: field count, NORAD id, blank APOGEE or PERIGEE (counted as no orbit data and not rejected, so a row that is both blank and otherwise malformed counts as no orbit data), non-numeric APOGEE or PERIGEE, APOGEE below PERIGEE, dates, INCLINATION, then e outside [0, 1) from the altitudes.
- SATCAT LAUNCH_DATE, DECAY_DATE and INCLINATION may be blank (null). A non-blank value must be valid. A GP EPOCH must be `YYYY-MM-DDTHH:MM:SS` with an optional fraction.
- The table parser keeps the status code as written. Merge (task 4) maps it with `config.gpzTableStatus`, and an unmapped code becomes "unknown". The parser matches tags in lower case, as CelesTrak writes them, and rejects a row whose cell count differs from the header's. A row's line is the line of its `<tr` in the file.
- Duplicates are resolved over rows that passed validation. The "raw line" for the tie-break is the row's text, without the line break. The loser becomes a "duplicate NORAD id" rejection.
- Each parser has an outer try/catch as well as one per row, so an unexpected exception is a rejection with reason "unexpected error: …".
Every parser wraps its row loop so that an unexpected exception becomes a rejection. `runEngine` never throws (R1.12).

### 2.5 Merge (R1.4–R1.9)

1. **Population.** The population is SATCAT rows that pass the near-GEO filter (empty DECAY_DATE, ORBIT_CENTER `EA`, apogee and perigee both within GEO + [lowerKm, upperKm]), plus every GP NORAD id. GPZ objects lie within ±200 km of GEO by construction (spike §d), so the union only adds GP objects that SATCAT lacks.
2. **Orbit.** If a GP row exists, the orbit comes from GP (2.6) with `orbitSource = { kind: 'GP', epoch }`. Otherwise it comes from SATCAT with `orbitSource = { kind: 'SATCAT' }`.
3. **Type and status.** If a SATCAT row exists, SATCAT decides (`statusSource: 'SATCAT'`). Otherwise the GPZ table decides (`statusSource: 'GPZ table'`), and owner and launch date are `null`, shown as "unknown". If neither has the object, type and status are "unknown".
4. **Disagreement.** When SATCAT and the GPZ table both cover an object, the engine maps both to {retired payload, living payload, rocket body, debris, unknown}. If they differ, it stores `disagreement = { satcat, gpzTable }` and keeps the SATCAT value.
5. **Order.** The output is sorted by NORAD id, which makes it independent of input order (R1.13).
Choices made in task 4:
- `mergeSources({ satcat, gp, table }, snapshotDate, config)` returns `{ records, outsidePopulation }`. `satcat` is `null` when SATCAT is absent. Records are `MergedRecord`s (no verdict yet). `SatRecord` adds `verdict` and `caseFile`. The `SatRecord` and `MergedRecord` types are in `types.ts`.
- `outsidePopulation` counts SATCAT rows that fail the filter and whose id is not in GP. A row that fails the filter but whose object is in GP is in the population, and its SATCAT type, status, owner and dates are still used.
- Type and status from SATCAT: OBJECT_TYPE `PAY` splits by OPS_STATUS_CODE; `R/B` is a rocket body; `DEB` is debris; any other type is "unknown". The type codes are in `config.satcatTypes`. A table-only record gets `objectType` `PAY`, `R/B` or `DEB` from its mapped kind, or `null` if the code is not in `config.gpzTableStatus`.
- The disagreement test collapses "unknown payload" into "unknown", so SATCAT `?` against table `PAY-` is a disagreement, stored as `{ satcat: 'unknown', gpzTable: 'retired payload' }`. The record keeps the SATCAT status.
- Name and designator come from SATCAT if it has the row, else GP. Inclination comes with the orbit source. A blank SATCAT owner is `null`, shown as "unknown".
- `launchYear` is the launch date's year (`'launch date'`). Without a launch date it is the designator's year, but only if the designator looks like `YYYY-NNN` plus letters and the year is from `config.firstLaunchYear` (1957) to the snapshot year. Otherwise it is `null`. It sits on the record, not the verdict (see 2.7).
- A SATCAT row with blank APOGEE or PERIGEE never reaches merge (the parser counts it). If that object is also in GP, it takes its type and status from the GPZ table.

### 2.6 Orbit maths (R2)

```
n   = meanMotion · 2π / secondsPerDay                 (rad/s)
a   = cbrt(μ / n²)                                    (km)
hp  = a(1 − e) − Re ,  ha = a(1 + e) − Re             (altitude, km)
p   = hp − 35,786 ,    q  = ha − 35,786               (above GEO, km)

SATCAT only:  rp = PERIGEE + Re,  ra = APOGEE + Re,  e = (ra − rp)/(ra + rp)
```

Fields are stored at full float precision. Rounding happens only in the UI (5.6).
Choices made in task 2:
- `orbit.ts` exports `orbitFromMeanMotion(n, e, config)`, `eccentricityFromAltitudes(apogeeKm, perigeeKm, config)` and `orbitFromAltitudes(apogeeKm, perigeeKm, config)`. All take the config as an argument and return an `Orbit` (`semiMajorAxisKm`, `perigeeKm`, `apogeeKm`, `pKm`, `qKm`, `e`).
- SATCAT APOGEE and PERIGEE are treated as altitudes above the Earth radius, as the formula above reads. For the SATCAT path, `a = (apogee + perigee)/2 + Re`. Task 19 confirms this against real SATCAT rows.
- The config is `CONFIG` plus the exported type `Config = typeof CONFIG`. `thresholdLowKm` and `thresholdHighKm` are computed with `baseKm + factorKm·crAmMin` and `…crAmMax`. In floating point these give exactly 247 and 280, and the test checks it.
- `types.ts` holds the record, verdict, rejection and census types. The `margins` keys are `zone`, `low` and `high`, as in the 3.1 example. The census `byOwner` and `pairs` keys are strings.
- The golden test keeps its own small reader of the committed files. The table parser returns only the status, and the golden test needs the table's perigee.

### 2.7 Classification (R3)

`classifyOrbit({ p, q, e }, config)` is a pure function of three numbers. The first matching rule wins:

| # | Verdict | Condition | Plain meaning |
| --- | --- | --- | --- |
| 1 | fallen | q < −200 | The whole orbit is below the protected zone. It is not in the zone and not in the graveyard. |
| 2 | unquiet | p ≤ 200 | The orbit reaches the protected zone. |
| 3 | shallow grave | 200 < p < 247 | Above the zone, but below the IADC threshold for every assumed C_R·A/m. |
| 4 | restless | p ≥ 247 and e > 0.003 | High enough, but the orbit is more eccentric than the IADC guideline (e ≤ 0.003). |
| 5 | uncertain | 247 ≤ p < 280 | Inside the threshold band. The result depends on the unknown C_R·A/m. |
| 6 | buried | p ≥ 280 | Above the IADC threshold for every assumed C_R·A/m, with e ≤ 0.003. |

The order in the table guarantees the e conditions in R3.3: rows 5 and 6 are reached only when e ≤ 0.003. When q ≥ −200, the verdicts get worse in the order buried, uncertain, shallow grave, unquiet. The property tests (7.2) use this order.

`classify(record)` calls `classifyOrbit` only for retired payloads:
- Rocket bodies and debris get `{ kind: 'unmarked bones' }`.
- Living and unknown-status payloads get `{ kind: 'no verdict', reason }`.

Each verdict also carries the following:

- `borderline`: true when some edge in [200, 247, 280] satisfies |p − edge| ≤ 25. This equals "[p − 25, p + 25] contains the edge" (R3.4).
- `margins`: p − 200, p − 247 and p − 280, for the ledger maths.
- `era`: `'before FCC rule'` when the launch date is before 2002-03-18, `null` when it is on or after that date, and `'unknown'` when there is no launch date. Only the first shows a badge. Launch dates are compared as ISO strings, so there's no Date object and no clock.
- `yearsSinceLaunch`: the snapshot date minus the launch date, in whole years. It drives the moss. It is `null` when the launch date is unknown.
- `launchYear` and `launchYearSource` are not on the verdict. They are on every record, set by merge (2.5), because the churchyard places every object by launch year, with or without a verdict.

Choices made in task 5:
- `classify.ts` exports `classifyOrbit`, `classify(record, snapshotDate, config)`, `iadcThresholdKm(x)`, `edgesKm`, `isBorderline`, `marginsOf`, `eraOf` and `yearsSinceLaunch`. The borderline edges are the zone edge (`protectedZoneKm`) and the two thresholds. The "fallen" cut-off is `−protectedZoneKm`. The e limit is `iadc.eccentricityMax`.
- R3.5 (attach the orbit source and snapshot date to each verdict) is met without copying them onto the verdict. Every record has `orbitSource`, and the register has `snapshot.set`. The verdict holds only the fields listed above, so the register doesn't repeat them for every record.
- `reason` for "no verdict" is `'living payload'`, `'unknown status'` (a payload whose status code is not a known one) or `'unknown type'` (neither SATCAT nor the GPZ table gives a type).
- `yearsSinceLaunch` counts whole years by comparing month and day, so a launch on 18 March is a full year old on 18 March. A launch date after the snapshot date (bad data) gives 0.
- A fallen, unquiet or shallow-grave object can also be borderline. The flag looks only at p, not at the verdict.
### 2.8 Census (R5)

The census covers all records in the population:

- **Population:** total records, records outside the population (SATCAT rows that failed the filter), rejected rows, and the `noOrbitDataCount`.
- **Objects by type:** retired payloads, living payloads, unknown-status payloads, rocket bodies and debris.
- **Retired payloads:**
  - counts by verdict (the six verdicts);
  - borderline yes/no;
  - era (before rule, on or after the rule, unknown);
  - orbit source (GP, SATCAT);
  - by owner: the SATCAT owner code to counts by verdict, with `unknown` as its own key.
- **Disagreements:** the total, and a count per (SATCAT, GPZ table) pair.
- **Snapshot date.**

Each grouping is built from one pass over the same list, so its counts must add up to that list's length. A property test checks this (R5.2).

The census holds no percentages. The site computes "share buried" etc. and always shows them with the caveats in R5.5.

Choices made in task 6:
- `buildCensus(records, { snapshotDate, outsidePopulation, rejectedRows, noOrbitData })` takes classified `SatRecord`s. Retired payloads are the records whose verdict is `kind: 'verdict'`. The "unmarked bones" count is `byType['rocket body'] + byType['debris']`. The "no verdict" count is the living, unknown-status and unknown-type kinds in `byType`.
- Census keys: `byType` has all six kinds, `byVerdict` all six verdicts, each present even when 0. `byOwner` is keyed by the SATCAT owner code, with `unknown` for a record with no owner, and its keys are sorted. A disagreement pair is keyed `"<SATCAT kind> | <GPZ table kind>"`, for example `"living payload | retired payload"`. Disagreements are counted over all records, not only retired payloads.
- `rejectedRows` is the number of rejections, including file-level ones. `outsidePopulation` comes from merge.
- `runEngine` sets `caseFile: false` on every record. `build-register.ts` sets it.
- A `snapshotDate` that is not a real `YYYY-MM-DD` date gives no records and one rejection `{ source: 'engine', line: 0, reason: 'snapshotDate is not YYYY-MM-DD' }`. Any other unexpected exception becomes a rejection with source `engine`.
- An input that is absent (`undefined`, or not a string) is treated as not given. A given file that fails at file level (for example a missing header) contributes its rejection and no rows.
## 3. Build-time register (R4)

`scripts/build-register.ts [--set <dir>] [--out <file>]`:

1. Picks the newest `data/raw/<date>/` whose `manifest.json` has `complete: true` (or the folder given by `--set`).
2. Requires `satcat.csv`, `gpz.csv` and `table-gpz.csv`, each with a 200 manifest entry. Otherwise it exits 1 with, for example: `No complete snapshot with satcat.csv in data/raw/. Run scripts/snapshot.ts when CelesTrak allows it, or add satcat.csv by hand with a manifest entry. This script never downloads.`
3. Recomputes each file's sha256 and exits 1 if it differs from the manifest.
4. Calls `runEngine` with `snapshotDate` = the set's folder date, never the clock.
5. Writes `register.json` (5.1) with two-space JSON. Keys are in a fixed order and records are sorted by NORAD id, so two runs give byte-identical output (R4.4).

Choices made in task 7:
- Options are `--set <dir>`, `--out <file>` and `--cases <dir>` (default `data/cases`). A missing cases folder means no case files. Relative paths are resolved against the current directory. Exit codes: 0 done, 1 the snapshot is not usable (nothing is written), 2 bad arguments.
- The script exports `main(argv, io)` and `buildRegisterText(setDir, casesDir)`, so tests can call it in-process. It runs as a command only when it is the entry file.
- Newest set: folders in `data/raw/` named `YYYY-MM-DD`, newest first, the first whose manifest has `complete: true`. `--set` skips that search but still needs `complete: true`.
- A required file is usable when the folder has it and the manifest has an entry for it with `httpStatus` 200. If there are several, the last one is used. Failed entries are ignored.
- Error messages. No complete set: the message in step 2 above. A required file missing from the folder or the manifest: `<set> has no <file> (it needs the file and a manifest entry with httpStatus 200). Run scripts/snapshot.ts when CelesTrak allows it, or add <file> by hand with a manifest entry. This script never downloads.` A hash difference: `sha256 mismatch for <file> in <set>: manifest says <x>, the file is <y>. Nothing was written.`
- `snapshotDate` is the folder name when that is a real `YYYY-MM-DD` date. Otherwise it is the date part of the manifest's `startedAt` (this is how the fixture folder `snapshot/` gets 2026-11-20). With neither, the script exits 1. `snapshot.set` holds the same date.
- `register.json` has the keys, in this order: `schema`, `sample` (always false here; the Vite copy sets it for the fixture), `snapshot`, `config` (the whole `CONFIG`, including the two thresholds), `records`, `rejections`, `noOrbitDataCount`, `census`. `snapshot.sources` lists `satcat.csv`, `gpz.csv`, `table-gpz.csv` with `file`, `url`, `fetchedAt`, `sha256`, `bytes` from the manifest. It has no timestamp, so two runs match byte for byte.
- The file is written only after every check passes.
- The fixture register is built with `node scripts/build-register.ts --set test/fixtures/snapshot --out test/fixtures/register.json --cases test/fixtures/cases`. Passing `--cases` keeps it independent of `data/cases/`. The fixture has no Luch/Olymp (40258), so no record in it has `caseFile: true`. Task 14 can add a row if the UI needs one.
- The two tests on the real `data/raw/` skip themselves once a complete set with SATCAT exists (task 20). Task 20 should replace them with a check on the real register.
**Fixture register.** `--set test/fixtures/snapshot --out test/fixtures/register.json` builds a small register from the hand-made fixtures, using the same code path. The UI is developed against it while SATCAT is missing.

**Which register the site uses.** At build time, Vite copies `data/register.json` into the output as `register.json`. If that file doesn't exist, it copies `test/fixtures/register.json` instead and sets `"sample": true` in it. The site then shows a fixed banner on every page: "Sample data for layout only. This is not the register." So the early deploy (tasks.md) is live without pretending to show real results.

### 3.1 register.json

```jsonc
{
  "schema": 1,
  "sample": false,
  "snapshot": { "set": "2026-11-20", "sources": [ { "file", "url", "fetchedAt", "sha256", "bytes" } ] },
  "config": { /* CONFIG as used, plus thresholdLowKm and thresholdHighKm */ },
  "records": [ {
    "norad": 27378, "name": "ECHOSTAR 7", "intlDes": "2002-006A",
    "objectType": "PAY", "status": "retired", "statusSource": "SATCAT",
    "owner": "US", "launchDate": "2002-02-21",
    "launchYear": 2002, "launchYearSource": "launch date", "decayDate": null,
    "perigeeKm": 35896.4, "apogeeKm": 35922.2, "pKm": 110.4, "qKm": 136.2,
    "e": 0.00030476, "inclinationDeg": 0.03,
    "orbitSource": { "kind": "GP", "epoch": "2026-11-20T12:07:02.320608" },
    "disagreement": null,
    "verdict": { "kind": "verdict", "verdict": "unquiet", "borderline": false,
                 "margins": { "zone": -89.6, "low": -136.6, "high": -169.6 },
                 "era": "before FCC rule", "yearsSinceLaunch": 24 },
    "caseFile": true
  } ],
  "rejections": [ { "source": "satcat.csv", "line": 1234, "reason": "APOGEE is not a number" } ],
  "noOrbitDataCount": 0,
  "census": { /* 2.8 */ }
}
```

The values above are illustrative, apart from p, q and e, which come from spike §b.

## 4. Language check (R10)

`scripts/check-language.ts`:

- Banned stems live in one exported list: `violat`, `illegal`, `non-compliant`, `noncompliant`, `non compliant`, `broke the law`, `breach`, `unlawful`. Matching is case-insensitive. `language.md` lists the same stems, and a test checks the two lists match.
- It scans `src/ui/**`, `data/cases/**`, `docs/**` and `README.md`. It also scans `index.html`, which holds user-facing text but sits outside `src/ui/`. It reads text files only (`.ts`, `.css`, `.html`, `.md`, `.json`, `.svg`).
- In `docs/methodology.md` it skips the section from the heading `## What we do not say` up to the next `## ` heading.
- On a hit it prints `file:line: "match"` for each one and exits 1. With no hits it exits 0.
- `npm test` runs `tsc --noEmit && vitest run && node scripts/check-language.ts`. The typecheck always runs first. Task 17 appends the contrast check.

## 5. Site

### 5.1 Routes (R7.2)

The site uses **hash routes**, which work on GitHub Pages with no server and no 404 trick:

| Route | View |
| --- | --- |
| `#/` | Churchyard, with filters as query parameters: `#/?verdict=buried&owner=US&era=before&q=intelsat` |
| `#/table` | The same data as a table, with the same filters |
| `#/sat/27378` | Ledger for one object |
| `#/census` | Census and the comparison with ESA and Roberts |
| `#/method` | Methodology and honesty page |

Prebuilt pages per object would also work and would give better link previews. They would cost a build step for about 2,000 pages and slow every deploy. Hash routes are simpler and enough for 5 days.

### 5.2 Files

```
index.html                 shell: skip link, nav, <main>, sample banner slot
src/ui/main.ts             fetch register.json, start router
src/ui/router.ts           hash parsing → view
src/ui/state.ts            filters ↔ hash query
src/ui/copy.ts             all user-facing strings, one place (language check reads it)
src/ui/views/{churchyard,table,ledger,census,method}.ts
src/ui/svg/{scale,headstone,bands}.ts
src/ui/content.ts          import.meta.glob of data/cases/*.md and docs/methodology.md (?raw)
src/ui/markdown.ts         marked, with raw HTML escaped
src/ui/styles/{tokens,base,churchyard,table,ledger,print}.css
src/ui/fonts/              self-hosted serif (woff2) + OFL.txt
```

The only runtime dependency is `marked`, for markdown. Raw HTML in markdown is escaped, not passed through.

### 5.3 Visual system

**Palette (CSS custom properties in `tokens.css`).** Contrast was checked with the WCAG formula. The smallest text ratio on a dark background is 5.38 : 1.

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--ground` | `#14181e` | page background | — |
| `--road` | `#1d232b` | protected-zone band | — |
| `--stone` | `#2a3038` | headstone face | — |
| `--bone` | `#e9e4d8` | text, headstone outline | 14.0 on ground, 12.5 on road, 10.5 on stone |
| `--bone-muted` | `#a8a99f` | secondary text | 7.5 on ground, 6.7 on road, 5.6 on stone |
| `--moss` | `#8fae78` | moss, positive marks | 7.2 on ground, 6.4 on road, 5.4 on stone |
| `--lantern` | `#e8a83e` | focus ring and selection only | 8.6 on ground, 7.6 on road, 6.4 on stone |
| `--ink`, `--ink-muted`, `--paper` | `#1a1a1a`, `#555555`, `#ffffff` | print only | 17.4 and 7.5 on paper |

**Type.** The display serif is IM FELL English (SIL Open Font License), self-hosted as woff2. Its licence goes in `src/ui/fonts/OFL.txt` and is credited on the methodology page. Body text and tables use the system sans stack (`system-ui, …`), so no second font is loaded. Numbers on headstones also use the serif with `font-variant-numeric: lining-nums`. I'll test small numbers for legibility in the first UI task. If the serif is too rough at that size, the numbers move to the sans.

### 5.4 Churchyard view (R6)

**Axes.**
- y is p, on a linear scale from −300 to +450 km, which gives room around −200 to +400. The scale is in `svg/scale.ts` and is UI layout, not a threshold.
- An object outside the drawn range sits at the top or bottom edge, with a ▲ or ▼ and its true value, for example "▼ −1,840 km" (R6.3).
- x is `launchYear` (R6.2): one column per year, with stones in a column spread by NORAD id. When the launch date is unknown, the year comes from the international designator (2.7). Only objects with no usable year go in a narrow "launch year unknown" column at the left. A stone placed by designator year gets no moss, and its card says "launch year from designator".
- A thin vertical line at 18 March 2002 is labelled "FCC minimum-perigee rule (launches from 18 Mar 2002)". It carries the era, so it passes the "every element carries data" rule.

**Bands** (R6.4). Band edges come from `register.config`:

| Band | Range | Label (shown once) |
| --- | --- | --- |
| below the road | p < −200 | "Below the protected zone" |
| the road | −200 ≤ p ≤ 200 | "The road: the GEO protected zone, ±200 km" |
| shallow ground | 200 < p < 247 | "Shallow ground: above the zone, below the IADC threshold" |
| the churchyard wall | 247 ≤ p < 280 | "The churchyard wall: the IADC threshold band. Where it stands depends on the unknown C_R·A/m" |
| consecrated ground | p ≥ 280 | "Consecrated ground: above the IADC threshold for every assumed C_R·A/m" |

The wall is drawn as a low stone wall whose top edge is shaded from 247 to 280, so its height visibly spans the uncertainty.

The verdict uses p only when q ≥ −200. So an unquiet stone can stand below the road when its perigee is below −200 km but its apogee reaches the zone. Its ledger explains this.

**Headstones** (R6.5–R6.7). Each verdict has its own shape, so colour is never the only cue (R6.10):

| Verdict | Glyph |
| --- | --- |
| buried | upright headstone with a rounded top, set in the ground |
| uncertain | upright headstone with a "?" carved in it |
| shallow grave | headstone sunk to half height in a mound |
| unquiet | headstone with no base, outlined, standing on the road |
| restless | upright headstone that sways (or is tilted, under reduced motion) |
| fallen | headstone lying flat, below the road |

- **Moss** grows on the stone's lower edge in four steps by years since launch: under 10, 10–19, 20–29 and 30 or more. The steps are drawn as coverage, not colour alone. The legend says "Moss: years since launch".
- **Sway** is a CSS rotation about the stone's base. The angle is proportional to e, from 1° to 4° over e from 0.003 to 0.03. One cycle takes 8 s, and stones are out of phase by NORAD id. Under `prefers-reduced-motion: reduce` there's no animation, and the stone is drawn at that same angle without moving, so the data stays readable.
- **Borderline** objects get a small dotted "±25 km" whisker.
- **Unmarked bones** (rocket bodies and debris) are small plain markers with no inscription. They're hidden by default and turned on with a filter. Living and unknown-status payloads aren't drawn, since they're not retired. They appear in the table view.
- **Selection.** Clicking or tapping a stone marks it in lantern amber and shows a small card with name, verdict, p, data age and a link to its ledger. Each stone is an SVG `<a href="#/sat/ID">` with `aria-label`, for example "ECHOSTAR 7, unquiet, perigee plus 110.4 kilometres above GEO". A skip link before the SVG goes to the table view.

**Filters** (R6.8): owner (select), verdict (checkboxes), era (before the rule / on or after / unknown), "show unmarked bones", and search by name or NORAD id. All are kept in the hash query, so a filtered view can be shared.

**Small screens.** The SVG uses a `viewBox` and fills the width. Below 600 px, year columns merge into 5-year columns and labels move into a legend under the chart.

### 5.5 Table view (R6.9)

- A real `<table>` with `<caption>` and `scope` headers. Its columns are name, NORAD, owner, launch date, verdict, borderline, p, q, e, orbit source and data age.
- Sortable column headers are `<button>`s with `aria-sort`.
- The same filters as the churchyard apply. The table also lists living, unknown and unmarked-bones objects, with "no verdict" and the reason.

### 5.6 Ledger (R7)

The ledger is `#/sat/<norad>` and has these sections, in this order:

1. **Name, NORAD, international designator, owner, launch date, era badge.** If the launch date is unknown, it says "unknown", with no badge.
2. **The verdict in plain words.** For example: "Unquiet: its perigee is +110.4 km above GEO, inside the protected zone (±200 km). Its perigee is below the IADC disposal threshold under the stated assumptions."
3. **Threshold maths, numbers filled in from `register.config`.** For example: "T = 235 + 1000 × C_R·A/m. With C_R·A/m from 0.012 to 0.045 m²/kg, T is 247 to 280 km. p = +110.4 km, which is 136.6 km below 247 and 169.6 km below 280."
4. **Assumptions.** The C_R and A/m ranges, ±25 km mean-element uncertainty, and the borderline flag.
5. **Orbit source and data age.** Either "GP mean elements, epoch 2026-11-20 12:07 UTC", or "SATCAT whole-km apogee and perigee, element date not given".
6. **Snapshot date and source links,** from `register.snapshot`.
7. **Status source and any disagreement** between SATCAT and the GPZ table.
8. **Case file**, if one exists (R8).
9. **Context.** The IADC guidelines are voluntary. The FCC minimum-perigee rule applies only to satellites the FCC authorizes, launched on or after 18 March 2002. Retirement date is unknown.
10. **Buttons:** "Print exhumation report" (`window.print()`) and "Download JSON". The JSON is a Blob of this record plus `snapshot` and `config`, saved as `sexton-<norad>.json`.

**Rounding.** p is shown to 0.1 km for GP orbits and whole km for SATCAT. If rounding would put the shown value on the other side of a band edge (for example, 199.96 shown as 200.0), it's shown to 2 decimals instead.

**Print CSS** (`print.css`, R7.3):
- Paper and ink colours, with no churchyard SVG, nav or buttons.
- A serif heading reading "Exhumation report", then the NORAD id.
- Sections 1–9 as plain blocks. Link URLs are printed after each link text with `a::after { content: " (" attr(href) ")" }`.
- A footer with the snapshot date and the register's source hashes.

### 5.7 Census page (R5.3–R5.5)

- A table of verdict counts for retired payloads, with shares, the era split and the owner table.
- Next to it go ESA's 70–95% and Roberts' 73%, each with its source (6), and a fixed caveat block. Each figure is shown only if section 6 marks it **verified**. An unverified figure is left out, and the page says "Comparison with <source> pending a checked source." The figures and their verified state live in one list in `src/ui/copy.ts`. Both the census task and the final audit check that list against section 6. The block says Sexton has no retirement dates. It also says objects sent much higher or that left GEO are missing, so the shares can't be compared directly.
- The number of disagreements, rejected rows and "no orbit data" rows.

### 5.8 Case files (R8)

The format is `data/cases/<norad>.md`:

```markdown
---
norad: 40258
title: Luch/Olymp
provisional: true
---
Markdown body.
```

- `content.ts` loads them with `import.meta.glob('/data/cases/*.md', { query: '?raw', eager: true })` and parses the small front matter by hand: three keys, no YAML library. A file with bad front matter fails the build with its name.
- A provisional file shows "Provisional: not yet confirmed against SATCAT" above its body (R8.3).
- `build-register.ts` sets `caseFile: true` on records that have one.
- This spec writes no case-file contents. The loader is tested with a fixture case file in `test/fixtures/cases/`.

### 5.9 Methodology page (R9)

`docs/methodology.md` is bundled as raw text and rendered at `#/method`. It contains:

- every formula in 2.6–2.7, with the config values;
- the near-GEO filter and why it was chosen;
- the status mapping;
- what the register can't see;
- why retirement dates are unknown;
- that the IADC guidelines are voluntary, and that the FCC minimum-perigee rule applies only to satellites the FCC authorizes, launched on or after 18 March 2002;
- the font licence;
- credit to Roberts for the audit method;
- the sources (6);
- a "What we do not say" section, which the language check skips.

## 6. Sources

Every link was checked on 2026-11-20. A link that couldn't be checked is written "LINK NEEDED" and must stay that way until someone opens it (R5.4).

A **figure** counts as verified only when someone has found it in the source itself and recorded the page or section here. Unverified figures are not shown (R5.3, 5.7). On 2026-11-20 both comparison figures are **unverified**:

| Figure | Status | Where it must be found |
| --- | --- | --- |
| ESA: 70–95% of GEO retirements succeed | unverified | Full ESA Space Environment Report 2025. Page NEEDED. |
| Roberts: 73% | unverified | The paper itself. LINK NEEDED. |

| Source | Link | Check result |
| --- | --- | --- |
| FCC DA 23-888, Order (DISH, EchoStar-7) | https://docs.fcc.gov/public/attachments/DA-23-888A1.txt | Opened. It states 122 km above GEO against 300 km in the licence's debris plan, and a $150,000 civil penalty. |
| 47 CFR § 25.283, FCC end-of-life disposal | https://www.law.cornell.edu/cfr/text/47/25.283 | Opened. (a) gives 36,021 km + 1000·C_R·A/m. (d) says the minimum perigee doesn't apply to space stations launched before 18 March 2002. |
| ESA Space Environment Report 2025 (summary page) | https://www.esa.int/Space_Safety/Space_Debris/ESA_Space_Environment_Report_2025 | Opened. **The 70–95% GEO figure isn't on this summary page.** Its location in the full report is LINK NEEDED. |
| Roberts, "Assessing Compliance with Post-mission Disposal Guidelines in Geosynchronous Orbit", IAA Space Traffic Management Conference, March 2025 | https://iac.gatech.edu/publications/pub/8089 | Opened. This is a listing page, not the paper. **The 73% figure isn't verified.** A link to the paper is LINK NEEDED. |
| IADC Space Debris Mitigation Guidelines | LINK NEEDED | iadc-home.org returned 403 to the checker. |
| CelesTrak SATCAT format documentation | LINK NEEDED | The CelesTrak page timed out. |

Two notes on these sources:
- **The FCC rule's reach.** 47 CFR § 25.283 applies only to satellites the FCC authorizes, launched on or after 18 March 2002. Many satellites in the register are not FCC-authorized. language.md says so, and every place the rule is mentioned must say so too.
- **EchoStar-7 needs careful wording.** Its designator, 2002-006A, means it was among the first launches of 2002. If SATCAT confirms a launch date before 18 March 2002, it gets the era badge, yet it was fined. DA 23-888 rests on the disposal plan in DISH's licence, not on the general minimum-perigee rule. So the era badge must not read as "no rules applied". The ledger text for the badge is: "Launched before 18 Mar 2002: the FCC's minimum-perigee rule does not apply. Licence conditions may still apply."

## 7. Testing

### 7.1 Fixtures (`test/fixtures/`)

- `snapshot/satcat.csv`: about 25 hand-made rows, with columns in the real order from spike §f. It covers:
  - every verdict;
  - each borderline edge, at exactly ±25 km and just outside;
  - e just above and below 0.003;
  - decayed objects, ORBIT_CENTER other than `EA`, and objects just inside and outside ±2,000 km;
  - blank APOGEE (no orbit data), malformed rows, a duplicate NORAD id and a quoted name with a comma;
  - each status code, R/B, DEB and unknown status;
  - EchoStar-7 and Intelsat 511, so GP wins;
  - a GPZ-table disagreement;
  - launch dates the day before and the day of 18 March 2002;
  - a row with a blank LAUNCH_DATE and designator `2002-006A`. It gets launchYear 2002 from the designator, with no era badge and no moss.
- `snapshot/gpz.csv` and `snapshot/table-gpz.csv`: about 6 rows each, cut down from the committed files, plus one GP-only object that isn't in the fixture SATCAT.
- `snapshot/manifest.json`: real sha256 values for the fixture files, with `complete: true`.
- `cases/40258.md`: a fixture case file.
- `register.json`: built from `snapshot/` by `build-register.ts`. A test fails if it's out of date.

### 7.2 Properties (fast-check)

| Property | Generator and check |
| --- | --- |
| perigee ≤ apogee | Random valid mean motion and e in [0, 1): hp ≤ ha. |
| T non-decreasing | x1 ≤ x2 in [0, 0.1]: T(x1) ≤ T(x2). |
| monotone, e ≤ 0.003 | e ≤ 0.003, p1 ≤ p2, q chosen ≥ −200: rank(v(p1)) ≤ rank(v(p2)), ranks unquiet 0 < shallow 1 < uncertain 2 < buried 3. |
| monotone, e > 0.003 | e > 0.003, same: ranks unquiet 0 < shallow 1 < restless 2. |
| fallen iff q < −200 | Any p ≤ q, e: (v = fallen) ⇔ q < −200. |
| never buried if e > 0.003 | Any p, q ≥ −200, e > 0.003: v ≠ buried. |
| all verdicts reachable | fc.sample, then all six verdicts seen, plus one fixed example per verdict. |
| borderline exact | Any p: flag ⇔ ∃ edge, p − 25 ≤ edge ≤ p + 25. |
| order independence | Shuffle the fixture rows of each file: `runEngine` output is deep-equal. |
| GP wins | For a generated GP row and SATCAT row with the same NORAD id: orbitSource is GP. |
| census adds up | Random record lists: every grouping sums to its population size. |
| parsers never throw | `fc.string()` and `fc.fullUnicodeString()` into each parser and `runEngine`: no exception. |

### 7.3 Golden and example tests

- On `data/raw/2026-11-20/`, every GPZ object's perigee is within 1 km of the GPZ table (R2.3).
- EchoStar-7 is unquiet with p = +110.4 ± 0.05 km. Intelsat 511 is unquiet with p = +17.6 ± 0.05 km. Both use GPZ-table status, since there's no SATCAT.
- `thresholdLowKm` is 247 and `thresholdHighKm` is 280, exactly.
- Launch-year fallback: the blank-launch-date fixture row has `launchYear` 2002 and `launchYearSource` `'designator'`, with `era` `'unknown'` and `yearsSinceLaunch` `null`. A malformed designator gives `launchYear` `null`.
- `build-register.ts` exits 1 with the missing-SATCAT message on the real `data/raw/`, writes nothing, and opens no network connection. A test stubs `fetch` to throw.
- `check-language.ts` flags a fixture file with each stem, skips the methodology section, and its list matches language.md.

UI checks are manual, done in each UI task: keyboard path, VoiceOver on macOS, contrast of any new colour, reduced motion, a phone-width viewport, and print preview.

## 8. GitHub Actions

### 8.1 Deploy (`.github/workflows/deploy.yml`)

- Runs on push to `main`, and on workflow_dispatch.
- Jobs: `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact`, `actions/deploy-pages`.
- Permissions are `pages: write` and `id-token: write`, plus `contents: read`.
- Vite `base` is `/sexton/`. Third-party actions are pinned to a commit SHA.
- It never runs `snapshot.ts`, and it doesn't run `build-register.ts`: `data/register.json` is committed.

### 8.2 Refresh snapshot (`.github/workflows/refresh-snapshot.yml`, R11)

- Runs only on `workflow_dispatch`.
- Steps:
  1. `node scripts/snapshot.ts`. Its 2-hour, partial-body and 15-minute rules read the committed manifests, so they hold on the runner too.
  2. `node scripts/build-register.ts`.
  3. Commit on a new branch `snapshot/<date>`, then `gh pr create`.
- If any step fails, the job fails without opening a PR. There are no retries (R11.3).
- Permissions are `contents: write` and `pull-requests: write`.
- The repository setting "Allow GitHub Actions to create pull requests" must be on.
- Risk: CelesTrak may treat cloud runner addresses differently from a home connection. A failure there costs one try per data set per 2 hours, which is the same as running it locally.

## 9. Requirement coverage

| Requirement | Design section |
| --- | --- |
| R1 Ingest | 2.4, 2.5 |
| R2 Orbit maths | 2.6, 7.3 |
| R3 Classification | 2.7 |
| R4 Register | 3 |
| R5 Census | 2.8, 5.7, 6 |
| R6 Churchyard | 5.3, 5.4 |
| R7 Ledger | 5.1, 5.6 |
| R8 Case files | 5.8 |
| R9 Methodology | 5.9, 6 |
| R10 Language check | 4 |
| R11 Refresh | 8.2 |
| R12 Tests | 7 |
