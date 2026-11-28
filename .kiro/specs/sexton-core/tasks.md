# Tasks: sexton-core

Work in this order. Each task ends with `npm test` passing (once task 1 exists), one dated line in `docs/kiro-journal.md` (run `date` first), and a commit. No task downloads data. Tasks marked **blocked on SATCAT** wait until `satcat.csv` is in a complete snapshot set.

Rough budget: tasks 1–8 on day 1–2, 9–11 on day 2–3, 12–18 on day 3–5, 19–21 when SATCAT arrives, 22 on day 5.

## Engine

- [x] 1. Project scaffold
  - `package.json` with Vite, TypeScript, Vitest, fast-check and `marked`. Scripts are `dev`, `build`, `test` (`tsc --noEmit && vitest run`: typecheck first, then tests; later tasks append the language and contrast checks) and `build-register`.
  - `tsconfig.json`: strict, `erasableSyntaxOnly`, `allowImportingTsExtensions`, `noEmit`, `.ts` import extensions.
  - Folders as in structure.md. `vite.config.ts` with `base: '/sexton/'`.
  - A smoke test that imports `src/engine/config.ts`.
  - _Requirements: 12.1_

- [x] 2. Config and orbit maths
  - `src/engine/config.ts` (design 2.2), with the derived `thresholdLowKm` and `thresholdHighKm`.
  - `src/engine/types.ts`.
  - `src/engine/orbit.ts`: mean motion to a, hp, ha, p, q; SATCAT altitudes to e.
  - Tests:
    - the thresholds are exactly 247 and 280;
    - property: perigee ≤ apogee;
    - golden: every object in `data/raw/2026-11-20/gpz.csv` is within 1 km of `table-gpz.csv`.
  - _Requirements: 2.1–2.4, 3.8, 12.2, 12.3_

- [x] 3. Parsers and fixtures
  - `csv.ts`, `satcat.ts`, `gp.ts` and `gpz-table.ts`, with row rejections (design 2.4). Blank APOGEE or PERIGEE counts as no orbit data.
  - Fixtures in `test/fixtures/snapshot/` as listed in design 7.1, including the blank-launch-date `2002-006A` row. The manifest has real sha256 values.
  - Tests: one example per rejection reason, the quoted-comma name, no-orbit-data counting, and the property "parsers never throw on arbitrary strings".
  - _Requirements: 1.1–1.3, 1.10–1.12, 12.1, 12.2_

- [x] 4. Merge
  - `merge.ts`: near-GEO filter from config, population union, GP orbit wins, status from SATCAT or GPZ table, disagreements, owner and launch date `null` without SATCAT, `launchYear` with the designator fallback, and output sorted by NORAD id.
  - Tests:
    - filter edges at exactly ±2,000 km;
    - decayed objects and non-`EA` objects are excluded;
    - GPZ-only record shows "GPZ table" status source;
    - disagreement recorded;
    - launch-year fallback (design 7.3);
    - properties: order independence, and GP wins over SATCAT.
  - _Requirements: 1.4–1.9, 1.13, 6.2, 12.2_

- [x] 5. Classification
  - `classify.ts`: `classifyOrbit`, `classify`, borderline flag, margins, era (full launch date only) and `yearsSinceLaunch`.
  - Properties from design 7.2:
    - T non-decreasing;
    - both monotonicity rules, with q ≥ −200;
    - fallen exactly when q < −200;
    - never buried when e > 0.003;
    - all six verdicts reachable;
    - borderline exact.
  - Example tests at every edge (−200, 200, 247, 280, e = 0.003) and at 17 March and 18 March 2002.
  - Golden: EchoStar-7 unquiet at +110.4 km, Intelsat 511 unquiet at +17.6 km.
  - _Requirements: 3.1–3.8, 12.2, 12.3_

- [x] 6. Census and `runEngine`
  - `census.ts` (design 2.8) and `engine.ts` (design 2.3).
  - Tests:
    - property: census counts add up;
    - `runEngine` on the fixtures gives the expected verdict counts;
    - `runEngine` with no SATCAT runs on the committed GPZ files;
    - property: `runEngine` never throws on arbitrary strings.
  - _Requirements: 5.1, 5.2, 1.12, 12.2_

## Build-time register

- [x] 7. `scripts/build-register.ts`
  - Newest complete set, required files, sha256 check, `snapshotDate` from the folder name, deterministic `register.json` (design 3, 3.1), and `caseFile` flags.
  - Build `test/fixtures/register.json` from `test/fixtures/snapshot/`.
  - Tests:
    - on the real `data/raw/` it exits 1 with the missing-SATCAT message, writes nothing, and doesn't call `fetch` (stub it to throw);
    - a sha256 mismatch exits 1;
    - two runs give byte-identical output;
    - the fixture register is up to date.
  - _Requirements: 4.1–4.5_

## First UI and deploy

- [x] 8. Site shell and churchyard on the fixture register
  - `index.html`, `main.ts`, `router.ts` (hash routes, design 5.1) and `copy.ts`.
  - `tokens.css` with the design 5.3 palette, plus the self-hosted IM FELL English and `OFL.txt`.
  - The build-time copy of `data/register.json`, falling back to the fixture with `sample: true`, and the sample banner (design 3).
  - Churchyard SVG (design 5.4):
    - scale and off-scale arrows;
    - the five bands, with labels from `register.config`;
    - verdict glyphs;
    - moss steps;
    - sway, with the static tilt under reduced motion;
    - the borderline whisker;
    - the 18 March 2002 line;
    - the launch-year columns, with the designator fallback;
    - the selection card;
    - SVG links with `aria-label`;
    - the skip link.
  - [ ] Manual checks (owner to finish): phone and laptop width, keyboard, VoiceOver, reduced motion, and legibility of headstone numbers in the serif. Done so far, in headless Chrome only: laptop 1280 px and phone 390 px emulated, keyboard path, reduced-motion emulation, digit legibility (see the journal). Not checked: VoiceOver, a real phone, Safari and Firefox, the animation by eye.
  - _Requirements: 4.5, 6.1–6.7, 6.10_

- [x] 8b. Fix the churchyard for the real register (design 5.4)
  - The real register draws 696 stones. Above about +420 km everything was clamped into one row, the per-stone off-scale labels collided, and 536 stones overlapped another.
  - Y scale: linear −300 to +400 as before, plus a compressed "high ground" from +400 to +1,000 with its own ticks and a zigzag break mark. Only objects above +1,000 or below −300 are off-scale. One count label per edge replaces the per-stone labels. The card and ledger keep exact values.
  - Overlap: smaller stones, and lanes inside each launch-year column, deterministic by NORAD id. Moss, sway and whiskers stay visible on an isolated stone. Overlap counts, before and after, are in design 5.4.
  - Phone (under 600 px): the chart in its own horizontally scrollable box at its natural size, with a line above it that links to the table view. No page-level horizontal scroll.
  - Keyboard: one Tab stop (roving tabindex), arrow keys by column and height, Enter selects, Home and End. Aria-labels and the skip link stay.
  - Tests: scale mapping (monotonic, break at +400, edges, off-scale counts), layout (deterministic, no shared position, overlap bound on the real register), roving tabindex and arrow-key order. `scripts/overlap.ts` and `scripts/screenshot.ts` are the measuring tools.
  - _Requirements: 6.1–6.3, 6.5–6.7, 6.10_
- [x] 9. Deploy to GitHub Pages
  - `.github/workflows/deploy.yml` (design 8.1): push to `main` and workflow_dispatch, then `npm ci`, `npm test`, `npm run build`, upload and deploy. Third-party actions are pinned by SHA, with minimal permissions.
  - Turn on Pages ("GitHub Actions" source). That's a repository setting, so ask the user first.
  - Check that the live site shows the sample banner.
  - _Requirements: 4.5_

## The rest

- [x] 10. Language check
  - `scripts/check-language.ts` (design 4), with one exported stem list. It covers `index.html` and skips the methodology section.
  - Add it to `npm test`.
  - Tests: each stem is caught, case-insensitively; the methodology section is skipped; the list matches `language.md`.
  - Fix any hits in existing files.
  - _Requirements: 10.1–10.4_

- [x] 11. Table view, filters and search
  - `views/table.ts` (design 5.5), with sortable headers using `aria-sort`, and all objects including those with no verdict.
  - `state.ts`: filters for owner, verdict, era and unmarked bones, plus search by name or NORAD id, all kept in the hash query and shared by both views.
  - Tests: `test/state.test.ts` (filters and search round-trip through the hash; churchyard and table show the same set).
  - Manual checks: keyboard only and VoiceOver. Done: keyboard only, in headless Chrome (see the journal). Not checked: VoiceOver.
  - _Requirements: 6.8, 6.9, 6.10_

- [x] 12. Ledger page
  - `views/ledger.ts` (design 5.6): sections 1–10, the threshold maths from `register.config`, the boundary-safe rounding rule, the era badge text, and the FCC scope sentence.
  - "Download JSON" and `print.css` for the exhumation report.
  - Tests: the rounding rule at 199.96 and 246.96; the ledger text has no retirement date and passes the language check.
  - Manual check: print preview.
  - _Requirements: 7.1–7.5_

- [x] 13. Census page
  - `views/census.ts` (design 5.7): verdict counts and shares, era, owner, disagreements, rejected rows, no-orbit-data rows, and the fixed caveat block.
  - The comparison figures list in `copy.ts`: show a figure only if design 6 marks it verified. Otherwise show "comparison pending a checked source".
  - Test: an unverified figure is not rendered.
  - _Requirements: 5.3–5.5_

- [x] 14. Case-file loader and display
  - `content.ts` and `markdown.ts`, with raw HTML escaped. Hand-parse the front matter and fail the build on a bad file. Show the provisional notice.
  - Tests: use the fixture case file in `test/fixtures/cases/`, plus bad front matter and a provisional file.
  - Don't write the case-file contents; a custom agent writes them later.
  - _Requirements: 8.1–8.4_

- [x] 15. Methodology page
  - Write `docs/methodology.md` (design 5.9): formulas, config values, filter, status mapping, limits, the FCC scope, the font licence, credit to Roberts, sources with checked links or "LINK NEEDED", and "What we do not say".
  - Render it at `#/method`.
  - Test: every number in the config appears in the file (it's read and matched).
  - _Requirements: 9.1–9.4, 3.8, 5.4_

- [x] 16. Snapshot refresh Action
  - `.github/workflows/refresh-snapshot.yml` (design 8.2): workflow_dispatch only, then snapshot, build-register, branch and `gh pr create`, failing with no retries. Use minimal permissions.
  - Don't run it in this task.
  - Tell the user about the "Allow GitHub Actions to create pull requests" setting.
  - _Requirements: 11.1–11.3_

- [x] 17. Accessibility and contrast pass
  - Check every colour pair actually used against WCAG AA with a small script over `tokens.css`. Add it to `npm test`.
  - Confirm colour is never the only cue, and check focus order, the skip link, and reduced motion across all views.
  - _Requirements: 6.10_

- [x] 18. README
  - What Sexton is, its limits (language.md), how to run, test and build, how data is refreshed, and credits (Roberts, CelesTrak, font).
  - It must pass the language check.
  - _Requirements: 10.1_

## Blocked on SATCAT

- [x] 19. Finish the spike
  - Answer the PENDING questions in `docs/spike.md` §f with numbers: SATCAT against GP precision, near-GEO filter counts, Luch/Olymp, status agreement, verdict-band counts, max perigee and any oddities.
  - Confirm or change the `nearGeo` limits in config, and update `docs/methodology.md` to match. (Confirmed at ±2,000 km. `docs/methodology.md` does not exist yet, so Task 15 writes the filter from spike §f.)
  - Record GO or NO-GO.
  - _Requirements: 1.4, 1.9, 5.1_

- [x] 20. Build the real register — blocked on SATCAT
  - Run `build-register.ts` on the complete set, and commit `data/register.json`.
  - Check that the sample banner is gone on the live site.
  - Spot-check EchoStar-7, Intelsat 511 and Luch/Olymp ledgers against the spike.
  - _Requirements: 4.1–4.5_

- [x] 21. Luch/Olymp case status — blocked on SATCAT
  - Set `provisional` on `data/cases/40258.md` (if it exists by then) to match what SATCAT shows. Note the result in the spike.
  - _Requirements: 8.3_

## Final audit

- [ ] 22. Final audit
  - Open every link in `docs/methodology.md`, the census page and design 6. Keep "LINK NEEDED" where a link can't be opened.
  - Re-check the ESA and Roberts figures, and leave unverified ones hidden.
  - Run the language check and the contrast check.
  - Test the live site on a phone and a laptop: keyboard, VoiceOver, reduced motion and print.
  - Write an audit note in the journal.
  - _Requirements: 5.3, 5.4, 9.1, 10, 6.10_

## Parish, validation gap, checks and packaging (R13 to R18)

Task 22, the final audit, was written before these. Each new page (tasks 24 and 26) adds its links and figures to the audit list, and task 37 repeats the audit on them. The dependencies for tasks 27 and 30 were approved on 2026-11-27 (dev only).

- [x] 23. Parish counts (engine)
  - Schema 2: `data/operators.json` (may start empty), the join in `scripts/build-register.ts`, and `operator` and `operatorSource` on the retired payloads launched on or after 18 March 2002 only (design 10).
  - `src/engine/parish.ts` with `parishOf`, `operatorCoverage` and the list of groups.
  - Tests:
    - guard (`test/operators.test.ts`): every non-null operator has an http(s) source and an opened date; every entry is a retired payload on or after 18 March 2002; no duplicates; nothing outside the 131 has an operator;
    - property: for every owner code in a generated register, the verdict counts equal `census.byOwner[code]`, and every grouping adds up to the group's retired payloads;
    - operator counts equal a direct count; a null operator is never grouped by name;
    - the "unknown" owner; a group with no retired payloads; the result does not depend on record order.
  - _Requirements: 13.2, 13.3, 13.5, 13.11, 13.13_
- [x] 24. Parish pages
  - `views/parish.ts`, the `#/parish`, `#/parish/op/<name>` and `#/parish/owner/<code>` routes, the nav item, an `operator` query key in `state.ts`, text in `copy.ts`, CSV and JSON downloads, print CSS, and the census line "operator sourced for n of 131" (design 10).
  - Owner-code groups are labelled "SATCAT owner (country or organisation)", operator groups "Operator (sourced)". Counts link to the filtered table. The assumptions line, snapshot date and data age sit beside every count.
  - Tests:
    - a link from every count lands on a table with that count of rows;
    - no ranking or score wording (the page text passes the language check, and a test looks for rank, score, grade, best and worst);
    - no retirement date in any of the real pages;
    - every owner code and operator name in the real register round-trips through the address;
    - the CSV carries the assumptions, operator and source on every row;
    - the census coverage line reads back from the register.
  - Do not map codes to names. Do not infer an operator.
  - _Requirements: 13.1, 13.4–13.14_
- [ ] 24a. Operator sources (owner). Batch A (the 36 story stones) is approved and in `data/operators.json` (19 sourced); batch B (the other 95) has not been started.
  - Ask the owner which of the 131 payloads to source first and how. For each, open an operator site, FCC or ITU filing or agency notice, and add an entry to `data/operators.json` with the URL, title and date opened. Unsourced payloads stay null.
  - Record in the journal how many of 131 are sourced.
  - _Requirements: 13.2, 13.3_
- [x] 25. Case notes: the group and USA 340 (group changed on 2026-11-27 to the 36 story stones; 19 new payloads are being sourced, see `docs/source-review.md`, batch 3)
  - A pure function listing the retired payloads launched after `config.validation.afterLaunchYear` whose verdict is not buried (18 in the 2026-11-22 snapshot), and `causeOf` and `causeCounts` (design 11).
  - Check USA 340 (55138): compare SATCAT with any GP or GPZ-table row in `data/raw/`, record what each says and whether the verdict follows from the engine's rules, in its case file and the journal. Change no verdict by hand. SATCAT's status code "-" means "Nonoperational" (CelesTrak status page), which is why it is a retired payload.
  - Tests: the group list equals a direct filter of the register (property); `causeCounts` adds up to the group size.
  - Sources proposed in `docs/source-review.md`; the owner approved, rejected or recategorised each row on 2026-11-27.
  - _Requirements: 14.1, 14.5, 14.7, 14.9_
- [x] 26. Case notes: sources and writing (all 36 done; the 19 of batch 3 were approved on 2026-11-27 and written with the main agent's file tool)
  - The approved rows are in the Sources table of `docs/methodology.md`. Run the orbital-coroner in write mode, one payload at a time. Each case file gets a `# Cause` section: `Cause category:` line, then the verbatim quote or quotes with their link, or "No cause in the sources opened". No web search by the agent. No date of the end of operation or mission.
  - Add the cause table to the case-file list page. Tests: the language check over `data/cases/`; every case file has a Cause category; every quote appears in `docs/source-review.md` as an approved row; the counts read back.
  - _Requirements: 14.1–14.4, 14.7, 14.9_
- [x] 26a. Move the ESA comparison
  - Remove ESA's range from the README headline, the census validation panel and chart, and the ESA entry in `COMPARISONS`. Keep it in `docs/methodology.md`, Validation, with the line that nothing was tuned, no verdict changes and no cause of the gap is established.
  - Add the cause-count line to the census page and the README (R14.7), built from `causeCounts`.
  - Update the tests that read those pieces. Add a test that "70%" and "ESA" appear in no `src/ui/` file text or README outside methodology.md.
  - Check the main chunk stays at 185 KB or less (it should shrink).
  - _Requirements: 14.6, 14.7, 14.8_
- [x] 27. Browser checks: spike and dependency approval
  - The owner approved `@playwright/test`, `@axe-core/playwright` and `axe-core` on 2026-11-27, dev only (design 12). They are pinned exactly and recorded in THIRD_PARTY.md under "Development only (not in dist/)". Check that `npm run build` leaves no MPL-2.0 code in `dist/`.
  - Run one spec on `#/census` in all three browsers, with axe. Check axe-core's docs for the `wcag22aa` tag. If it is not supported, use `wcag21aa` and say so in the journal and README. Record GO or NO-GO and the run time in the journal.
  - _Requirements: 15.1, 15.3, 15.9_

- [x] 28. Browser checks: the suite
  - `playwright.config.ts` and `e2e/`, with `npm run test:e2e` (design 12): every route and width, axe on each, the keyboard path, reduced motion, no sideways scroll at 390 px, the first-screen check and the network check.
  - Fix any real failure it finds in the site, one fix per journal line. Do not switch an axe rule off to pass. A rule that is a false positive is excluded by id, with the reason in the spec file and the journal.
  - _Requirements: 15.2–15.6_

- [x] 29. Browser checks: workflow and docs
  - `.github/workflows/e2e.yml`, `workflow_dispatch` only, actions pinned by SHA (design 12). Don't run it in this task.
  - README and `docs/` say what the checks do not cover (screen readers, a real phone, Safari). Keep the manual items open in task 8, 11 and 22 where they still are.
  - Test: the workflow has no push or pull_request trigger (as for the refresh workflow's test).
  - _Requirements: 15.7, 15.8_

- [ ] 30. Mutation testing: spike
  - The owner approved `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` on 2026-11-27, dev only (design 13). They are pinned and in THIRD_PARTY.md.
  - Timebox: one attempt plus one fix (for example dropping the TypeScript checker plugin). If Stryker does not run against `src/engine/` with this TypeScript and Vitest after that, stop, record exactly what failed in the journal, and mark this task "attempted, not working". Do not patch around it.
  - Run Stryker on `src/engine/classify.ts` alone with the vitest runner. Try the `fc.assert` switch (design 13, option 2) and count property tests it does not switch off.
  - Record GO or NO-GO in the journal, with the first error if NO-GO. On NO-GO stop here and leave R16 open (R16.8).
  - _Requirements: 16.1, 16.6, 16.8_

- [ ] 31. Mutation testing: run and report
  - `npm run mutate`: the three runs over `src/engine/` (design 13). Split the tests by the rule chosen in task 30, with a test that checks the rule.
  - `scripts/mutation-report.ts` writes `docs/mutation-report.md` from Stryker's JSON. `reports/` goes in `.gitignore`. The run is in neither `npm test` nor the deploy workflow.
  - Fill the survivor triage. For each real gap, add a test or leave it listed as open. Count each new test in the journal, and say which survivor it kills.
  - _Requirements: 16.1–16.7_

- [x] 32. Power: format check and layout
  - Open https://kiro.dev/docs/powers/create/ again and note anything that changed since 2026-11-27. Create `power/sexton/` with `plugin.json`, the three skills and `mcp.json` (design 14). Settle the keywords.
  - The skills carry language.md's rules and the verdict table, and tell the agent to give assumptions and data age with every count and never a retirement date.
  - Test: the offline manifest and skill checks (R17.7), and the language check over `power/`.
  - _Requirements: 17.1–17.3, 17.6, 17.7, 17.9_

- [x] 33. Power: bundled server and register
  - `scripts/build-power.ts`: bundle the MCP server with Vite's SSR build and copy `data/register.json` (design 14). Check that the bundle runs under plain `node` from another folder.
  - Test: the bundle and the copy are up to date, and the server's four tools answer from the copy with the snapshot date. If the bundle cannot run, record it in the journal and stop for the owner's decision.
  - _Requirements: 17.4, 17.5_

- [x] 34. Power: install check (owner; done 2026-11-27 on Kiro IDE 1.4.236, Kiro Agent 0.66.119: folder in Restricted Mode, chat Supervised, no approval prompts, tools shown as @sexton/sexton/<tool>; two replies and screenshots in docs/evidence/power-*.png recorded at the bottom of docs/kiro-journal.md; the 27516 reply lacked the cause, so is_buried now returns the cause category line and SKILL.md says to call explain)
  - Install the power from the folder in Kiro (Powers panel, Add Custom Power), ask one question that its keywords should trigger, and check the answer gives the snapshot date and assumptions.
  - Record the Kiro version, the steps, what the path and approval behaviour were (design 14, unverified list) and any change needed. Do not list the power in a registry.
  - _Requirements: 17.8_

- [x] 35. Hook evidence: table and guard (done 2026-11-27; all rows stay "not yet seen" until the owner adds what the chat UI shows)
  - Write the evidence table in the journal's "Agent hooks" section, with a row for each of the four hooks, from design 15. Rows stay "not yet seen" unless the journal already holds the evidence the table asks for.
  - `test/hook-evidence.test.ts` (design 15).
  - Don't touch the hook files in this task.
  - _Requirements: 18.1, 18.2, 18.5, 18.7_

- [x] 36. Hook evidence: watch each hook fire (ticked 2026-11-27 on the owner's rule that both census log entries exist: 18:50:46 and 18:50:50; a passing run for each of the four hooks and a failing run of the language check were triggered with file tools; the output is for the owner to add)
  - In a fresh session, trigger each hook with the agent's own file tools, as design 15 lists, and record each result in the table: the passing run for all four, and a failing run for at least one. Quote the output exactly, and say where it was seen.
  - Revert every scratch file and temporary break in the same task. Check `git status` and `git diff README.md`.
  - A hook that still does not fire stays "not yet seen", with what was tried. Don't change a hook file to make it fire without a journal line saying why.
  - _Requirements: 18.2–18.4, 18.6, 18.7_

- [ ] 37. Audit addendum for R13 to R18
  - Open every link added by tasks 24, 26, 29 and 34. Run the language and contrast checks, and the browser suite once by hand.
  - Check each new "unverified" item in design 10 to 15 and update it to verified, or leave it, with the date. Note the result in the journal.
  - _Requirements: 13.5, 14.4, 15.8, 17.8, 18.2_

## Stretch (only after all tasks above)

- [x] S1. MCP server
  - A small stdio MCP server in `scripts/mcp/` that reads `data/register.json`, with no network. Tools: `is_buried(norad)`, `census()`, `explain(norad)` (the ledger text, with assumptions and data age) and `list(verdict)`.
  - Outputs follow language.md.
  - Tests use the fixture register.

- S2. Moved to R13.
