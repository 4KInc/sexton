# sexton
A public register of retired geostationary satellites: buried in the graveyard orbit, or still drifting in the GEO protected zone. Kiroween 2026.

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
