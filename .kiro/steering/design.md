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
| Headstone height | Perigee |
| Moss | Data age |
| Sway | Eccentricity |
| Road, shallow ground, consecrated ground bands | The zone and the threshold |

If a decoration carries no data, leave it out.

## Motion

- Slow and subtle.
- All motion is off under `prefers-reduced-motion`. The data must still be readable without motion.

## Copy

- Use the churchyard words: unquiet, shallow grave, buried, restless, uncertain.
- Always pair each one, once, with its plain technical meaning. Example: "Shallow grave (perigee below the IADC threshold)".
- Follow language.md.
