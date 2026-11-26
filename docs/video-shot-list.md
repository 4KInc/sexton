# Video shot list (draft, 2:45)

A storyboard for the owner to edit. Narration lines are prompts, not final text, and stay inside `.kiro/steering/language.md`: no judging words about a satellite or an operator, and no retirement dates. Every number on screen comes from the committed register (snapshot 2026-11-22) or a source cited in `docs/methodology.md`.

## Before recording

- Browser at 1440×900, clean profile, zoom 100%, dark system theme, motion not reduced (the lantern flicker and the fog need it). Live site: https://4kinc.github.io/sexton/
- Open `#/` once and press "Skip the tour", so the tour bar does not show in later takes (the site remembers the skip).
- Kiro IDE with this repository open, the `sexton` MCP server connected, and the hooks enabled (Hooks panel).
- Do not show a CI run that has not happened. The one real Kiro CLI run is 45353477849 (2026-11-24).
- Short clips, jump cuts between them. Paste text, never type it on camera. Record each shot separately and cut on the action.

## Shots

| Time | Shot | On screen | What to do | Caption (on-screen text) | Narration prompt |
| --- | --- | --- | --- | --- | --- |
| 0:00–0:12 | Cold open: the churchyard | `#/`, chart filling the frame: the road (protected zone) with its fog, the lantern stones to the right of the FCC line flickering. | No setup, no typing. Hold 5 s on the lantern stones and the fog, then a slow tilt up to the headline "36 of 131". | "Each stone: one retired geostationary satellite" → "36 of 131" | "Each stone is a retired geostationary satellite. Its height is its perigee, the lowest point of its orbit, above GEO. The lantern stones are the 36 launched since the 2002 FCC rule that are still in or near the protected zone." |
| 0:12–0:30 | Why it matters | FCC DA 23-888 (https://docs.fcc.gov/public/attachments/DA-23-888A1.txt), the 122 km and 300 km lines highlighted. | One cut in, one cut out. | "FCC DA 23-888: about 122 km above GEO, against 300 km planned · $150,000" | "In 2023 the FCC's first debris penalty found EchoStar-7 disposed of about 122 km above GEO, not the planned 300 km. Nobody publishes a plain register of which retired satellites were raised. Sexton is that register." |
| 0:30–0:50 | Filter toolbar | `#/` with the toolbar. | Click "Filters", press the "Unquiet 312" chip (it fills, lantern edge). The pill "Unquiet" and "Showing 312 of 1,764" appear; the chart keeps only unquiet stones. Close the panel. | "Unquiet: the orbit reaches the protected zone" | "One toolbar filters the churchyard and the table. The filters live in the address, so a view can be shared." |
| 0:50–1:10 | The table | `#/table` at 1440, default view (131 rows). | Click the "p, km" header once (perigee, lowest first), then once more. Hover a row with a lantern left border. | "Default view: the 131 launched since 18 Mar 2002" | "The same set as a table. Sorting by perigee puts the lowest orbits first. The lantern edge marks the same 36 rows." |
| 1:10–1:35 | One ledger: EchoStar 7 | `#/sat/27378`. | Cut in on the verdict badge, then three quick cuts: threshold maths, "Orbit source and data age", "Assumptions". End on "Cite this". | "EchoStar 7 · Unquiet · perigee +110.1 km · epoch 2026-11-22 12:28 UTC" | "Its ledger says Unquiet: perigee 110 km above GEO, below the IADC disposal threshold under the stated assumptions. The maths, the data age and the ±25 km uncertainty are on the page, with a stable link to cite." |
| 1:35–1:55 | Census validation | `#/census`, the "Validation against a published range" panel. | Hold on the bar: Sexton 27 of 45, band 24 to 29 of 45, ESA 70% to 95%. | "27 of 45 buried (60.0%) · band 24–29 of 45 · ESA: 70–95%" | "As a check, Sexton's share for payloads launched after 2007 is below ESA's published range. The method page says why, and the method was not tuned to match." |
| 1:55–2:30 | Kiro | Kiro IDE. Four tabs ready: `.kiro/specs/sexton-core/tasks.md`, `.kiro/steering/language.md`, a file under `docs/` for the hook, and the Kiro chat. | **Spec (1:55–2:03):** scroll `tasks.md` past the ticked tasks. **Steering (2:03–2:10):** `language.md`, the banned-stems list. **Hook (2:10–2:18):** ask Kiro to make a one-word edit to a `docs/` file; the chat shows the "Language check on save" hook running. **MCP (2:18–2:30):** paste "Is NORAD 27378 buried?" into the chat; `is_buried` answers "Verdict: Unquiet", "Buried is one of six verdicts", the data age and the assumptions. | "Spec · Steering · Hook · MCP server" | "A spec of 25 tasks. Steering that bans judging words, enforced by a hook and a test. And an MCP server, so an assistant can ask the register and get the verdict word, never a bare yes or no." |
| 2:30–2:37 | A little mischief | `#/nowhere` (any unknown address). | Hold on "No stone stands at this address." and its "Back to the churchyard" link; click it. | none | "Even the errors stay in character, and still say where to go next." |
| 2:37–2:45 | The honesty line, then the link | `#/method`, "Two rules, and who they bind", then the live URL full screen. | Two cuts. | "https://4kinc.github.io/sexton/" | "The IADC guidelines are voluntary. The FCC rule applies only to satellites the FCC authorizes. The register only sees objects still near GEO, and it never says when a satellite retired." |

Total: 2:45.

## Check on the day

- The hook shot needs the Kiro chat to show the hook line. It showed in the 2026-11-23 session (`docs/kiro-journal.md`). Do a dry run first.
- If the live site and the local build differ, say so on screen. The live site is built by the Pages workflow from `main`.
- There are no tooltip shots: the chart's hover tip is not part of this cut.
