# Polish report

2026-11-24. Starting point: commit `aeaa394`. All commits are on `main` and are **not pushed**, so the live site still shows the build from before this pass.

## What changed, by step

| Step | What | Commit |
| --- | --- | --- |
| 0 | `docs/polish-gap-report.md`: strengths, weaknesses and ranked fixes for the five criteria. Nothing else changed. | `b7cb868` |
| 1 | The census opens with the 131 retired payloads launched on or after 18 March 2002 (81 buried, 14 uncertain, 3 shallow grave, 33 unquiet; 36 of 131 in or near the protected zone). "565 of 696 retired payloads predate any guideline" is shown as context, not a failure. New `src/engine/headline.ts`. The label "CelesTrak snapshot, 22 Nov 2026" is on the churchyard, the census and every ledger. No verdict changed. | `e819a6f` |
| 2 | Verified the ESA range in the primary document (Issue 9.1, page 7 of 146; section 6.2 on page 131 defines success by the IADC formula). Issue 10 now says 70% to 90%; both are on the method page. Added the validation panel on the census and a "Validation against published figures" section on the method page: 27 of 45 retired payloads launched after 2007 are buried (60.0%), band 24 to 29 of 45 under ±25 km, below ESA's range, not tuned, with untested possible reasons. Added `validation.afterLaunchYear` to the config and rebuilt both registers. The Roberts figure stays pending. Steps 1 and 2 share one commit because they edit the same files. | `e819a6f` |
| 3 | Caption rewritten in neutral words. Intro in two columns from 1000 px (chart top 645 px to 525 px at 1440 wide). Tooltip on hover and keyboard focus (name, NORAD id, perigee with ±25 km, verdict word), Escape closes it. Click or Enter opens the ledger. Pre-rule stones are drawn at 65% (still 3:1), post-rule stones below the IADC threshold get a ring (36), stones with a case file carry their name, and the legend explains all three. `register.json` is preloaded. | `cac09cc` |
| 4 | Verdict and its plain sentence are the first ledger section. New "Cite this" section: name, NORAD ID, snapshot date, permalink `https://4kinc.github.io/sexton/#/sat/<id>`, assumptions. The MCP `explain` text has the same order and block. | `54e7882` |
| 5 | `.github/workflows/kiro-verify.yml` (manual, runs Kiro CLI headless, then decides by plain `npm test` and `git diff --exit-code`). `docs/kiro-usage.md` (feature, file, effect, why; every property test). Four new property tests in `test/invariants.test.ts`. README "Kiro in CI". | `99072eb` |
| 6 | `THIRD_PARTY.md`. README top reordered: problem, audience, live link, screenshot, headline number, Built with Kiro, census. LICENSE checked (GitHub reports MIT). `.kiro/` confirmed tracked and not ignored. Fresh clone: `npm install`, `npm test`, `npm run build` all exit 0 (771 tests). Link check below. | `f77a1df`, `b575159` (journal only) |
| 7 | `docs/video-shot-list.md` and `docs/devpost-facts.md`, drafts for you to rewrite. | `67ba822` |
| 8 | This report. | the commit after `67ba822` |

## Numbers

| | Before (`aeaa394`) | After |
| --- | --- | --- |
| Tests (`npm test`) | 734 in 18 files | 771 in 22 files |
| `fc.assert` property-test calls | 40 in 8 files | 47 in 11 files |
| Property tests added | | 7: two in `test/headline.test.ts` (breakdown adds up, band ordering), four in `test/invariants.test.ts`, one in `test/churchyard-polish.test.ts` (tooltip) |
| Bundle | JS 140 KB (45 KB gzip) | not rebuilt for size; `npm run build` passes |

Existing tests changed, and why. None was skipped or deleted:
- `test/census-page.test.ts`: "shows neither figure" became "shows the checked ESA range and not the Roberts figure" (the ESA figure is now verified). The "no percentage without n of N" test skips elements marked `data-published`, which hold ESA's published percentages.
- `test/methodology.test.ts`: the ban on any "70–95" or "73%" became a ban on a "73%" claim, plus a check that the ESA range appears only with its page. The opened-link list gained the two ESA PDF links.
- The fixture register was rebuilt (`config.validation` is new), using the command the test prints.
- Ledger section order follows `LEDGER.headings`, so the order test was unchanged. Two existing tests forced a change of approach rather than of the test: the stone's class string stayed `stone-link selected`, and the legend mentions "18 March 2002" once.

Property tests: no real bug was ever recorded in the journal or git history, so there is no counterexample to write up. I did not invent one.

Link check (README, THIRD_PARTY, docs, case files, `copy.ts`, `index.html`): every link returned 200 (https://4kinc.github.io/sexton/, FCC, Cornell, NASA IADC PDF, both ESA PDFs, ESA summary page, Georgia Tech listing, Google Fonts, OFL, Kiro docs and installer, modelcontextprotocol.io), and every relative README link points at a file that exists. Six CelesTrak documentation pages were **not rechecked** because requests to them timed out, and I did not retry; no CelesTrak data endpoint was requested. They were opened earlier in this project.

## What I could not do, and why

- **Roberts (2025).** The paper has not been opened by anyone on the project. The Georgia Tech page is a listing, and no search turned up the text. So the 73% figure is unchecked and not shown, and "the same method as Roberts" cannot be confirmed. Sexton's rate uses the IADC formula (the same one ESA's page 131 describes) and the 0.003 limit.
- **"Retired after 2007".** Sexton has no retirement dates, so launch year after 2007 stands in. The groups differ, and the method page says so.
- **Validation sits below the published range.** 60.0% against 70% to 95%. Reasons are listed on the method page and none is tested. A reviewer may ask about the 45-payload sample size.
- **Kiro CLI workflow was not run.** It needs `KIRO_API_KEY`. The install path used for the CLI (`$HOME/.local/bin`) and the tool names in `--trust-tools=run_command,read_file` come from the Kiro docs and were not tried. The pass or fail decision does not depend on them: the later steps run `npm test` and `git diff --exit-code` themselves.
- **Hooks.** The language-check hook is the only one seen running. The census and engine-test hooks have not been seen.
- **Tooltip on keyboard focus.** Checked by sending a pointer event in headless Chrome, which showed the right text. The focus path uses the same function, but headless Chrome did not fire focus events, so I did not see it. Click opening the ledger was checked with a synthetic click on the EchoStar-7 stone: the address became `#/sat/27378` and the ledger showed the verdict first and the cite block.
- **Loading, empty and error states** already existed (`SITE.loading`, `SITE.loadError`, `CHART.empty`, `FILTERS.none`). I did not add new ones, and I did not force a failed fetch to see the error state.
- **Contrast** of faint stones (65%) is computed in `test/a11y.test.ts` (3:1 for the outline and moss). The tooltip text is tested at 4.5:1.
- **Not pushed.** The live site was last checked before these commits. After you push, the Pages workflow deploys; rerun the live check.
- **LICENSE holder** still reads "Org".
- **The churchyard screenshot** in the README (`docs/images/churchyard.png`) is from before this pass. Retake it after deploy so it shows the caption, rings and two-column intro.

## Checklist for you

- [ ] Push `main` and confirm the Pages deploy; rerun the live check on https://4kinc.github.io/sexton/ (churchyard, `#/table`, `#/census`, `#/method`, `#/sat/27378`, 375 px).
- [ ] Retake `docs/images/churchyard.png` at 1280×800 from the deployed site (under 400 KB).
- [ ] Change the holder line in `LICENSE` from "Org".
- [ ] VoiceOver on the churchyard, tooltip, ledger and census.
- [ ] A real phone: tap a stone (it opens the ledger directly), read the legend, the cite block.
- [ ] Safari and Firefox: layout at 1440, 1024 and 390 px, the tooltip and the two-column intro.
- [ ] Keyboard only: Tab to a stone, check the tooltip appears on focus and Escape closes it.
- [ ] Add the repository secret `KIRO_API_KEY`, run Kiro verify once, and fix the install path or tool names if the run fails.
- [ ] GitHub setting "Allow GitHub Actions to create pull requests" (for the snapshot refresh workflow).
- [ ] Find the Roberts paper, read the 2007 figure and method, and then decide whether to show it.
- [ ] Decide whether you accept the validation result as it stands (60.0% against 70% to 95%).
- [ ] Rewrite `docs/video-shot-list.md` and `docs/devpost-facts.md` in your words; record the video.
- [ ] Choose the Devpost category (Costume Contest) and submit.
