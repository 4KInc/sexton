---
inclusion: always
---

# Language

Tone and honesty rules. A script and a hook will enforce them later, so keep the banned words easy to match.

## Never judge

- Never say a satellite or operator violated a rule, broke the law, acted illegally or unlawfully, was in breach, or was non-compliant.
- Say: "below the IADC disposal threshold under the stated assumptions".
- `scripts/check-language.ts` matches these stems, case-insensitive. Keep this list and the script's list the same:
  - `violat` (violated, violation, violates)
  - `illegal`
  - `non-compliant`, `noncompliant`, `non compliant`
  - `broke the law`
  - `breach`
  - `unlawful`
- The only place these words may appear is the "what we do not say" section of docs/methodology.md.

## Show assumptions

- Every verdict shows its assumptions: the C_R·A/m range and the ±25 km mean-element uncertainty.
- Every verdict shows the data age.

## Say what is voluntary

- The IADC guidelines are voluntary.
- The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002.
- Say both wherever they matter.

## Never imply a retirement date

We know only the launch date and the current orbit. We do not know when a satellite retired. Never state or imply a retirement date.

## Say what the register cannot see

The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing. Say so wherever totals or percentages appear.

## Plain English

- Short sentences.
- The first time they appear, explain in one line each:
  - GEO: the circular orbit about 35,786 km above the equator, where a satellite stays over one spot.
  - Perigee: the lowest point of an orbit.
  - Eccentricity: how far an orbit is from a perfect circle. 0 is a circle.
