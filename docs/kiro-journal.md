2026-11-20: Created the steering files (product, tech, design, language, structure) in .kiro/steering/. No code yet.
2026-11-20: Day-1 data spike (partial). snapshot.ts resumes per data set and counts partial bodies as downloads; GPZ-PLUS dropped as a source; docs/spike.md says CONDITIONAL GO, pending SATCAT; tech.md makes SATCAT the main source.
2026-11-20: Wrote the sexton-core spec (requirements, design, tasks) in .kiro/specs/sexton-core/; FCC rule scope and moss meaning updated in steering.
2026-11-20: Task 1 done. Vite, TypeScript, Vitest, fast-check and marked scaffold; npm test runs tsc --noEmit then vitest run; smoke test imports src/engine/config.ts.
2026-11-21: Task 2 done. config.ts with derived thresholds (247, 280), types.ts, orbit.ts; tests for thresholds, perigee ≤ apogee and the GPZ golden check (863 objects within 1 km of the table).
2026-11-21: Task 3 done. csv, satcat, gp and gpz-table parsers with row rejections and no-orbit-data counting; snapshot fixtures (36 SATCAT rows, 7 GPZ objects) with real sha256 values; 63 tests pass.
2026-11-21: Task 4 done. merge.ts: near-GEO filter, GP-wins orbit, status from SATCAT or GPZ table, disagreements, launch-year fallback, output sorted by NORAD id; 91 tests pass.
2026-11-21: Task 5 done. classify.ts: six verdicts, borderline flag, margins, era and yearsSinceLaunch, with edge examples and fast-check properties; EchoStar-7 and Intelsat 511 golden tests; 120 tests pass.
2026-11-21: Task 6 done. census.ts and engine.ts (runEngine); on the committed GPZ files with no SATCAT it gives 238 retired payloads, all unquiet; 139 tests pass.
2026-11-21: Task 7 done. scripts/build-register.ts builds a deterministic register.json from the newest complete snapshot set; on the real data/raw/ it exits 1 with the missing-SATCAT message and writes nothing; fixture register committed; 163 tests pass.
2026-11-21: Task 8 done except the manual checks listed in tasks.md. Site shell, hash router, copy.ts, tokens, self-hosted IM FELL English (OFL), build-time register.json with the sample banner, and the churchyard SVG on the fixture register; 229 tests pass and npm run build works.
2026-11-21: Task 9 done. deploy.yml (SHA-pinned actions, per-job permissions) runs npm test and build, then deploys; Pages enabled with the GitHub Actions source; live at https://4kinc.github.io/sexton/ with the sample banner served.
2026-11-21: Task 10 done. scripts/check-language.ts with one exported stem list, skips the methodology "What we do not say" section, runs last in npm test; 30 new tests; no hits in existing files; 259 tests pass.
2026-11-22: Added three Kiro hooks (engine tests, census on data/raw, language check) and scripts/census.ts with npm run census; README census markers; 267 tests pass; hooks not yet seen firing live.
2026-11-22: Task 11 done. state.ts (filters, search and sort in the hash query), filter form, table view with aria-sort, unmarked-bones markers in the churchyard; 307 tests pass and npm run build works; keyboard path checked in headless Chrome only, VoiceOver not checked.
2026-11-22: Task 19 done. Snapshot data/raw/2026-11-22/ is complete (SATCAT by manual curl, GPZ files by snapshot.ts); spike.md section f answered: SATCAT within 5 km of GP for 863 of 868 GPZ objects, 1,763 near-GEO rows, 648 retired payloads (457 with SATCAT-only orbits), 48 status disagreements; GO, nearGeo kept at ±2,000 km. The old census test wrote README.md and register.json once SATCAT existed, so it now runs on a copy.

## Agent hooks
Format: Kiro v1 hook files, one JSON file per hook group in `.kiro/hooks/` (`{ "version": "v1", "hooks": [ { name, trigger, matcher, timeout, action } ] }`). Triggers are PascalCase names from the Kiro docs (https://kiro.dev/docs/hooks/types/). Matchers are regexes on the file path. The file triggers fire when the agent creates or saves a file. There is no git pre-commit trigger, so none is used.

Check, 2026-11-23: we suspected the hook format was wrong, so we compared the three files with the IDE 1.0 docs (https://kiro.dev/docs/ide/whats-new-v1/hooks/ and https://kiro.dev/docs/hooks/types/). The files already match: `.kiro/hooks/*.json`, `"version": "v1"`, PascalCase `PostFileSave` and `PostFileCreate`, regex `matcher`, `action.type` `command`, so nothing in them was changed and the format is not the proven cause. A save of `docs/methodology.md` with the agent's file tool (trailing space added, then removed) produced no hook output, so the hooks have still not been seen firing. The docs say the file triggers fire on saves and creates made by the agent. The docs do not say whether shell writes or editor saves by a person count, so we treat them as not counting.

| File | Trigger and matcher | What it runs |
| --- | --- | --- |
| `engine-tests-on-save.json` | `PostFileSave`, `src/engine/` | `npm run test:engine`: the engine test files, including the fast-check property tests in `test/classify.test.ts`. On failure it prints the last 80 lines to stderr and exits 1, so the failure reaches the agent. |
| `census-on-raw-data.json` | `PostFileCreate` and `PostFileSave`, `data/raw/` | `npm run census`: runs build-register, then rewrites README.md between `<!-- census:start -->` and `<!-- census:end -->` from `data/register.json`. If build-register fails it prints why, exits 1 and leaves README.md unchanged. `data/register.json` is outside `data/raw/`, so the hook cannot trigger itself. |
| `language-check-on-save.json` | `PostFileSave`, `src/ui/`, `data/cases/`, `docs/` or `README.md` | `node scripts/check-language.ts`. Any hit goes to stderr with a pointer to `.kiro/steering/language.md`. |

Tests of the hooks, 2026-11-22:
- Each command was run by hand in a shell from the project root. Engine tests: passed. Language check: passed. Census: exit 1, "No complete snapshot with satcat.csv in data/raw/...", README.md unchanged.
- Live trigger (saving a file through the agent): not observed. The hooks were created in the same session that saved the test files, and the docs say hooks load when a session starts. Saves to `src/engine/config.ts`, `data/raw/` and `docs/kiro-journal.md` produced no hook output and no hook entry in the Kiro log. Redo the three saves in a new session.
Second test, 2026-11-22 (fresh session, task 11):
- Saves made with the agent's file tools in `src/ui/`: `state.ts`, `views/filters.ts`, `views/table.ts` (new files), and edits to `main.ts`, `views/filters.ts`, plus `test/state.test.ts`. After each save the tool result held no hook output. I saw no "Language check passed." line and no hook entry of any kind.
- Several other `src/ui/` files (`copy.ts`, `router.ts`, `views/churchyard.ts`, `styles/table.css`) were changed by shell commands, not file-save tools. No hook output there either, and none was expected.
- `src/engine/` was not touched, so the engine-test hook was not exercised. The `data/raw/` census hook was not exercised either.
- So the language-check hook is still not observed firing. I did not check whether this session loaded the hooks. Language was checked by hand with `npm test` (last step, `node scripts/check-language.ts`: passed).
Third test, 2026-11-22 (census hook, Task 19):
- I created `data/raw/2026-11-22/` and its files with shell commands (mkdir, cp, a heredoc) and `scripts/snapshot.ts` wrote two more. No hook output appeared and the census did not run: README.md and `data/register.json` were unchanged afterwards. The `PostFileCreate` hook has not been seen firing. File-save tools were not used for `data/raw/`.
- `npm test` then wrote README.md and `data/register.json`, because `test/census.test.ts` ran the real census against the repository. With a complete snapshot that succeeds. I restored README.md, deleted `data/register.json` and changed the test to run on a copy.
- `docs/spike.md` and `docs/kiro-journal.md` were saved with shell commands, not file-save tools, so the language-check hook is still unobserved.
2026-11-23: The hooks loaded but were disabled until each hook object had `"enabled": true`; the panel's Enable button hung until Kiro was restarted.
2026-11-22: Task 20 done. Engine change (owner's decision): a SATCAT payload with blank or unknown status takes the GPZ table's status (statusSource 'GPZ table', disagreement kept), so retired payloads are 696, not 648; seven deliberate breaks of the rule were each caught by the merge tests. Real register built from the 2026-11-22 set and committed, README census filled in, the two real-data build-register tests now check the real set (byte-identical rebuild); 315 tests pass.
2026-11-22: Task 8b done. Churchyard fixed for the 696-stone register: linear −300 to +400 km plus a compressed high ground to +1,000 with a zigzag break, one count label per off-scale edge (15 above, 8 below), smaller stones in per-year lanes (overlapping stones 536 → 93 of 696, deterministic by NORAD id), a scrollable chart box on phones, and one Tab stop with arrow keys. Checked in headless Chrome at a true 390 px: no page-level sideways scroll. 341 tests pass.
2026-11-22: Churchyard polish done. The chart now follows the intro, the filter form is a closed <details> (open when the address has a filter, open on the table), the stray FCC legend bullet is gone, the legend says year columns are uneven, and the unfiltered status line no longer reads like a filter. At 1280×800 the chart top is visible at 662 px, with about 140 px of it above the fold. 344 tests pass.
2026-11-22: Task 12 done. Ledger at #/sat/<norad> with the design 5.6 sections, boundary-safe rounding (also for gaps and eccentricity), orbit-source, GPZ-table-status, eccentricity-rounding (18 SATCAT-only ledgers) and off-scale notes, Download JSON and print.css. All 696 real ledgers pass the language and no-retirement-date checks; 385 tests pass. Print checked only as page 1 of a headless Chrome PDF.
2026-11-23: Task 13 done. Census page at #/census: verdict, era, orbit-source, status-source (disagreements) and owner tables, shares always as "n of N", the SATCAT whole-km share (457 of 696), the GPZ-table status count (48 of 696), borderline (141 of 696), the near-GEO blind spot and the fixed caveat block. Both comparison figures are unverified, so only "pending a checked source" shows (a test reads design section 6). Same session: print fixes (html background was dark on the last page, hashes one line, duplicate Data age row), checked page by page in headless Chrome. 407 tests pass.
2026-11-23: Task 14 done. Case-file loader (hand-parsed front matter), markdown that escapes raw HTML and keeps only http, https and # links, section 8 on the ledger with the provisional notice, and a build step that fails on a bad case file naming the file. The language check covers data/cases (tested per stem). No real case files written. 461 tests pass.
2026-11-23: Task 15 done. docs/methodology.md (formulas, config values, near-GEO filter and blind spot, SATCAT against GP, the 48 table-status objects, eccentricity rounding, churchyard scale, FCC and IADC scope, credits, sources with opened links or LINK NEEDED) rendered at #/method. Test reads every CONFIG number from the file. ESA 70-95% found in the full report (page 7) and Roberts 73% not found; both stay unverified. 520 tests pass.
2026-11-23: Task 21 done and the three case files written (EchoStar-7, Intelsat 511, Luch/Olymp) with the orbital-coroner agent definition (.kiro/agents/orbital-coroner.md, Markdown with YAML front matter). SATCAT has 40258 (PAY, `-`, EA, 36,095 × 36,133 km), so provisional is false. Hooks: none fired. Every save in data/cases/ and docs/ was made with the file tools and no hook output came back, so the language-check hook was not seen running; the agent was not callable as a sub-agent here, so a general sub-agent followed its definition. 520 tests pass.
2026-11-23: Checked the hooks and the orbital-coroner agent against the Kiro docs. The three hook files and the agent file already match the documented formats and locations, so neither was changed; a file-tool save of docs/methodology.md gave no hook output and `orbital-coroner` is still not found as a sub-agent. Journal updated; 520 tests pass.
2026-11-23: Task 17 done. Contrast computed from tokens.css (smallest text ratio 5.38, moss on stone; print 7.46), all above AA, now tested; fixes: the stone card was an h3 straight under the h1 (now h2), the focus ring is no longer switched off on the page heading and main, the phone chart now starts below 900 px (at 200% zoom on a laptop the wide chart's text was about 4 px), long addresses in a ledger pushed a 320 px page sideways, and methodology table headers got scope. Checked in headless Chrome at 1280, 640 (200%), 390 and 320 px: no page-level sideways scroll on any route; reduced motion stops all 58 sway animations. VoiceOver and a real phone not checked. 673 tests pass.

2026-11-23: Task 16 done. refresh-snapshot.yml (workflow_dispatch only, SHA-pinned, job-level permissions, one concurrency group, no retries) runs snapshot.ts, build-register.ts and `gh pr create` with a body from scripts/pr-body.ts; a test parses the YAML (added the `yaml` dev dependency). Not run.

2026-11-23: Task S1 done. The sexton MCP server connected in Kiro and `explain(27378)` and `census()` answered through it (under MCP below); the language-check hook did fire: after each file-tool edit of docs/methodology.md the chat UI showed "Run Command Hook — Language check on save", and Kiro's log has two ContextualHookInvoked entries at 23:55:39 and 23:55:41, but the hook's result is not returned to the agent, so the agent saw no output; `orbital-coroner` was found as a sub-agent and its review of data/cases/40258.md raised one flag (`provisional: false`); 734 tests pass and the build works.
2026-11-24: Task 18 done. README rewritten (problem first, live link, census, six verdicts, how it was built with Kiro, limits, run/test/build, data refresh, credits, MCP kept); journal hook correction; orbital-coroner told to read docs/spike.md before flagging `provisional`; churchyard intro cut from 11 lines to 10 at 1280 px (chart top 662 px to 622 px); 40258 FCC paragraph rewritten for owner CIS; 734 tests pass and the build works. The screenshot at screenshots/churchyard.png is a placeholder.
Correction, S1 session: the hooks do fire. After each file-tool edit of `docs/methodology.md` the chat UI showed "Run Command Hook — Language check on save", and Kiro's log has two `ContextualHookInvoked` entries, at 23:55:39 and 23:55:41. The hook's result is not returned to the agent. That is why the agent saw no output in every test above and wrote "not observed". Those tests show what the agent could see. They do not show that the hooks did not run. The user's chat UI and the log are the places to look.
## What surprised us
- The hand-written hook format loaded (4 read, 4 registered) but never fired.
- The hooks loaded but were disabled because the files had no `"enabled": true`; the panel's Enable button spun without saving.
- The census test wrote the real `data/register.json` and README.md.
- The colour test matched "white" inside `white-space`.
- The check-language script passed silently when run through a symlinked path.
- The orbital-coroner agent was missing from the registry because it was created mid-session.
- Hooks fire only on the agent's own file edits, not on manual saves, and the agent can't see their output; the chat UI shows it.

## MCP

2026-11-23: Both replies below came from the sexton MCP server in Kiro (tools `explain` and `census`), not from running the script.

### explain(27378)

```
Exhumation report: NORAD 27378

The object
Name: ECHOSTAR 7
NORAD id: 27378
International designator: 2002-006A
Owner: US
Launch date: 2002-02-21
Launched before the FCC minimum-perigee rule date (18 March 2002).

The verdict
Unquiet (the orbit reaches the protected zone, perigee at most 200 km above GEO)
Its perigee is 110.1 km above GEO. Its orbit reaches the protected zone (±200 km). Its perigee is below the IADC disposal threshold under the stated assumptions.

The threshold maths
T = 235 + 1000 × C_R·A/m. With C_R·A/m from 0.012 to 0.045 m²/kg, T is 247 to 280 km.
p = +110.1 km. That is 136.9 km below 247 km, 169.9 km below 280 km, and 89.9 km below 200 km, the edge of the protected zone.
Eccentricity e = 0.00032. The IADC limit is 0.003.

Assumptions
Assumes C_R·A/m from 0.012 to 0.045 m²/kg and a mean-element uncertainty of ±25 km.
C_R is taken from 1.2 to 1.5 and A/m from 0.01 to 0.03 m²/kg. The true values for this satellite are not known.
Not borderline: more than 25 km from every band edge.

Orbit source and data age
GP mean elements, epoch 2026-11-22 12:28 UTC
Perigee above GEO: +110.1 km
Apogee above GEO: +137.1 km
Eccentricity: 0.00032
Perigee and apogee are computed from the mean motion and eccentricity in the GP mean elements.

Snapshot and sources
Snapshot 2026-11-22.

Status source
Status: retired payload, from SATCAT.

Case file
EchoStar-7

# What the register shows

- EchoStar-7 has NORAD catalogue number 27378 [register: norad].
- Its international designator is 2002-006A [register: intlDes].
- It was launched on 2002-02-21 [register: launchDate].
- The catalogue lists it as a retired payload [register: status]. The status comes from SATCAT [register: statusSource].
- Whole years from the launch date to the snapshot date: 24 [register: verdict.yearsSinceLaunch]. This is a count since launch. It is not an age at retirement.

GEO is the circular orbit about 35,786 km above the equator, where a satellite stays over one spot [register: config.geoAltitudeKm]. Perigee is the lowest point of an orbit. Eccentricity is how far an orbit is from a perfect circle. 0 is a circle [docs/methodology.md: definition of eccentricity].

The perigee is 110.1 km above GEO [register: pKm]. The apogee is 137.1 km above GEO [register: qKm]. The eccentricity is 0.0003192 [register: e]. The IADC eccentricity limit is 0.003 [register: config.iadc.eccentricityMax].

Sexton's verdict is "unquiet": the orbit reaches the protected zone [register: verdict.verdict]. The zone is GEO ± 200 km [register: config.protectedZoneKm]. The perigee is 89.9 km inside the zone's upper edge [register: verdict.margins.zone]. The verdict is not borderline [register: verdict.borderline].

The IADC guidelines are voluntary [IADC-02-01 Revision 2: https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf]. The perigee is below the IADC disposal threshold under the stated assumptions. The threshold runs from 247 km to 280 km above GEO [register: config.thresholdLowKm] [register: config.thresholdHighKm]. The perigee is 136.9 km below the low end [register: verdict.margins.low].

# Assumptions and data age

The verdict assumes a C_R·A/m between 0.012 and 0.045 m²/kg [register: config.iadc.crAmMin] [register: config.iadc.crAmMax]. These are Sexton's assumptions. They are not measured for this satellite. The verdict also allows a mean-element uncertainty of ±25 km [register: config.uncertaintyKm].

The orbit comes from GP mean elements with epoch 2026-11-22T12:28:20.523936 [register: orbitSource.epoch]. The snapshot is 2026-11-22 [register: snapshot.set].

# What the sources say

The IADC guidelines are voluntary: organisations are "encouraged" to use them [IADC-02-01 Revision 2: https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf].

The FCC minimum-perigee rule, 47 CFR § 25.283, applies only to satellites the FCC authorizes: paragraph (a) covers "a space station authorized to operate in the geostationary satellite orbit under this part" [47 CFR § 25.283: https://www.law.cornell.edu/cfr/text/47/25.283]. Paragraph (d) excludes space stations launched before March 18, 2002 [47 CFR § 25.283: https://www.law.cornell.edu/cfr/text/47/25.283]. EchoStar-7 was launched on 2002-02-21 [register: launchDate], so the rule's launch-date test is not met. The register is marked "before FCC rule" for this reason [register: verdict.era]. Sexton cannot tell whether the FCC authorized this satellite, and licence conditions can still apply.

The FCC has issued a debris penalty that concerns this satellite. Order DA 23-888 records a disposal of EchoStar-7 at 122 km above GEO, against 300 km in the disposal plan in DISH's licence [FCC DA 23-888: https://docs.fcc.gov/public/attachments/DA-23-888A1.txt]. It records a civil penalty of $150,000 [FCC DA 23-888: https://docs.fcc.gov/public/attachments/DA-23-888A1.txt].

The order's figure of 122 km [FCC DA 23-888: https://docs.fcc.gov/public/attachments/DA-23-888A1.txt] and the register's perigee of 110.1 km [register: pKm] come from different sources. Sexton has not reconciled them, and what was checked of the order does not give the date of its measurement. The 300 km is the figure in the licence's plan [FCC DA 23-888: https://docs.fcc.gov/public/attachments/DA-23-888A1.txt]. Sexton's verdict compares the perigee with the IADC formula, not with that plan.

# What this page cannot say

The register does not say when this satellite stopped working or was moved. SATCAT gives a launch date, and GP gives the current orbit. Neither gives any date for the end of its operation.

The register sees only objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.

Context
The IADC guidelines are voluntary. The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002.
We know each launch date and current orbit. We do not know when a satellite retired.
```

### census()

```
Census, snapshot set 2026-11-22
Objects near GEO in the register: 1,764
Retired payloads with a verdict: 696
Verdicts, as shares of retired payloads:
- fallen: 3 of 696 (0.4%)
- unquiet: 312 of 696 (44.8%)
- shallow grave: 30 of 696 (4.3%)
- restless: 21 of 696 (3.0%)
- uncertain: 50 of 696 (7.2%)
- buried: 280 of 696 (40.2%)
Borderline (perigee within 25 km of a band edge): 141 of 696 (20.3%)
Where the orbit comes from:
- GP mean elements: 239 of 696 (34.3%)
- SATCAT whole-km altitudes: 457 of 696 (65.7%)
Where the status comes from:
- SATCAT: 648 of 696 (93.1%)
- GPZ table: 48 of 696 (6.9%)
Assumes C_R·A/m from 0.012 to 0.045 m²/kg and a mean-element uncertainty of ±25 km.
The IADC guidelines are voluntary. The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002.
The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.
```
