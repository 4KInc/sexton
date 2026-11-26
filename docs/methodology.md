# Methodology

This page lists every formula, constant, assumption and source behind Sexton, and what Sexton cannot see. It is shown on the site at `#/method`.

## At a glance

Three terms come up often: GEO (geostationary orbit, the circular orbit about 35,786 km above the equator where a satellite stays over one spot), perigee (the lowest point of an orbit), and eccentricity (how far an orbit is from a perfect circle, where 0 is a circle).

**What we measured.** For each retired payload in the register, the perigee above GEO, taken from CelesTrak's current orbit data and set against the IADC disposal threshold T = 235 + 1000 × C_R·A/m. C_R·A/m is not known for any one satellite, so Sexton uses the range 0.012 to 0.045 m²/kg. The result is a verdict about an orbit, under those assumptions. It is never a verdict about an owner.

**Known limits.** The IADC guidelines are voluntary. The FCC rule covers only satellites the FCC authorizes, launched on or after 18 March 2002. Orbit data are good to about ±25 km, and many verdicts rest on SATCAT whole-kilometre altitudes. Sexton has no retirement dates. The register only sees objects still near GEO, so every share is a share of what it sees.

**What would change a verdict.** A perigee that moves more than 25 km across a band edge. A satellite whose true C_R·A/m lies in the range but on the other side of its threshold, which is the "uncertain" verdict. An eccentricity above 0.003. Newer orbit data. A different status in SATCAT or the GPZ table.

## What Sexton does

Sexton takes the public catalogue of objects near GEO, picks out the payloads that the catalogue lists as not operational, and places each one against the IADC disposal threshold. The result for each satellite is a verdict "under the stated assumptions". It is not a legal finding.

Each verdict shows its assumptions and its data age. The assumptions are a C_R·A/m range of 0.012 to 0.045 m²/kg and a mean-element uncertainty of ±25 km.

## Two rules, and who they bind

**The IADC guidelines are voluntary.** The IADC (Inter-Agency Space Debris Coordination Committee) Space Debris Mitigation Guidelines say in their Application section that organisations are "encouraged to use these Guidelines". They do not bind anyone.

**The FCC minimum-perigee rule has a narrow reach.** 47 CFR § 25.283 is the FCC's end-of-life rule.

- Paragraph (a) covers "a space station authorized to operate in the geostationary satellite orbit under this part", so it covers only satellites the FCC authorizes. It also begins "Unless otherwise explicitly specified in an authorization".
- Paragraph (d) says the minimum perigee "shall not apply to space stations launched prior to March 18, 2002". So it applies to launches from 18 March 2002.
- The paragraph (a) minimum perigee is 36,021 km + 1000·C_R·A/m, in altitude above the Earth's surface. Taking 35,786 km as GEO, that is 235 km + 1000·C_R·A/m above GEO, the same as the IADC formula.

Sexton cannot tell which satellites the FCC authorized. Many satellites in the register were not. The "launched before 18 March 2002" badge therefore says only that the rule's launch-date test is not met. It does not say that no rules applied. Licence conditions can still apply.

The FCC's first debris penalty shows the difference. Order DA 23-888 (2 October 2023) rests on the disposal plan in DISH's licence. It records a disposal of EchoStar-7 at 122 km above GEO against 300 km in that plan, and a civil penalty of $150,000. It cites the licence terms and section 25.102 of the FCC's rules, not § 25.283.

## Formulas

All distances are in km, mass in kg, and A/m in m²/kg. Values come from one config object (`src/engine/config.ts`), and the register carries the config it was built with.

### Constants

| Name | Value | Note |
| --- | --- | --- |
| Earth radius, R_e | 6378.135 km | WGS-72 |
| Gravitational parameter, μ | 398600.8 km³/s² | WGS-72 |
| Seconds per day | 86,400 | |
| GEO altitude | 35,786 km | above the equatorial radius |

### Perigee and apogee from GP mean elements

The GP data give mean motion in revolutions per day, and eccentricity e.

```
n  = mean motion × 2π / 86,400        (rad/s)
a  = (μ / n²)^(1/3)                   (km)
hp = a(1 − e) − R_e                   (perigee altitude)
ha = a(1 + e) − R_e                   (apogee altitude)
p  = hp − 35,786                      (perigee above GEO)
q  = ha − 35,786                      (apogee above GEO)
```

Fields are kept at full precision. Rounding happens only when the page is drawn.

### Perigee, apogee and eccentricity from SATCAT altitudes

SATCAT gives apogee and perigee as altitudes in whole kilometres, and no eccentricity.

```
rp = PERIGEE + R_e
ra = APOGEE + R_e
a  = (ra + rp) / 2
e  = (ra − rp) / (ra + rp)
```

Then p and q follow as above.

### The IADC threshold

The IADC formula asks for a perigee at least T above GEO, with eccentricity at most 0.003:

```
T(x) = 235 + 1000 · x         x = C_R · A/m
```

C_R is the solar radiation pressure coefficient. A/m is the satellite's cross-section area divided by its dry mass. SATCAT gives neither, so Sexton assumes a range:

| Quantity | Assumed range |
| --- | --- |
| C_R | 1.2 to 1.5 |
| A/m | 0.01 to 0.03 m²/kg |
| C_R·A/m | 0.012 to 0.045 m²/kg |

The ranges are Sexton's assumptions. They are not measured for any satellite. The low end of C_R·A/m gives T = 247 km, and the high end gives T = 280 km. Between 247 and 280 km the result depends on the true value, which is unknown.

The IADC text gives 235 km as the sum of 200 km (the top of the GEO protected region) and 35 km for the drop an object can suffer from lunar, solar and gravity-field perturbations.

### Verdicts

The first matching row wins. Verdicts are given only to retired payloads (see the status mapping).

| # | Verdict | Condition | Plain meaning |
| --- | --- | --- | --- |
| 1 | Fallen | q < −200 | The whole orbit is below the protected zone. |
| 2 | Unquiet | p ≤ 200 | The orbit reaches the protected zone. |
| 3 | Shallow grave | 200 < p < 247 | Above the zone, but below the IADC threshold for every assumed C_R·A/m. |
| 4 | Restless | p ≥ 247 and e > 0.003 | High enough, but more eccentric than the IADC formula allows. |
| 5 | Uncertain | 247 ≤ p < 280 | Inside the threshold band, so the result depends on the unknown C_R·A/m. |
| 6 | Buried | p ≥ 280 | Above the IADC threshold for every assumed C_R·A/m, with e ≤ 0.003. |

The protected zone is GEO ± 200 km.

### Borderline

A verdict is borderline when the perigee is within 25 km of a band edge (200, 247 or 280 km above GEO). The 25 km is the mean-element uncertainty Sexton assumes. It is an assumption, not a measured error for each object.

### Years since launch

Whole years from the launch date to the snapshot date. It drives the moss on a stone. It is not a retirement age.

### Launch year

The churchyard puts each stone in the column of its launch year. The year comes from the launch date. Without one, it comes from the international designator (for example 2002-006A), but only if the designator looks like a year, a number and letters, and the year is from 1957 to the snapshot year. Otherwise the stone goes in the "Unknown" column.

## Sources of data

| Data | Source | Used for |
| --- | --- | --- |
| SATCAT (CSV) | CelesTrak | Which objects exist near GEO, and their type, status, owner, launch date, apogee and perigee. The only source that reaches the graveyard orbit. |
| GPZ OMM (CSV) | CelesTrak | Precise GP mean elements for objects inside the GEO protected zone. |
| GPZ status table | CelesTrak | The PAY+, PAY-, R/B and DEB status of each GPZ object. It comes as HTML, although the request asks for CSV. |

GPZ (GEO Protected Zone) holds objects with both perigee and apogee within ±200 km of GEO. CelesTrak also offers GPZ-PLUS, which adds objects that cross the band. Sexton does not use it: no object in it, in the first snapshot, had a perigee above +200 km, so it does not reach the graveyard.

Objects are joined by NORAD catalogue number. The site never calls CelesTrak. A script saves a snapshot, and the register is built from the saved files.

Where both exist, GP wins for the orbit, because it is more precise. SATCAT is used for the orbit only when GP has none.

## The near-GEO filter

SATCAT lists about 69,000 objects, so Sexton needs a rule for which are near GEO. An object is in the register when:

- its decay date is empty,
- its orbit centre is `EA` (Earth), and
- its apogee and perigee are both within 2,000 km of GEO (altitudes from 33,786 to 37,786 km).

Every object in the GPZ file is also included, whatever SATCAT says.

**Why ±2,000 km.** In the 2026-11-22 snapshot the window caught 648 not-operational payloads. Widening it to ±3,000 km adds about 5% more, and each step after that adds about 1%. The extra payloads are mostly in other regimes: drifting thousands of kilometres below GEO, or on eccentric orbits. The window already holds everything from the protected zone up to +1,739 km.

**The blind spot.** The register sees only objects still near GEO. Satellites sent much higher, satellites that left GEO, and satellites drifting well below it may be missing. In the 2026-11-22 spike, a ±10,000 km window would have added 45 retired payloads to the 648. Any total or share on this site is therefore not directly comparable with figures that count every GEO retirement.

**One object is added by the GPZ rule.** MEV-2 (46113) fails the orbit-centre test because SATCAT gives the NORAD id of the satellite it is docked to instead of `EA`. It is in the register because it is in the GPZ file.

## SATCAT whole-kilometre altitudes against GP mean elements

SATCAT altitudes are whole kilometres. GP perigee and apogee are computed to a fraction of a kilometre. Rounding alone causes at most 0.5 km of error in an altitude.

For the 868 GPZ objects that are in both (2026-11-22 snapshot):

- The median difference in perigee is 0.29 km, and the 95th percentile is 1.12 km.
- 863 objects differ by under 5 km. The other five are operational payloads, whose SATCAT and GP values come from different times. SATCAT was about 21 hours older, so a manoeuvre is the likely cause. This was not checked.
- For the 191 retired payloads in both, the largest difference is 0.85 km, and none is over 1 km.

The ±25 km band is 50 times the 0.5 km rounding error. But everything above +200 km comes from SATCAT alone, because GP data cover only orbits inside the protected zone. The check above could be run only on orbits inside the zone. That it carries over to the graveyard is an assumption. The census page shows how many verdicts rest on SATCAT altitudes.

### Eccentricity from rounded altitudes

Eccentricity from SATCAT is computed from altitudes rounded to 1 km. The error is at most 1.2e-5, which is 0.4% of the 0.003 limit. The median difference from GP eccentricity was 0.0000047.

Most objects are far from the limit. But in the 2026-11-22 spike, 25 retired payloads that rest on SATCAT alone had an eccentricity within 0.0005 of 0.003. The closest, GORIZONT 28 at 0.00302, was about 2e-5 from the limit, which is more than the rounding error. For objects within 0.0005 of the limit, the ledger adds a note that the Restless result depends on the whole-km rounding.

## The status mapping

Only retired payloads get a verdict.

**From SATCAT.** The type is OBJECT_TYPE: `PAY` (payload), `R/B` (rocket body), `DEB` (debris). Anything else is unknown. A payload is split by OPS_STATUS_CODE:

| Code | Meaning | Sexton |
| --- | --- | --- |
| `-` | Non-operational | Retired payload |
| `+`, `P`, `B`, `S`, `X` | Operational, partly operational, backup, spare, extended mission | Living payload |
| blank, `?` or anything else | Unknown | Unknown payload |

Rocket bodies and debris get no verdict. They are "unmarked bones" and are shown only when switched on.

**From the GPZ table.** `PAY-` is a retired payload, `PAY+` a living payload, `R/B` a rocket body, and `DEB` debris.

**Which one decides.** SATCAT decides, with one exception. In the 2026-11-22 snapshot, 48 payloads were in SATCAT with a blank status, while the GPZ table listed them as `PAY-` (not operational). They were launched between 1973-03-06 and 1997-11-12. For these, Sexton uses the table's status, marks the status source as "GPZ table", and keeps a record of the disagreement. The ledger says so. Without this rule, those 48 would have no verdict, and the count of retired payloads would be 648 instead of 696. The table is also the source when SATCAT has no row for an object.

A real SATCAT status is never overridden. No operational payload in SATCAT was listed as not operational by the table, or the other way round.

## What the register cannot see

- **Objects that are not near GEO.** See the near-GEO filter above.
- **Retirement dates.** SATCAT gives a launch date, and GP gives the current orbit. Nothing in either says when a satellite stopped working or when it was moved. Sexton never states or implies a retirement date. Moss on a stone shows years since launch only.
- **A satellite's real C_R·A/m.** Sexton assumes a range, so some verdicts are "uncertain".
- **Manoeuvres since the data date.** Each object shows its data age: the GP epoch, or "SATCAT, element date not given". SATCAT gives no element date for most graveyard objects.
- **What a satellite's operator planned.** Some licences set a different disposal height. Sexton checks only the IADC formula.
- **Who authorized a satellite.** See the FCC scope above.
- **The next 100 years.** Sexton does not propagate orbits.

## How the churchyard draws the data

- **Height** is perigee above GEO. The scale is linear from −300 to +400 km. Above +400 km it is compressed up to +1,000 km, and a zigzag marks the break. The same height on the high ground means a larger distance than below the break. Objects beyond either end are counted at the edge. Their exact values are on the card and in the ledger.
- **Columns** are launch years. Busy years get wider columns, so the spacing between years is not to scale.
- **Moss** is years since launch, in four steps: under 10, 10 to 19, 20 to 29 and 30 or more. Lantern stones carry no moss, so they draw in lantern alone. Their years are on the card.
- **Sway** marks eccentricity above 0.003.
- **Dotted bar** marks a borderline verdict.

## The group launched on or after 18 March 2002
The census opens with the retired payloads launched on or after 18 March 2002. That is the date from which 47 CFR § 25.283 can apply, and it is the date Sexton uses for "before FCC rule" (`fccRuleDate`). Earlier launches are shown as context: "565 of 696 retired payloads predate any guideline", counted at snapshot 2026-11-22. That is not a failure. Nobody asked those satellites to meet a rule that did not exist when they launched.
Inside the group, "in or near the protected zone" means the verdicts unquiet (perigee at most 200 km above GEO) and shallow grave (perigee above 200 km and below the IADC threshold). All six verdicts are listed, so nothing is hidden. The group is a launch-date split of the same verdicts. It changes no verdict.
The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing, so every share is a share of what the register sees.
## Validation against published figures
Sexton's shares are checked for plausibility against a published range. The check does not change any verdict.
**What Sexton counts.** Retired payloads launched after 2007 (`validation.afterLaunchYear`). Sexton has no retirement dates, so launch year stands in for "retired after 2007". A satellite launched in 2008 may have reached the end of its operation in any later year, and one launched earlier may have reached it after 2007 as well.
**Sexton's result, snapshot 2026-11-22.** 27 of 45 retired payloads launched after 2007 are buried (60.0%). The band for the ±25 km mean-element uncertainty moves every perigee and apogee down or up by 25 km and classifies again. It runs from 24 of 45 (53.3%) to 29 of 45 (64.4%). The upper end counts buried and uncertain, because an uncertain perigee is above the low end of the IADC threshold band.
**ESA.** ESA's Annual Space Environment Report, Issue 9.1, 21 October 2025, Executive summary, page 7 of 146: "Between 85% and 100% of all payloads reaching end-of-life during the last decade in the GEO protected region attempt to comply with space debris mitigation measures. Between 70% and 95% do so successfully, with the compliance trend asymptotically increasing, but notable exceptions in 2015 and 2022." Section 6.2 (page 131) defines a successful attempt as one where the payload clears the GEO protected region in line with the IADC formulation, the same formula Sexton uses. So 70% to 95% is a range over the years of the last decade. It is not one rate. Issue 10 (8 September 2026) gives 70% to 90%. Sexton shows the 2025 report's range.
**Roberts (2025).** Not used. The paper was not opened, so no figure or method from it is on this site.
**Where Sexton falls.** 60.0%, and the whole band (53.3% to 64.4%), is below ESA's 70% to 95%. The 45 payloads, snapshot 2026-11-22:
- **Verdicts.** 27 buried, 1 uncertain, 1 shallow grave, 16 unquiet. Counting uncertain as a success gives 27 to 28 of 45 (60.0% to 62.2%).
- **Borderline.** 5 of 45 are within 25 km of a band edge: 3 buried (281, 294 and 304 km above GEO, against the 280 km top of the band), the uncertain one (276 km) and the shallow grave (241 km). Moving every perigee 25 km the favourable way gives at most 29 of 45 (64.4%) buried or uncertain. 70% of 45 is 31.5, so 32 would be needed.
- **Unquiet.** The other 16 have perigees from −435 to +162 km above GEO. The highest (ANGOSAT 1) is 38 km below the 200 km zone edge, so none is borderline. 13 have GP mean elements, 3 have SATCAT altitudes only.

How the groups differ:
- **Objects.** ESA counts "payloads reaching end-of-life during the last decade in the GEO protected region" (page 7). Sexton counts retired payloads launched after 2007 and still near GEO.
- **Threshold.** ESA's page 131 uses the IADC formulation, as Sexton does. Sexton calls a payload buried only above 280 km, the top of the band. The sections read do not say which C_R·A/m ESA uses. Here that moves at most 1 payload.
- **Date.** ESA counts by end-of-life. Sexton has no retirement dates, so it uses launch year. It reads each orbit at the snapshot date.

One satellite is 2.2 percentage points of 45. The data do not say why the 16 are unquiet.
## Font
IM FELL English (Igino Marini, 2010), IBM Plex Sans and IBM Plex Mono (IBM Corp., 2017), all under the SIL Open Font License 1.1 and self-hosted, so the site loads no font from another server. The licence is `src/ui/fonts/OFL.txt`. `docs/credits.md` records where the files came from.
## Credits

- **Thomas González Roberts** (Georgia Tech) for the idea of auditing GEO disposal against the IADC guidelines. His paper (IAA Space Traffic Management Conference, March 2025) was not opened and was not used. Any error in Sexton is Sexton's own, not Roberts'.
- **CelesTrak** (T.S. Kelso) for SATCAT, the GP data and the GPZ table.

## Sources

A link is listed only if it was opened on 2026-11-23. A link that could not be opened is shown as "LINK NEEDED".

| Source | Link | What was checked |
| --- | --- | --- |
| FCC DA 23-888, Order (DISH, EchoStar-7) | https://docs.fcc.gov/public/attachments/DA-23-888A1.txt | Opened. It records a disposal 122 km above GEO against 300 km in the licence's disposal plan, and a $150,000 civil penalty. |
| 47 CFR § 25.283, end-of-life disposal | https://www.law.cornell.edu/cfr/text/47/25.283 | Opened. Paragraph (a) gives 36,021 km + 1000·C_R·A/m. Paragraph (d) excludes space stations launched before March 18, 2002. |
| IADC Space Debris Mitigation Guidelines, IADC-02-01 Revision 2 (March 2020), as hosted by the NASA Orbital Debris Program Office | https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf | Opened. Section 2 (page 6) says organisations are "encouraged" to use the guidelines. The GEO formula and the 0.003 limit are on page 11 of the document. This is an older revision than the current one. |
| IADC Space Debris Mitigation Guidelines, current revision, on the IADC site | LINK NEEDED | iadc-home.org returned 403 Forbidden. |
| ESA Space Environment Report 2025, summary page | https://www.esa.int/Space_Safety/Space_Debris/ESA_Space_Environment_Report_2025 | Opened. |
| ESA's Annual Space Environment Report, Issue 9.1, 21 October 2025 | https://www.sdo.esoc.esa.int/environment_report/Space_Environment_Report_I9R1_20251021.pdf | Opened 2026-11-24. Page 7 of 146: the 70% to 95% range. Section 6.2 (page 131): the IADC formula for GEO, and what a successful attempt is. |
| ESA's Annual Space Environment Report, Issue 10, 8 September 2026 | https://www.sdo.esoc.esa.int/environment_report/Space_Environment_Report_I10R1_20260908.pdf | Opened 2026-11-24. Page 7 of 152: the same sentence gives 70% to 90%. |
| Roberts, "Assessing Compliance with Post-mission Disposal Guidelines in Geosynchronous Orbit", IAA Space Traffic Management Conference, March 2025 | https://iac.gatech.edu/publications/pub/8089 | Opened: a listing page (title, date, author), not the paper. Not used. |
| CelesTrak SATCAT format | https://celestrak.org/satcat/satcat-format.php | Opened. Field list, with altitudes in kilometres. |
| CelesTrak SATCAT operational status codes | https://celestrak.org/satcat/status.php | Opened. Gives the meaning of `+`, `-`, `P`, `B`, `S`, `X`, `D` and `?`. |
| CelesTrak GP data formats | https://celestrak.org/NORAD/documentation/gp-data-formats.php | Opened. GP data are Brouwer mean elements fitted with SGP4. It lists the GPZ and GPZ-PLUS data sets. |
| CelesTrak | https://celestrak.org/ | Opened. |
| SIL Open Font License 1.1 | https://openfontlicense.org/open-font-license-official-text/ | Opened. |
| IM FELL English licence file | https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/OFL.txt | Opened. Copyright 2010 Igino Marini. |
| IBM Plex licence file | https://raw.githubusercontent.com/IBM/plex/master/LICENSE.txt | Opened 2026-11-24. Copyright 2017 IBM Corp., Reserved Font Name "Plex", SIL Open Font License 1.1. |
| WGS-72 constants (Earth radius and μ) | LINK NEEDED | No source has been opened. |

The ESA range is shown, because it was found in the report itself (above). The census page shows a figure only after it has been found in its source.

## What we do not say

Sexton gives a verdict on an orbit, never on a satellite's owner. It avoids these words and phrases about any satellite or operator:

- "violated", "violation" and "violates"
- "illegal" and "unlawful"
- "non-compliant", "noncompliant" and "non compliant"
- "broke the law"
- "breach" and "in breach"

It says "below the IADC disposal threshold under the stated assumptions" instead. It also never gives a retirement date, such as "retired in 2015", because the data do not contain one.
