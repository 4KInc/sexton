# Polish gap report

Written 2026-11-24 before any polish change, from the repository at commit `aeaa394`, the built site in `dist/`, the live site checked on the same day, and `.kiro/`. Nothing else was changed in this step.

## Facts the report rests on

- Tests: 734 passing in 18 files. Property tests (`fc.assert`): 40 across 8 files (classify 6, engine 6, merge 3, orbit 2, parsers 7, state 7, ui 8, census page 1).
- Build: `dist/assets/index-*.js` is 140 KB (45 KB gzip), CSS 12 KB, font 60 KB. `register.json` is 1.43 MB (141 KB gzip) and is fetched before anything but "loading" shows.
- Register, snapshot 2026-11-22: 696 retired payloads. By era: 565 launched before 18 March 2002, 131 on or after it. Of those 131: 81 buried, 14 uncertain, 3 shallow grave, 33 unquiet.
- Comparison figures: the ESA figure was found in the full report on 2026-11-23 but never marked verified. The Roberts 73% figure has never been found. Both show "pending a checked source".
- Kiro surfaces already in the repo: spec (3 files), 5 steering files, 3 hook files (3 hooks), the `orbital-coroner` agent, an MCP server with 4 tools, and a journal. Missing: Kiro CLI in CI, `docs/kiro-usage.md`.
- Repo hygiene: `LICENSE` exists (MIT, but the holder reads "Org"). No `THIRD_PARTY.md`. `.kiro/` is not ignored, locally or globally (`git check-ignore` prints nothing; no global ignore file is set).

## Potential Impact

Strong
- A real, sourced problem: FCC DA 23-888 (EchoStar-7), per-satellite verdicts for 696 retired payloads, with assumptions and data age on every verdict.
- Honest limits are on every page (voluntary guidelines, FCC scope, near-GEO blind spot, no retirement dates).
- Public data only, a committed snapshot, and an MCP server so assistants can query it.

Weak
- The census leads with 696 and a verdict table. 565 of those predate any guideline, so the headline reads as a failure rate it is not. The question a policy reader cares about (what about satellites launched since the rules?) is not answered on the first screen.
- There is no check against published figures. A reader cannot tell whether Sexton's numbers are in a plausible range.
- Ledger pages are not set up to be cited: no cite block, the snapshot date is near the bottom, and the verdict sentence is in the second section.

Fixes: Step 1 (headline), Step 2 (validation), Step 4 (citable ledger).

## Technological Implementation (use of Kiro)

Strong
- Spec, steering, hooks, a custom agent and an MCP server are all in use, and the journal records what failed as well as what worked.
- 734 tests, 40 of them property tests; the classifier has monotonicity and edge examples.
- The journal's hook entries were wrong until 2026-11-24 and are now corrected, which supports the "Kiro surprised us" story.

Weak
- No single document maps each Kiro feature to a file and to what it changed. A judge has to read a long journal.
- No Kiro CLI run in CI.
- Some of the seven invariants the owner wants listed are not tested as properties: threshold monotone in C_R·A/m exists; verdict monotone in perigee exists; e > 0.003 never buried exists; perigee ≤ apogee exists. Missing or unclear: JSON and CSV parses classify the same (the register has no JSON input, see Step 5), input order does not change the result (exists for merge, not for the whole engine), mean motion to semi-major axis round-trip (not tested).

Fixes: Step 5 (`docs/kiro-usage.md`, missing property tests, CI workflow), Step 7 (Devpost facts).

## Design

Strong
- A coherent costume: every spooky element carries data, one display face, tokens in CSS custom properties, contrast tested in `npm test`, reduced motion tested, one Tab stop with arrow keys.
- A legend already covers the ground, the six stones, moss, sway and the uncertainty whisker.
- Loading, load-error and no-match states exist.

Weak
- There is no one-line caption that says what a stone and the road mean.
- A hover or focus tooltip does not exist as such. The `<title>` text only shows for a pointer after a delay, and not on keyboard focus. Focus fills a card below the chart. Click selects and does not open the ledger.
- Nothing separates the 131 post-rule stones from the 565 older ones, so EchoStar-7 and the post-rule problem cases do not stand out.
- Layout is checked at 1280, 640, 390 and 320 px, not at 1440 and 1024.
- `register.json` is requested only after the script runs. A preload hint is free.

Fixes: Step 3.

## Innovation

Strong
- The graveyard is the data model: height is perigee, moss is years since launch, sway is eccentricity, the road is the protected zone.
- Verdicts keep the unknown C_R·A/m as a band instead of a pass or fail.

Weak
- The first screen shows none of this. The caption, tooltip and post-rule emphasis in Step 3 are what make it visible in 10 seconds.
- The closest prior work (Roberts 2025; KeepTrack's graveyard page) is not compared anywhere a judge can find.

Fixes: Step 3, Step 7 (`docs/devpost-facts.md`).

## Presentation

Strong
- The README now opens with the problem and has a screenshot, a census block and a Kiro section.

Weak
- No headline number near the top of the README, no `docs/video-shot-list.md`, no `docs/devpost-facts.md`.
- `THIRD_PARTY.md` is missing. The README's run commands have not been tried on a fresh clone. Links have not been checked as a set.

Fixes: Step 6, Step 7.

## Ranked fixes (score impact per hour of work)

| Rank | Fix | Step | Criteria helped | Rough hours |
| --- | --- | --- | --- | --- |
| 1 | `docs/kiro-usage.md` (feature, file, effect, why) | 5 | Technological Implementation, Presentation | 1 |
| 2 | Post-guideline headline on the census, snapshot date on census, churchyard and ledger | 1 | Potential Impact, Presentation | 1.5 |
| 3 | Caption, tooltip on hover and focus, click opens the ledger, post-rule stones stand out | 3 | Design, Innovation | 3 |
| 4 | Verify the ESA figure in the primary document and show the validation panel | 2 | Potential Impact, Technological Implementation | 2 |
| 5 | Cite block and verdict sentence first on the ledger | 4 | Potential Impact, Presentation | 1 |
| 6 | `THIRD_PARTY.md`, LICENSE holder, README headline number, fresh-clone run, link check | 6 | Presentation | 1.5 |
| 7 | Missing property tests listed with invariants | 5 | Technological Implementation | 1.5 |
| 8 | Manual-trigger CI workflow that runs the Kiro CLI headless | 5 | Technological Implementation | 1.5 (cannot be run here) |
| 9 | Video shot list and Devpost facts | 7 | Presentation | 1.5 |

The steps are done in the order the owner gave (1 to 8), not in this rank order.

## Known limits of this polish pass

- The Roberts paper itself has not been opened by anyone on this project (the Georgia Tech page is a listing). The 73% figure and Roberts' exact method cannot be checked from here, so that comparison stays pending unless the paper is found.
- Sexton has no retirement dates, so "retired after 2007" cannot be reproduced exactly. Step 2 uses launch year as a stated proxy.
- The Kiro CLI workflow needs a repository secret and a CLI install that cannot be tried from this machine.
