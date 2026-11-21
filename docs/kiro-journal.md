2026-11-20: Created the steering files (product, tech, design, language, structure) in .kiro/steering/. No code yet.
2026-11-20: Day-1 data spike (partial). snapshot.ts resumes per data set and counts partial bodies as downloads; GPZ-PLUS dropped as a source; docs/spike.md says CONDITIONAL GO, pending SATCAT; tech.md makes SATCAT the main source.
2026-11-20: Wrote the sexton-core spec (requirements, design, tasks) in .kiro/specs/sexton-core/; FCC rule scope and moss meaning updated in steering.
2026-11-20: Task 1 done. Vite, TypeScript, Vitest, fast-check and marked scaffold; npm test runs tsc --noEmit then vitest run; smoke test imports src/engine/config.ts.
2026-11-21: Task 2 done. config.ts with derived thresholds (247, 280), types.ts, orbit.ts; tests for thresholds, perigee ≤ apogee and the GPZ golden check (863 objects within 1 km of the table).
2026-11-21: Task 3 done. csv, satcat, gp and gpz-table parsers with row rejections and no-orbit-data counting; snapshot fixtures (36 SATCAT rows, 7 GPZ objects) with real sha256 values; 63 tests pass.
