---
inclusion: always
---

# Design

This is the costume. The Costume Contest category is judged on the interface.

## Mood

A Victorian churchyard at night, seen through a modern instrument. Cinematic and atmospheric, never a cartoon. The page should feel designed, not typed.

## Palette

- Near-black blue-grey ground, bone-white text, moss green, and one lantern amber.
- Lantern amber (`--lantern`, oklch(0.80 0.13 70)) marks focus and selection, and lights the story stones: unquiet and shallow-grave verdicts launched on or after 18 March 2002. It is never used for text.
- Define every colour as a CSS custom property, in OKLCH. No hard-coded colours elsewhere.
- The ground is a near-black blue, never #000, with three surfaces that get lighter as they rise. Text is bone at three levels: primary 7:1 or better, secondary and muted 4.5:1 or better on every surface.
- One story colour: lantern, with a soft halo and a slow flicker (opacity 0.85 to 1, 3 to 6 s, staggered), for the story stones only. Post-rule stones that are not the story are muted bone at 60%. Stones launched before the rule date are moss at 43% (the least that keeps 3:1 against the ground). Story stones draw in lantern alone (outline, halo, any fill), with no moss; their years since launch are on the card. A selected stone turns bone, thick, still, with the lantern box. Error bars on non-story stones are quiet (about 25% effective).
- Verdict marks differ by shape and fill: buried solid pale, shallow grave half filled, restless lightly filled, uncertain hatched, unquiet an open outline, fallen tipped and dim. The legend, the badges and the census key draw the same marks.
- Atmosphere tokens (OKLCH): `--lantern-halo` (halo behind a story stone), `--fog-light` (two fog layers on the road, 40 s and 90 s drifts, at most 0.12 opacity, static under reduced motion), `--bone-fill-50/30/22` (the census key's fills), `--lantern-fill` (lantern at 16%, behind a pressed Unquiet or Shallow grave filter chip). The moon is one static glow near the top right of the high ground.
- Every text and background pair meets WCAG AA. Check contrast when choosing or changing a colour.

## Type

- Display: IM Fell English (headings, headstone names). Body: IBM Plex Sans. Readings and labels: IBM Plex Mono with tabular figures for every number, unit, date and NORAD id. All self-hosted, OFL, recorded in THIRD_PARTY.md.

## Every spooky element carries data

| Element | Data |
| --- | --- |
| Headstone height | Perigee above GEO |
| Moss | Years since launch |
| Sway | Eccentricity above 0.003 |
| The road, shallow ground, the churchyard wall, consecrated ground | The protected zone, below the threshold, the IADC threshold band, above the threshold |
| A headstone lying flat below the road | Fallen: the whole orbit is below the protected zone |

Moss shows years since launch, not data age. SATCAT gives no element date for most graveyard objects, so data age is shown as text next to each object (the GP epoch, or "SATCAT, element date not given"). Moss must never suggest a retirement date.

Inside the chart, every mark carries data; if a mark carries no data, leave it out. Around the chart, atmosphere is allowed and wanted: moonlit gradient ground, depth, soft fog or grain, glow on focus, cards and panels. Atmosphere must never look like data and never reduce contrast below WCAG AA.

## Chart labels
- Zone names (high ground, consecrated ground, the wall, shallow ground, the road, below the zone) sit inside their bands at the plot's left edge, small and muted. Tick numbers stay in the gutter, thinned where the scale compresses. No label overlaps another label or covers a stone. The chart carries no SVG `<title>`, so the browser shows no native tooltip.

## Layout
- The picture first, words second. Every view opens with its main visual or its key numbers above the fold at 1440×900 and 390×844.
- Use the full width on desktop. No single narrow text column with empty space beside it.
- Long explanations go in collapsible panels or side notes, not in the opening.
- Verdicts show as badges: the churchyard word large, with its plain meaning under it, smaller. This still pairs each word with its meaning once.
## Filter toolbar
- One toolbar for the churchyard and the table: a search field (icon, clear button), Owner and Launch era as styled native selects, six verdict toggle chips (the chart's glyph, the word, a live count for the other filters; `aria-pressed`), "Show unmarked bones" as a switch (`role="switch"`), and a line of removable pills with "Clear all" and "Showing N of M" (hidden with no filter).
- Pressed chips are filled with a 2 px border. Only a pressed Unquiet or Shallow grave chip takes lantern (border, glyph, `--lantern-fill`); its words stay bone.
- Churchyard: the options open in a panel that floats over the chart, so the plot top stays under 420 px. Table: always in the row from 901 px. Phone: a bottom sheet with a Done button. Escape closes the panel where it can close.

## Motion

- Slow and subtle.
- All motion is off under `prefers-reduced-motion`. The data must still be readable without motion.

## Copy

- Use the churchyard words: fallen, unquiet, shallow grave, uncertain, buried, restless, unmarked bones.
- Always pair each one, once, with its plain technical meaning. Example: "Shallow grave (perigee below the IADC threshold)".
- Pair each churchyard word with its plain meaning once per view, at its first appearance (a legend, a column-header note or a badge). Repeated uses, such as table cells and chips, show the word only.
- Follow language.md.
