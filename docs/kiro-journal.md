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
