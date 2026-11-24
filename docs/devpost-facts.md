# Devpost facts (draft, bullets only)

Each line states a fact and where it comes from. Nothing here is written for the page. Counts are at commit time of this file (2026-11-24, snapshot 2026-11-22).

## The problem
- The IADC disposal rule asks for a perigee raised at least 235 km + 1000·C_R·A/m above GEO, with eccentricity at most 0.003 (`docs/methodology.md`, Formulas; IADC-02-01 Rev. 2, https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf).
- The IADC guidelines are voluntary: organisations are "encouraged" to use them (IADC-02-01 Rev. 2, section 2, page 6).
- The FCC minimum-perigee rule, 47 CFR § 25.283, applies only to satellites the FCC authorizes, and not to space stations launched before 18 March 2002 (https://www.law.cornell.edu/cfr/text/47/25.283, paragraphs (a) and (d)).
- The FCC's first debris penalty: DA 23-888, DISH, EchoStar-7, a disposal about 122 km above GEO against 300 km in the licence plan, $150,000 (https://docs.fcc.gov/public/attachments/DA-23-888A1.txt).
- ESA reports that, for payloads reaching end of life in the last decade in the GEO protected region, between 70% and 95% clear it successfully (Issue 9.1, 21 October 2025, Executive summary, page 7 of 146). Issue 10 (8 September 2026, page 7 of 152) says 70% to 90% (`docs/methodology.md`, Validation).

## What Sexton shows (snapshot 2026-11-22)
- 1,764 objects near GEO in the register; 696 are retired payloads with a verdict (`data/register.json` census; README census block).
- Verdicts for the 696: buried 280, unquiet 312, uncertain 50, shallow grave 30, restless 21, fallen 3 (README census block).
- 131 of the 696 were launched on or after 18 March 2002. Of those 131: buried 81, uncertain 14, shallow grave 3, unquiet 33; 36 of 131 (27.5%) are unquiet or shallow grave (`test/headline.test.ts`, golden test).
- 565 of 696 retired payloads predate any guideline (the same test).
- 141 of 696 verdicts are borderline: the perigee is within 25 km of a band edge (README census block).
- 239 of 696 orbits come from GP mean elements and 457 from SATCAT whole-km altitudes (README census block, `docs/methodology.md`).
- Validation: 27 of 45 retired payloads launched after 2007 are buried (60.0%); the ±25 km band runs from 24 of 45 (53.3%) to 29 of 45 (64.4%). This is below ESA's range, and the method was not tuned (`docs/methodology.md`, Validation; `test/headline.test.ts`).
- The Roberts (2025) figure is not shown: the paper was not opened, only the Georgia Tech listing page (https://iac.gatech.edu/publications/pub/8089).
- Every verdict carries its assumptions (C_R·A/m 0.012 to 0.045 m²/kg, ±25 km mean-element uncertainty) and its data age (`.kiro/steering/language.md`; `test/ledger.test.ts`).
- The register only sees objects still near GEO (±2,000 km window); satellites sent much higher, or that left GEO, may be missing (`docs/methodology.md`, The near-GEO filter).
- Sexton has no retirement dates and never states one (`.kiro/steering/language.md`; tests that look for a retirement word beside a year).

## Build facts
- Static site, no backend, no accounts, no analytics: Vite and TypeScript, SVG for the churchyard, deployed to GitHub Pages (`.kiro/steering/tech.md`; `.github/workflows/deploy.yml`).
- 771 tests in 22 test files, run by `npm test` (type check, Vitest, language check) (`npm test` output, 2026-11-24).
- 47 `fc.assert` property-test calls in 11 files (`docs/kiro-usage.md`).
- About 4,100 lines of TypeScript in `src/`, 900 of CSS, 1,500 in `scripts/`, 4,800 in `test/` (`git ls-files`, `wc -l`).
- Data from a committed CelesTrak snapshot; only `scripts/snapshot.ts` downloads, within CelesTrak's usage policy (https://celestrak.org/usage-policy.php; `.kiro/steering/tech.md`).
- The self-hosted display font is IM FELL English under the SIL Open Font License 1.1 (`docs/credits.md`).
- Three case files written by a custom agent: EchoStar-7 (27378), Intelsat 511 (15873), Luch/Olymp (40258) (`data/cases/`).

## Kiro features used
- Spec: 3 files, 25 numbered tasks (`.kiro/specs/sexton-core/`).
- Steering: 5 files (`.kiro/steering/`: product, tech, design, language, structure).
- Hooks: 4 hooks in 3 files, triggers `PostFileCreate` and `PostFileSave` (`.kiro/hooks/`). The language-check hook was seen running in the chat UI and in Kiro's log; its output is not returned to the agent (`docs/kiro-journal.md`, Agent hooks).
- Custom agent: `orbital-coroner`, limited to writing `data/cases/*.md` (`.kiro/agents/orbital-coroner.md`).
- MCP server: 4 read-only tools, `is_buried`, `census`, `explain`, `list` (`scripts/mcp/server.ts`; `.kiro/settings/mcp.json`). `explain(27378)` and `census()` were answered in Kiro chat (`docs/kiro-journal.md`, MCP).
- Kiro CLI in CI: manual workflow, shape-tested and run once with the secret `KIRO_API_KEY`: run 45353477849 on 2026-11-24 passed (56 s): Kiro reported 771 tests in 22 files passing and no change to README.md or data/register.json, and the plain steps agreed (`.github/workflows/kiro-verify.yml`; `test/kiro-workflow.test.ts`).
- Journal: 41 dated lines (`docs/kiro-journal.md`).
- Feature-by-feature table: `docs/kiro-usage.md`.

## Where Kiro surprised us (from the journal)
- The hook files loaded (4 read, 4 registered) but stayed disabled until each had `"enabled": true`.
- The panel's Enable button spun without saving, until Kiro was restarted.
- Hooks fire only on the agent's own file edits, not on manual saves, and the agent cannot see their output; the chat UI shows it. For two days the journal said they never fired.
- The `orbital-coroner` agent was missing from the registry because it was created mid-session.
- The census test wrote the real `data/register.json` and README.md until it was changed to run on a copy.
- The colour test matched "white" inside `white-space`.
- The language-check script passed silently when run through a symlinked path.
- The same ESA PDF returned 404 to curl's default user agent and 200 to a browser user agent, and the 70–95% in the 2025 report became 70–90% in the 2026 edition.

## Closest prior work
- Roberts (Georgia Tech), "Assessing Compliance with Post-mission Disposal Guidelines in Geosynchronous Orbit", IAA Space Traffic Management Conference, March 2025: the academic audit. Only the listing page was opened (https://iac.gatech.edu/publications/pub/8089). Sexton credits the idea and does not claim to reproduce the paper's method or figures.
- KeepTrack, graveyard-orbit explainer page (https://keeptrack.space/space-terms/graveyard-orbit, read 2026-11-24): a written explainer that gives the IADC formula and a count of 609 objects in the graveyard band, found by orbital period. On that page no per-satellite verdict table was seen. KeepTrack's wider catalogue was not examined.
- ESA's Annual Space Environment Report: yearly aggregate ranges for GEO disposal. It is a published statistic, not a per-satellite register.

## How Sexton differs
- A verdict for each retired payload (six words), each with the threshold maths, the assumptions, the ±25 km uncertainty and the data age on the same page.
- A public, per-satellite, citable page: stable link `#/sat/<NORAD id>`, a "Cite this" block, and a downloadable JSON record.
- The post-rule group is shown first, and older launches are shown as context, not as a failure.
- A validation panel that shows Sexton's rate beside a published range, with the reasons it differs and no tuning.
- Case files with every number cited to a register field or an opened source.
- An MCP server, so an assistant can query the register with the same assumptions attached.

## Not done or not checked
- The Roberts paper and its figure.
- A real phone, VoiceOver, Safari and Firefox (`docs/polish-report.md`, checklist).
