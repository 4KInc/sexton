---
inclusion: always
---

# Structure

## Folders

- `src/engine/`: pure code. Parse, orbit maths, classify, census. No DOM, network or clock.
- `src/ui/`: SVG interface.
- `scripts/`: Node scripts, including `snapshot.ts`.
- `data/`: the committed snapshot.
- `test/`: Vitest and fast-check tests.
- `docs/`: project documents.

## Documents

- `docs/kiro-journal.md`: one dated line per task.
  - Run `date` first. Never guess the date.
- `docs/methodology.md`: every formula, assumption and source, with links.
  - Update it whenever a formula, constant or assumption changes.
