---
inclusion: always
---

# Design

This is the costume. The Costume Contest category is judged on the interface.

## Mood

A quiet Victorian churchyard at night. Not a cartoon. Restraint over gimmicks.

## Palette

- Near-black blue-grey ground, bone-white text, moss green, and one lantern amber.
- Lantern amber is only for focus and selection.
- Define every colour as a CSS custom property. No hard-coded colours elsewhere.
- Every text and background pair meets WCAG AA. Check contrast when choosing or changing a colour.

## Type

- One serif display face for headings and headstones. Self-hosted, open licence. Record the licence in docs/methodology.md or a credits file.
- One plain sans for body text and tables.

## Every spooky element carries data

| Element | Data |
| --- | --- |
| Headstone height | Perigee above GEO |
| Moss | Years since launch |
| Sway | Eccentricity above 0.003 |
| The road, shallow ground, the churchyard wall, consecrated ground | The protected zone, below the threshold, the IADC threshold band, above the threshold |
| A headstone lying flat below the road | Fallen: the whole orbit is below the protected zone |

Moss shows years since launch, not data age. SATCAT gives no element date for most graveyard objects, so data age is shown as text next to each object (the GP epoch, or "SATCAT, element date not given"). Moss must never suggest a retirement date.

If a decoration carries no data, leave it out.

## Motion

- Slow and subtle.
- All motion is off under `prefers-reduced-motion`. The data must still be readable without motion.

## Copy

- Use the churchyard words: fallen, unquiet, shallow grave, uncertain, buried, restless, unmarked bones.
- Always pair each one, once, with its plain technical meaning. Example: "Shallow grave (perigee below the IADC threshold)".
- Follow language.md.
