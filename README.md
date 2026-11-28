# Sexton

**A public register of retired geostationary satellites, drawn as a churchyard: one stone per satellite, showing whether it was raised into the graveyard orbit.**

For debris researchers, journalists, regulators and anyone curious. 36 of the 131 retired payloads launched since the 2002 FCC rule are still in or near the protected zone around GEO, below the IADC disposal threshold under the stated assumptions.

**Live site:** https://4kinc.github.io/sexton/

GEO is the circular orbit about 35,786 km above the equator, where a satellite stays over one spot. When a satellite there retires, it should be raised into a disposal orbit above the belt. Nobody publishes a plain register of which retired satellites were raised. Sexton is that register, built only from public CelesTrak data. Each satellite gets one of six verdicts, with its assumptions and the age of its data beside it. The register only sees objects still near GEO.

Sexton is built for the Kiroween 2026 Costume Contest: the churchyard is the data model. A stone's height is its perigee above GEO. Moss marks stones launched before 18 March 2002, the FCC rule date. Lantern light marks the 36.

![The churchyard: one stone per retired satellite, taller for a higher perigee](docs/images/churchyard.png)

## The headline number

CelesTrak snapshot, 22 Nov 2026. 131 of the 696 retired payloads in the register were launched on or after 18 March 2002, the date of the FCC minimum-perigee rule. 36 of those 131 (27.5%) sit in or near the protected zone: their perigee is below the IADC disposal threshold under the stated assumptions (C_R·A/m from 0.012 to 0.045 m²/kg, mean elements ±25 km). 565 of 696 retired payloads predate any guideline. That is context, not a failure.

<!-- causes:start -->
Of the 36, 10 failed in orbit or broke up before they could be moved. 1 was raised by its operator, as the operator reports, and reads inside the zone in the 22 Nov 2026 snapshot. The 36 are the retired payloads launched on or after 18 March 2002 whose verdict is unquiet or shallow grave. Each case file gives its cause, quoted from a source that was opened, or the words "No cause in the sources opened".
<!-- causes:end -->
The IADC guidelines are voluntary. The FCC rule (47 CFR § 25.283) applies only to satellites the FCC authorizes. The register only sees objects still near GEO.

## Built with

- Vite and TypeScript (strict), no UI framework. The churchyard is hand-built SVG. Static site on GitHub Pages: no backend, no accounts, no analytics.
- [AG Grid Community](https://www.ag-grid.com/) 36.3.0 (MIT) for the desktop table. It loads only when `#/table` opens wider than 600 px. Phones, print and a failed load get the plain HTML table.
- [marked](https://marked.js.org/) (MIT) renders the method page and the case files.
- Fonts: IM FELL English, IBM Plex Sans and IBM Plex Mono, self-hosted, SIL Open Font License 1.1.
- Tests: Vitest and fast-check. `npm test` runs 1107 tests in 49 files, then the language check.

Every package and its licence is in [THIRD_PARTY.md](THIRD_PARTY.md).

## Built with Kiro

A spec of 25 tasks, five steering files, four hooks, a custom agent that writes the case files, an MCP server with four tools, and a Kiro CLI workflow in CI. One table maps each to its file: [docs/kiro-usage.md](docs/kiro-usage.md). Details are further down.

## Census
<!-- census:start -->
Counts from the snapshot of 2026-11-22. Run `npm run census` to refresh them.

- Objects near GEO in the register: 1764
- Retired payloads with a verdict: 696
  - fallen: 3
  - unquiet: 312
  - shallow grave: 30
  - restless: 21
  - uncertain: 50
  - buried: 280
- Retired payloads close to a threshold (borderline): 141
- Objects where SATCAT and the GPZ table disagree on status: 48
  - of these, SATCAT lists a payload but gives no status, so the GPZ table's status is used: 48

Verdicts assume a C_R·A/m range of 0.012 to 0.045 m²/kg and a ±25 km uncertainty in mean elements. The IADC guidelines are voluntary. The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.
<!-- census:end -->

## The six verdicts

Perigee is the lowest point of an orbit. Eccentricity is how far an orbit is from a perfect circle. 0 is a circle.

| Verdict | Plain meaning |
| --- | --- |
| Fallen | The whole orbit is below the protected zone: apogee more than 200 km under GEO. |
| Unquiet | The orbit reaches the protected zone: perigee at most 200 km above GEO. |
| Shallow grave | Perigee is below the IADC threshold. |
| Restless | Perigee is high enough, but eccentricity is above 0.003. |
| Uncertain | Perigee is inside the IADC threshold band, so the result depends on the unknown C_R·A/m. |
| Buried | Perigee is above the IADC threshold for every assumed C_R·A/m, and eccentricity is at most 0.003. |

The IADC threshold is 235 km + 1000·C_R·A/m above GEO, which is 247 to 280 km for the assumed C_R·A/m range. Every formula and source is in [docs/methodology.md](docs/methodology.md).

## How it was built with Kiro

**Spec.** The work followed a written spec in [.kiro/specs/sexton-core/](.kiro/specs/sexton-core/): [requirements](.kiro/specs/sexton-core/requirements.md), a [design](.kiro/specs/sexton-core/design.md) and a numbered [task list](.kiro/specs/sexton-core/tasks.md). Each task was ticked only after `npm test` and `npm run build` passed. [docs/kiro-journal.md](docs/kiro-journal.md) has one dated line per task, including what did not work.

**Steering.** Five steering files in [.kiro/steering/](.kiro/steering/) set the product, the tech stack, the design, the folder layout and the language rules. [language.md](.kiro/steering/language.md) bans judging words, requires assumptions and data age with every verdict, and forbids any retirement date. `scripts/check-language.ts` enforces it.

**Hooks.** Four hooks in three files in [.kiro/hooks/](.kiro/hooks/) run on the agent's own file edits: the engine tests on `src/engine/`, the census on `data/raw/` (on create and on save), and the language check on `src/ui/`, `data/cases/`, `docs/` and this README. The agent does not see their output, so the journal records what the chat UI showed.

**The orbital-coroner agent.** [.kiro/agents/orbital-coroner.md](.kiro/agents/orbital-coroner.md) is a custom agent that writes and reviews the case files in `data/cases/`. It may use only computed fields from `data/register.json` and opened sources, it must cite every number, and it never states a retirement date.

**The MCP server.** [scripts/mcp/server.ts](scripts/mcp/server.ts) lets an AI assistant ask the register for a verdict, a census, a list or a full ledger. See "Use it from an AI assistant" below.

**Kiro in CI.** [.github/workflows/kiro-verify.yml](.github/workflows/kiro-verify.yml) is started by hand. It installs Kiro CLI, runs it headless to run the tests and rebuild the census, then runs `npm test` and `git diff --exit-code` on `README.md` and `data/register.json` itself, so any difference fails the run. It needs a repository secret named `KIRO_API_KEY` (Settings, Secrets and variables, Actions). It has been run once: run 45353477849 on 2026-11-24 passed (56 s): Kiro reported the 771 tests in 22 files that existed then passing and no change to README.md or data/register.json, and the plain steps agreed. More in [docs/kiro-usage.md](docs/kiro-usage.md), which maps every Kiro feature to its file and lists every property test.

## Limits

- The IADC guidelines are voluntary.
- The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002. The register cannot tell which satellites the FCC authorized.
- Every verdict assumes a C_R·A/m range of 0.012 to 0.045 m²/kg and a ±25 km uncertainty in mean elements. The true C_R·A/m of each satellite is not known.
- Data has an age. GP mean elements carry an epoch. SATCAT gives whole-kilometre altitudes and no element date for most graveyard objects, and the site says so beside each object.
- The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing. Totals and shares are for the objects it sees.
- We know each launch date and current orbit. We do not know when a satellite retired. Moss on a stone is years since launch, not a retirement date.
- Sexton makes no legal judgements. It reports an orbit against the IADC threshold under the stated assumptions. It does not predict collisions or propagate orbits.

## Run, test, build

Needs Node 24.

```
npm install
npm run dev          # local site
npm test             # type check, 1107 Vitest and fast-check tests in 49 files, then the language check
npm run build        # static site in dist/
npm run census       # rebuild data/register.json and the census block above
npm run test:e2e     # browser checks (see below); needs `npx playwright install` once, and takes about a minute
```

The site is static and never calls CelesTrak. It is deployed to GitHub Pages by [deploy.yml](.github/workflows/deploy.yml) after tests and build pass.

## Browser checks
`npm run test:e2e` builds the site, serves it under its `/sexton/` base and opens it in Chromium, Firefox and WebKit with Playwright. It visits every route (the churchyard, the table, two ledgers, the census, the method page, and the parish list, one operator and one owner code) at 1440×900, 1024×768 and 390×844. It runs axe-core with the WCAG 2.2 A and AA tags and fails on any rule it reports, checks that the page does not scroll sideways at 390 px and that the chart or the key numbers are on the first screen, walks the keyboard path (skip link, one Tab stop in the chart, arrow keys, Enter, Escape), checks that nothing animates under `prefers-reduced-motion`, and fails on any request that is not the site's own file or `register.json`. It is not part of `npm test`. [e2e.yml](.github/workflows/e2e.yml) runs it, started by hand only.

What these checks do not cover:
- **Screen readers.** Axe finds only what a machine can test. It does not replace VoiceOver, NVDA or TalkBack.
- **A real phone.** A 390 px window is not a phone: touch, the on-screen keyboard and the browser's own bars are not tested.
- **Safari.** WebKit under Playwright is the WebKit engine, not the Safari app. On macOS WebKit leaves links out of the Tab order (as Safari does), so the keyboard test uses Option+Tab there.
- **WCAG conformance.** A passing run is not a claim of conformance. Many criteria need a person.
## Data refresh

The data is a committed snapshot in `data/raw/<date>/`, with a `manifest.json`. The [Refresh snapshot](.github/workflows/refresh-snapshot.yml) GitHub Action is started by hand. It runs `scripts/snapshot.ts`, which fetches SATCAT and the GPZ files from CelesTrak within its usage policy (at most one download per data set per 2 hours, gzip, no retries). Then it runs `scripts/build-register.ts` and opens a pull request with the new register. A person reviews and merges it. Nothing else fetches data.

## Credits

- Thomas González Roberts (Georgia Tech) published an academic audit of GEO disposal compliance: "Assessing Compliance with Post-mission Disposal Guidelines in Geosynchronous Orbit" (IAA Space Traffic Management Conference, March 2025). Sexton credits the idea; it does not reproduce that paper's method or figures, and the paper was not opened. Sexton's formulas come from the IADC and FCC texts in [docs/methodology.md](docs/methodology.md). Any error is Sexton's own.
- Orbit and catalogue data: [CelesTrak](https://celestrak.org) (SATCAT and GP data).
- Type: IM FELL English (Igino Marini) for display, IBM Plex Sans and IBM Plex Mono (IBM Corp.) for body and readings, all under the SIL Open Font License 1.1. See [docs/credits.md](docs/credits.md).


## Use it from an AI assistant

`scripts/mcp/server.ts` is a small [MCP](https://modelcontextprotocol.io) server. It talks over stdio, reads `data/register.json` and `data/cases/` only, and makes no network calls and no writes. It needs Node 24 and `npm install`.

It has five read-only tools:

- `is_buried(norad)`: the verdict word, the borderline flag, p and q, the margins and the data age. "Buried" is one of six verdicts, so the answer is never a bare yes or no.
- `census()`: verdict counts as "n of N", the borderline count, and where orbits and statuses come from.
- `explain(norad)`: the ledger text, with assumptions and data age, and the case file if there is one.
- `list(verdict, limit?)`: objects with one verdict, sorted by NORAD id, with the total.
- `parish(name, kind?)`: the retired payloads of one operator (named only where a source that was opened names one, for example Intelsat) or one SATCAT owner code, by verdict.

In Kiro, put this in `.kiro/settings/mcp.json`. Other MCP clients use the same `command` and `args`. `autoApprove` lists tool names, and these only read. The list below has the first four; add `parish` to it if you want that one approved too.

```json
{
  "mcpServers": {
    "sexton": {
      "command": "node",
      "args": ["scripts/mcp/server.ts"],
      "disabled": false,
      "autoApprove": ["is_buried", "census", "explain", "list"]
    }
  }
}
```

The replies carry the same assumptions as the site: a C_R·A/m range and a ±25 km mean-element uncertainty. The IADC guidelines are voluntary. The register only sees objects still near GEO.

## Install the Sexton power
`powers/sexton/` is a [Kiro power](https://kiro.dev/docs/powers/create/): a `plugin.json`, a skill and an `mcp.json`, in the Agent Plugins format. It gives Kiro the five tools above and a skill that tells the agent how to answer: always a verdict word with its assumptions and data age, never a bare yes or no, no words that judge, no retirement dates, and a reminder that the register only sees objects near GEO.
1. Clone this repository. You need Node 24 on your path, because the power starts `node`.
2. In Kiro, open the Powers panel, choose **Add Custom Power**, then **Import power from a folder**, and select `powers/sexton`.
3. Start a chat and ask, for example, "Is NORAD 27516 buried?" or "What is Intelsat's disposal record?". The power's keywords (geostationary, graveyard orbit, disposal record, NORAD and others) bring it in.

The power carries its own copy of the server (`server/sexton-mcp.mjs`, one file that runs under plain `node`) and of `data/register.json` and `data/cases/`, so it does not reach back into the repository. After a new snapshot or new case files, run `node scripts/build-power.ts`; a test fails while the copy is out of date. `mcp.json` uses `${PLUGIN_ROOT}` for every path, as the specification says clients must expand it. The format has no `autoApprove` field (an unknown field makes the server entry invalid), so the tool calls follow Kiro's default approval.
Not checked: how Kiro itself resolves those paths. A test starts the server from a copy of the power in another folder, with `${PLUGIN_ROOT}` expanded as the specification says, and gets answers. The install in Kiro is checked by hand and recorded in `docs/kiro-journal.md`.
