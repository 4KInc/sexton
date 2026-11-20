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

- [ ] 2. Config and orbit maths
  - `src/engine/config.ts` (design 2.2), with the derived `thresholdLowKm` and `thresholdHighKm`.
  - `src/engine/types.ts`.
  - `src/engine/orbit.ts`: mean motion to a, hp, ha, p, q; SATCAT altitudes to e.
  - Tests:
    - the thresholds are exactly 247 and 280;
    - property: perigee ≤ apogee;
    - golden: every object in `data/raw/2026-11-20/gpz.csv` is within 1 km of `table-gpz.csv`.
  - _Requirements: 2.1–2.4, 3.8, 12.2, 12.3_

- [ ] 3. Parsers and fixtures
  - `csv.ts`, `satcat.ts`, `gp.ts` and `gpz-table.ts`, with row rejections (design 2.4). Blank APOGEE or PERIGEE counts as no orbit data.
  - Fixtures in `test/fixtures/snapshot/` as listed in design 7.1, including the blank-launch-date `2002-006A` row. The manifest has real sha256 values.
  - Tests: one example per rejection reason, the quoted-comma name, no-orbit-data counting, and the property "parsers never throw on arbitrary strings".
  - _Requirements: 1.1–1.3, 1.10–1.12, 12.1, 12.2_

- [ ] 4. Merge
  - `merge.ts`: near-GEO filter from config, population union, GP orbit wins, status from SATCAT or GPZ table, disagreements, owner and launch date `null` without SATCAT, `launchYear` with the designator fallback, and output sorted by NORAD id.
  - Tests:
    - filter edges at exactly ±2,000 km;
    - decayed objects and non-`EA` objects are excluded;
    - GPZ-only record shows "GPZ table" status source;
    - disagreement recorded;
    - launch-year fallback (design 7.3);
    - properties: order independence, and GP wins over SATCAT.
  - _Requirements: 1.4–1.9, 1.13, 6.2, 12.2_

- [ ] 5. Classification
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

- [ ] 6. Census and `runEngine`
  - `census.ts` (design 2.8) and `engine.ts` (design 2.3).
  - Tests:
    - property: census counts add up;
    - `runEngine` on the fixtures gives the expected verdict counts;
    - `runEngine` with no SATCAT runs on the committed GPZ files;
    - property: `runEngine` never throws on arbitrary strings.
  - _Requirements: 5.1, 5.2, 1.12, 12.2_

## Build-time register

- [ ] 7. `scripts/build-register.ts`
  - Newest complete set, required files, sha256 check, `snapshotDate` from the folder name, deterministic `register.json` (design 3, 3.1), and `caseFile` flags.
  - Build `test/fixtures/register.json` from `test/fixtures/snapshot/`.
  - Tests:
    - on the real `data/raw/` it exits 1 with the missing-SATCAT message, writes nothing, and doesn't call `fetch` (stub it to throw);
    - a sha256 mismatch exits 1;
    - two runs give byte-identical output;
    - the fixture register is up to date.
  - _Requirements: 4.1–4.5_

## First UI and deploy

- [ ] 8. Site shell and churchyard on the fixture register
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
  - Manual checks: phone and laptop width, keyboard, VoiceOver, reduced motion, and legibility of headstone numbers in the serif.
  - _Requirements: 4.5, 6.1–6.7, 6.10_

- [ ] 9. Deploy to GitHub Pages
  - `.github/workflows/deploy.yml` (design 8.1): push to `main` and workflow_dispatch, then `npm ci`, `npm test`, `npm run build`, upload and deploy. Third-party actions are pinned by SHA, with minimal permissions.
  - Turn on Pages ("GitHub Actions" source). That's a repository setting, so ask the user first.
  - Check that the live site shows the sample banner.
  - _Requirements: 4.5_

## The rest

- [ ] 10. Language check
  - `scripts/check-language.ts` (design 4), with one exported stem list. It covers `index.html` and skips the methodology section.
  - Add it to `npm test`.
  - Tests: each stem is caught, case-insensitively; the methodology section is skipped; the list matches `language.md`.
  - Fix any hits in existing files.
  - _Requirements: 10.1–10.4_

- [ ] 11. Table view, filters and search
  - `views/table.ts` (design 5.5), with sortable headers using `aria-sort`, and all objects including those with no verdict.
  - `state.ts`: filters for owner, verdict, era and unmarked bones, plus search by name or NORAD id, all kept in the hash query and shared by both views.
  - Manual checks: keyboard only and VoiceOver.
  - _Requirements: 6.8, 6.9, 6.10_

- [ ] 12. Ledger page
  - `views/ledger.ts` (design 5.6): sections 1–10, the threshold maths from `register.config`, the boundary-safe rounding rule, the era badge text, and the FCC scope sentence.
  - "Download JSON" and `print.css` for the exhumation report.
  - Tests: the rounding rule at 199.96 and 246.96; the ledger text has no retirement date and passes the language check.
  - Manual check: print preview.
  - _Requirements: 7.1–7.5_

- [ ] 13. Census page
  - `views/census.ts` (design 5.7): verdict counts and shares, era, owner, disagreements, rejected rows, no-orbit-data rows, and the fixed caveat block.
  - The comparison figures list in `copy.ts`: show a figure only if design 6 marks it verified. Otherwise show "comparison pending a checked source".
  - Test: an unverified figure is not rendered.
  - _Requirements: 5.3–5.5_

- [ ] 14. Case-file loader and display
  - `content.ts` and `markdown.ts`, with raw HTML escaped. Hand-parse the front matter and fail the build on a bad file. Show the provisional notice.
  - Tests: use the fixture case file in `test/fixtures/cases/`, plus bad front matter and a provisional file.
  - Don't write the case-file contents; a custom agent writes them later.
  - _Requirements: 8.1–8.4_

- [ ] 15. Methodology page
  - Write `docs/methodology.md` (design 5.9): formulas, config values, filter, status mapping, limits, the FCC scope, the font licence, credit to Roberts, sources with checked links or "LINK NEEDED", and "What we do not say".
  - Render it at `#/method`.
  - Test: every number in the config appears in the file (it's read and matched).
  - _Requirements: 9.1–9.4, 3.8, 5.4_

- [ ] 16. Snapshot refresh Action
  - `.github/workflows/refresh-snapshot.yml` (design 8.2): workflow_dispatch only, then snapshot, build-register, branch and `gh pr create`, failing with no retries. Use minimal permissions.
  - Don't run it in this task.
  - Tell the user about the "Allow GitHub Actions to create pull requests" setting.
  - _Requirements: 11.1–11.3_

- [ ] 17. Accessibility and contrast pass
  - Check every colour pair actually used against WCAG AA with a small script over `tokens.css`. Add it to `npm test`.
  - Confirm colour is never the only cue, and check focus order, the skip link, and reduced motion across all views.
  - _Requirements: 6.10_

- [ ] 18. README
  - What Sexton is, its limits (language.md), how to run, test and build, how data is refreshed, and credits (Roberts, CelesTrak, font).
  - It must pass the language check.
  - _Requirements: 10.1_

## Blocked on SATCAT

- [ ] 19. Finish the spike — blocked on SATCAT
  - Answer the PENDING questions in `docs/spike.md` §f with numbers: SATCAT against GP precision, near-GEO filter counts, Luch/Olymp, status agreement, verdict-band counts, max perigee and any oddities.
  - Confirm or change the `nearGeo` limits in config, and update `docs/methodology.md` to match.
  - Record GO or NO-GO.
  - _Requirements: 1.4, 1.9, 5.1_

- [ ] 20. Build the real register — blocked on SATCAT
  - Run `build-register.ts` on the complete set, and commit `data/register.json`.
  - Check that the sample banner is gone on the live site.
  - Spot-check EchoStar-7, Intelsat 511 and Luch/Olymp ledgers against the spike.
  - _Requirements: 4.1–4.5_

- [ ] 21. Luch/Olymp case status — blocked on SATCAT
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

## Stretch (only after all tasks above)

- [ ] S1. MCP server
  - A small stdio MCP server in `scripts/mcp/` that reads `data/register.json`, with no network. Tools: `is_buried(norad)`, `census()`, `explain(norad)` (the ledger text, with assumptions and data age) and `list(verdict)`.
  - Outputs follow language.md.
  - Tests use the fixture register.

- [ ] S2. Owner report card
  - `#/owner/<code>`: an owner's retired payloads by verdict, with the borderline count, era split and the census caveats.
  - It has no ranking or score language, and passes the language check.
