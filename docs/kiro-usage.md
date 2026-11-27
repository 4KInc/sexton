# How Sexton used Kiro

Everything below comes from files in this repository and from `docs/kiro-journal.md`. Where something was not seen working, it says so.

## Kiro features, files and what they did

| Kiro feature | Exact file or path | What it did | Why it mattered |
| --- | --- | --- | --- |
| Spec: requirements | `.kiro/specs/sexton-core/requirements.md` | Numbered requirements (R1 to R12) for the engine, census, ledger, language and refresh. | Tasks and tests cite requirement numbers, so a reviewer can trace a test to the rule it checks. |
| Spec: design | `.kiro/specs/sexton-core/design.md` | Formulas, the verdict order, the register shape and the site design. Section 6 records which comparison figures were checked in their source. | `test/census-page.test.ts` reads section 6, so the site cannot show a figure the spec calls unverified. The ESA range stayed hidden until the report was opened (2026-11-24). |
| Spec: tasks | `.kiro/specs/sexton-core/tasks.md` | 25 numbered tasks, ticked only after `npm test` and `npm run build` passed. 23 are ticked at the time of writing. | Kept the work in small steps. The journal has one dated line per task. |
| Steering: product | `.kiro/steering/product.md` | Audience, problem, scope, and what is out of scope (no collision prediction, no legal judgements). | Held the project to a register and an audit, and away from forecasting. |
| Steering: tech | `.kiro/steering/tech.md` | Stack, data sources, the CelesTrak usage policy, WGS-72 constants, and the rule that thresholds live in one config object. | `src/engine/config.ts` is that object, and `docs/methodology.md` must list every number in it (a test checks). `scripts/snapshot.ts` follows the usage policy. |
| Steering: design | `.kiro/steering/design.md` | The churchyard mood, the palette as CSS custom properties, one display face, and the table of what each spooky element means. | Every stone height, moss and sway is a number. `test/a11y.test.ts` computes contrast from `tokens.css`. |
| Steering: language | `.kiro/steering/language.md` | Banned stems, "say what is voluntary", "never imply a retirement date", "say what the register cannot see". | `scripts/check-language.ts` matches the stems, runs last in `npm test`, and runs from a hook. Tests read generated text for a retirement word next to a year. |
| Steering: structure | `.kiro/steering/structure.md` | Folder layout and the journal and methodology rules. | `src/engine/` stayed free of DOM, network and clock, so it is testable. |
| Hook: Census on raw data created | `.kiro/hooks/census-on-raw-data.json`, trigger `PostFileCreate`, matcher `data/raw/` | Runs `npm run census`, which rebuilds `data/register.json` and the README census block. | Meant to keep the census in step with new data. Not seen to run: the data files were written by shell commands, which this hook does not watch. |
| Hook: Census on raw data changed | same file, trigger `PostFileSave`, matcher `data/raw/` | The same command on a save. | As above. |
| Hook: Engine tests on save | `.kiro/hooks/engine-tests-on-save.json`, trigger `PostFileSave`, matcher `src/engine/` | Runs the engine test files, including the property tests. | Not seen: the journal records no agent file-tool save under `src/engine/` after the hooks were enabled. |
| Hook: Language check on save | `.kiro/hooks/language-check-on-save.json`, trigger `PostFileSave`, matcher `src/ui/`, `data/cases/`, `docs/` or `README.md` | Runs `scripts/check-language.ts`. | Seen firing: the chat UI showed "Run Command Hook — Language check on save" after each agent file-tool edit of `docs/methodology.md`, and Kiro's log has two `ContextualHookInvoked` entries (23:55:39 and 23:55:41). The agent never sees the output. Observed 2026-11-27: no hook output in the tool result of any file-tool save in this session, from the sub-agent and from the main agent. The orbital-coroner sub-agent wrote 18 files in `data/cases/`. The main agent then wrote `docs/source-review.md`, edited `data/cases/41308.md` (a real fix), edited `docs/kiro-usage.md`, wrote the 19 notes of batch 3 in `data/cases/`, and added then removed a trailing space in `docs/methodology.md` (the edit that showed the hook on 2026-11-23). All of these paths match this hook, and none of the tool results showed hook output. The hook file has `"enabled": true`. Kiro's log (`~/Library/Application Support/Kiro/logs/20261119T090607/window2/exthost/kiro.kiroAgent/Kiro Logs.log`) has one `ContextualHookInvoked` entry directly after each of the 19 saves in `data/cases/` (17:50:55 to 17:52:36) and after both saves of `docs/methodology.md` (17:58:29 and 17:58:33). The log entry carries no hook name, command or output. No cause is stated. Whether the chat UI showed the "Run Command Hook — Language check on save" line is for the owner to read from the UI. |
| Custom agent | `.kiro/agents/orbital-coroner.md` | Writes and reviews case files in `data/cases/`. It may use only computed fields from `data/register.json` and opened sources, must cite every number, and may only write `data/cases/*.md`. | Wrote the three case files. Its review of `data/cases/40258.md` raised one flag (`provisional: false`), which led to a note in `docs/spike.md`. It was missing from the sub-agent list until the session was restarted. |
| MCP server | `scripts/mcp/server.ts`, `scripts/mcp/tools.ts`, config in `.kiro/settings/mcp.json` | A stdio server with four read-only tools: `is_buried`, `census`, `explain`, `list`. | In Kiro chat, `explain(27378)` and `census()` answered from the register (replies are in the journal, section MCP). Every reply carries the assumptions, the data age, and the voluntary-guidelines and blind-spot lines. |
| Kiro CLI in CI | `.github/workflows/kiro-verify.yml` | Manual workflow. Kiro CLI runs headless to run `npm test` and `npm run census`. Plain steps then run the tests and `git diff --exit-code` on `README.md` and `data/register.json`, so any difference fails the run. | **Run once:** run 45353477849 on 2026-11-24 passed (56 s): Kiro reported 771 tests in 22 files passing and no change to README.md or data/register.json, and the plain steps agreed. It needs the repository secret `KIRO_API_KEY`. The pass or fail decision does not depend on what the model says. |
| Skill | `.kiro/skills/frontend-design/SKILL.md`, `.kiro/skills/frontend-design/LICENSE.txt` | Anthropic's frontend-design skill, copied unchanged from https://github.com/anthropics/skills/tree/main/skills/frontend-design (Apache-2.0). Guides the visual redesign: a design plan before code, a review of that plan against the brief, a self-critique with screenshots. | Added 2026-11-24 for the redesign. See the journal for how it changed the work. |
| Journal | `docs/kiro-journal.md` | One dated line per task, the hook tests and what surprised us. | The hook entry was wrong for two days, then corrected from the chat UI and the log. |

## Property tests

The suite uses fast-check. `fc.assert` appears 47 times in 11 test files. The seven invariants the project cares most about, and where each is tested:

| Invariant | Test file and name |
| --- | --- |
| Perigee ≤ apogee | `test/orbit.test.ts`: "property: perigee ≤ apogee" (mean motion path) and "property: perigee ≤ apogee and e in [0, 1)" (SATCAT altitude path) |
| Threshold is monotone in C_R·A/m | `test/classify.test.ts`: "property: never decreases as x grows" |
| Verdict is monotone in perigee | `test/classify.test.ts`: two "monotone … raising p never worsens the verdict" properties, one for e ≤ 0.003 and one for e > 0.003 |
| e > 0.003 is never "buried" | `test/classify.test.ts`: "never buried when e > 0.003" |
| JSON and CSV give the same classification | `test/invariants.test.ts`: three tests. The engine has no JSON data parser (the sources are CSV, and the register is the JSON form), so the invariant is tested as: every committed verdict in `data/register.json` is reproduced by `classify` from its own JSON record (696 of 696); a JSON round trip of a record never changes its classification; a GP CSV row classifies like the same mean motion and eccentricity given directly. |
| Input order does not change the result | `test/merge.test.ts`: "property: shuffling every input array gives deep-equal output". `test/engine.test.ts`: "property: shuffling the data lines of each file gives the same records". `test/invariants.test.ts`: the same for SATCAT and GP rows, comparing records and census. `test/headline.test.ts`: the post-rule summary. |
| Mean motion to semi-major axis round-trips | `test/invariants.test.ts`: "property: a → mean motion (rev/day) → a, to 1e-9 relative". It was missing before polish step 5. |

All 47 `fc.assert` calls:

| Test file | What the property says |
| --- | --- |
| `test/classify.test.ts` (6) | Threshold never decreases as C_R·A/m grows; verdict never worsens as perigee rises (two eccentricity ranges); fallen exactly when apogee < −200 km; never buried when e > 0.003; borderline exactly when within 25 km of an edge. |
| `test/orbit.test.ts` (2) | Perigee ≤ apogee for any mean motion and e; perigee ≤ apogee and e in [0, 1) for any SATCAT altitudes. |
| `test/merge.test.ts` (3) | SATCAT status is never overridden unless it is "unknown payload"; a GP row always wins over SATCAT for the same NORAD id; shuffling every input gives equal output. |
| `test/engine.test.ts` (6) | Every grouping sums to its population; retired total equals the retired count by type; no input of arbitrary strings or valid headers with arbitrary rows throws; any snapshot date is accepted; shuffling file lines gives the same records. |
| `test/parsers.test.ts` (7) | The SATCAT, GP, GPZ-table and CSV parsers return their rejection list for any text, with and without a valid header, and never throw. |
| `test/state.test.ts` (7) | State, hash and router round-trip; bad values never throw; a filter never adds objects; the chart is the table minus rows the chart does not draw; views agree when filters come back from an address; every sort key gives a permutation. |
| `test/ui.test.ts` (8) | The router never throws on any address; a shown value is on the same side of every band edge as the true value; stone height falls as perigee rises; sway grows with eccentricity; no two stones share a position; keyboard moves land on a stone. |
| `test/census-page.test.ts` (1) | Every share text starts "n of N" with n ≤ N. |
| `test/headline.test.ts` (2) | The post-rule parts add up and ignore record order; lower ≤ central ≤ upper ≤ n for the validation band. |
| `test/invariants.test.ts` (4) | Round-trip, input order and the JSON and CSV checks above. |
| `test/churchyard-polish.test.ts` (1) | Every tooltip carries the NORAD id and "±25 km" and escapes the name. |

Did a property test ever find a real bug? None is recorded in `docs/kiro-journal.md` or in the git history. No counterexample is written up, and none was found while this page was written. The journal does record seven deliberate breaks of the merge rule that the merge tests each caught (Task 20); those were injected, not found.

## Kiro CLI in CI

The workflow is `.github/workflows/kiro-verify.yml`. To use it, add a Kiro API key as the repository secret `KIRO_API_KEY` (Settings, Secrets and variables, Actions), then start the workflow by hand from the Actions tab. The headless flags come from the Kiro docs (https://kiro.dev/docs/cli/headless/): `kiro-cli chat --v3 --no-interactive --trust-tools=read_file,execute_bash`. The installer line (`curl -fsSL https://cli.kiro.dev/install | bash`) is the one the docs show and is not pinned to a version. It was run once from this repository (run 45353477849, 2026-11-24, success).
