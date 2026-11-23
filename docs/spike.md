# Day-1 data spike (partial)

Snapshot: `data/raw/2026-11-20/`, fetched 2026-11-20 between 20:27 and 20:29 UTC. See `manifest.json` for URLs, sizes and sha256.
Analysis script: `scripts/spike-2026-11-20.ts` (reads only those files, no network).

Files used:

- `gpz.csv`: CelesTrak GPZ, OMM CSV, 863 objects.
- `gpz-plus.csv`: CelesTrak GPZ-PLUS, OMM CSV, 1,732 objects. Kept only as evidence for section d. It is not a Sexton source.
- `table-gpz.csv`: the GPZ status table. It is HTML despite `FORMAT=csv`.

SATCAT was not in the 2026-11-20 snapshot, because CelesTrak stalled partway through every large download after its outage. It arrived on 2026-11-22 and is answered in section f.

Terms used below:

- **GEO** (geostationary orbit): the circular orbit about 35,786 km above the equator, where a satellite stays over one spot.
- **Perigee**: the lowest point of an orbit. "Perigee above GEO" is perigee altitude minus 35,786 km.
- **Eccentricity**: how far an orbit is from a perfect circle. 0 is a circle.

## a. Our perigee formula against the GPZ table

Formula: n (rev/day) × 2π / 86,400 gives n in rad/s. Then a = (μ/n²)^(1/3), with μ = 398,600.8 km³/s², and perigee = a(1 − e) − 6,378.135 km.

All 863 GPZ objects are in the table, and all 863 table rows are in `gpz.csv`. They were matched by NORAD id.

| Measure | Value |
| --- | --- |
| Max \|our perigee − table perigee\| | 0.515 km (ASTRA 4A, 32299) |
| Median \|our perigee − table perigee\| | 0.255 km |
| Mean signed difference | +0.018 km |
| Max \|our apogee − table apogee\| | 0.513 km |
| Objects differing by more than 1 km | 0 |

The table gives heights as whole kilometres, so up to 0.5 km of difference is just rounding. The formula matches the table for every object.

## b. EchoStar-7 (27378)

| Source | Perigee above GEO | Apogee above GEO | Eccentricity |
| --- | --- | --- | --- |
| GPZ OMM (epoch 2026-11-20T12:07:02Z) | +110.4 km | +136.2 km | 0.00030476 |
| GPZ table | +110 km | +136 km | 0.0003048 |

These match the expected +110 and +136. The table status is PAY- (retired payload). The FCC found a disposal of about 122 km above GEO (DA 23-888). Today's +110 to +136 km range brackets that figure.

## c. Intelsat 511 (15873)

| Source | Perigee above GEO | Apogee above GEO | Eccentricity |
| --- | --- | --- | --- |
| GPZ OMM (epoch 2026-11-20T04:44:19Z) | +17.6 km | +82.2 km | 0.00076513 |
| GPZ table | +18 km | +82 km | 0.0007651 |

These match the expected +18 and +82. The table status is PAY-.

## d. GPZ against GPZ-PLUS

| Measure | GPZ | GPZ-PLUS |
| --- | --- | --- |
| Objects | 863 | 1,732 |
| Duplicate NORAD ids within the file | 0 | 0 |
| Min perigee above GEO | −198.7 km | −35,633.0 km |
| Max perigee above GEO | +161.8 km | +199.8 km |
| Min apogee above GEO | −112.5 km | −199.9 km |
| Max apogee above GEO | +199.1 km | +148,121.5 km |
| Inclination range | 0.0° to 62.6° | 0.0° to 94.3° |

Overlap:

- In both: 863. Every GPZ object is in GPZ-PLUS, with an identical epoch.
- GPZ only: 0. GPZ-PLUS only: 869. Merged set: 1,732.

The 869 extra objects in GPZ-PLUS are orbits that pass through the protected zone without staying inside it:

- 623 have perigee more than 1,000 km below GEO.
- 122 have perigee between 1,000 and 200 km below GEO.
- 124 have perigee within ±200 km of GEO and apogee above +200 km.

The data fit these definitions. GPZ holds objects with both perigee and apogee within ±200 km of GEO. GPZ-PLUS holds every object whose orbit crosses that band.

**GPZ-PLUS does not reach the graveyard orbit.** No object in either file has a perigee above +200 km. The highest perigee is +199.8 km (SATCOM 2R, 14328). The IADC threshold for a typical satellite is about +235 to +300 km above GEO. A satellite that was disposed of correctly is therefore missing from both files. Sexton needs SATCAT to see the graveyard.

Luch/Olymp (40258) is in neither GPZ nor GPZ-PLUS, and it is not in the GPZ table.

## e. The GPZ status table

Columns, in order: International Designator, NORAD Catalog Number, Name, Period (minutes), Inclination (degrees), Apogee Height (km), Perigee Height (km), Eccentricity, Latest Data, GP Age (days).

The status code is the first word of the column headed "Latest Data". That cell also holds links.

| Status | Meaning | Count |
| --- | --- | --- |
| PAY+ | Payload, operational | 542 |
| PAY- | Payload, not operational | 238 |
| R/B | Rocket body | 70 |
| DEB | Debris | 13 |
| Total | | 863 |

Element set age (GP Age): the median is 0.39 days and the maximum is 18.57 days. No element set is over 30 days old.

## f. SATCAT
Snapshot `data/raw/2026-11-22/` (complete):
- `satcat.csv`: downloaded once by hand with curl at 2026-11-22T17:43:41Z. 6,807,408 bytes, sha256 `7404491f…c4256`, no content-encoding. The server's Last-Modified is Sat, 21 Nov 2026 21:07:40 GMT, so SATCAT is about 21 hours older than the two files below.
- `gpz.csv` (117,222 bytes) and `table-gpz.csv` (777,248 bytes): fetched by `scripts/snapshot.ts` at 18:00 UTC the same day, one try each, both HTTP 200. The script skipped `satcat.csv` because of the 17:43 download.

Columns: OBJECT_NAME, OBJECT_ID, NORAD_CAT_ID, OBJECT_TYPE, OPS_STATUS_CODE, OWNER, LAUNCH_DATE, LAUNCH_SITE, DECAY_DATE, PERIOD, INCLINATION, APOGEE, PERIGEE, RCS, DATA_STATUS_CODE, ORBIT_CENTER, ORBIT_TYPE. APOGEE and PERIGEE are altitudes in whole kilometres.
Parse result: 69,371 rows, 0 rejected, 2,052 with a blank APOGEE or PERIGEE (counted, not rejected). Today's GPZ file has 868 objects (863 on 2026-11-20: six added, 28786 gone), and the GPZ table has the same 868.

### Precision against GP
All 868 GPZ objects are in SATCAT with an orbit. SATCAT perigee minus GP perigee (GP computed with the formula in section a):

| Measure | Perigee | Apogee |
| --- | --- | --- |
| Max \|difference\| | 256.4 km (USA 270) | 198.6 km |
| Median \|difference\| | 0.29 km | 0.27 km |
| 95th percentile | 1.12 km | 1.05 km |
| 99th percentile | 3.54 km | not computed |
| Mean signed (SATCAT − GP) | +0.22 km | +0.002 km |
| Objects over 1 km | 54 | not computed |
| Objects over 5 km | 5 | 5 |
| Objects over 25 km | 3 | 3 |

- The five objects over 5 km are all living payloads (OPS_STATUS_CODE `+`): USA 270, USA 324, USA 325, LUCH-5X (OLYMP-K 2) and TJS-24. Their SATCAT and GP values come from different times (SATCAT is 21 hours older, and the USA 270 epoch is 2026-11-02), so a manoeuvre is the likely cause. I did not check that.
- For the 191 retired payloads that are in both, the largest difference is 0.85 km, the median is 0.25 km, and none is over 1 km.
- Eccentricity from SATCAT altitudes against GP: median difference 0.0000047, maximum 0.0010 (the same manoeuvring objects).
- Rounding alone gives an error of at most 0.5 km in an altitude and at most 1.2e-5 in eccentricity. Against the ±25 km band that is 2%, and against the 0.003 eccentricity limit it is 0.4%.
- Answer: SATCAT is precise enough for the ±25 km band. 863 of 868 objects are within 5 km, and every retired payload is within 1 km. GP still wins where both exist (design 2.5), so the five exceptions use GP.

### Near-GEO filter
Filter as configured: empty DECAY_DATE, ORBIT_CENTER `EA`, apogee and perigee both within GEO ± 2,000 km. 1,763 SATCAT rows pass.

| OBJECT_TYPE / OPS_STATUS_CODE | Rows |
| --- | --- |
| PAY / `-` (not operational) | 648 |
| PAY / `+` (operational) | 600 |
| PAY / blank | 93 |
| PAY / `P` | 25 |
| PAY / `B` | 8 |
| PAY / `S` | 2 |
| R/B (rocket body), status always blank | 253 |
| DEB (debris), status always blank | 134 |
| Total | 1,763 |

- 867 of the 868 GPZ objects pass. The one that does not is MEV-2 (46113): SATCAT gives ORBIT_CENTER `28358`, which is the NORAD id of INTELSAT 10-02, not `EA`. The population rule adds every GP id, so MEV-2 is in. The population is 1,764 objects, and 67,607 SATCAT rows are outside it.
- No other row passes the altitude test with an ORBIT_CENTER other than `EA`. Two debris rows (FREGAT DEB, decayed 2021 and 2024) pass the altitude test and are removed by the DECAY_DATE test.
- Sensitivity to the window (retired payloads are PAY with status `-`):

| Window, km around GEO | All objects | Retired payloads |
| --- | --- | --- |
| ±250 | 961 | 229 |
| ±500 | 1,410 | 514 |
| ±1,000 | 1,654 | 615 |
| ±2,000 (current) | 1,763 | 648 |
| ±3,000 | 1,835 | 680 |
| ±5,000 | 1,873 | 687 |
| ±10,000 | 1,913 | 693 |

- A ±10,000 window would add 45 retired payloads. Of these, 32 sit 2,000 to 9,900 km below GEO with their apogee below +2,000, such as the OPS 93xx (IDSCS) satellites at about −2,000 to −2,800 km. Four have a perigee inside the window and an apogee above +2,000 (MARECS-A, INTELSAT 8, BEIDOU-2 G2, DUMMY SAT 2 & BREEZE-M). Five are near-circular above +2,000 (INTELSAT 3-F2, 3-F3, 3-F4, SINOSAT 2, QZS-1, perigee +2,046 to +4,083 km). Four are eccentric orbits crossing the window on both sides.
- **Decision: keep nearGeo at ±2,000 km and `EA`.** The count of retired payloads changes by 5% from ±2,000 to ±3,000 and by 1% for each step after that. The extra objects are mostly in other regimes (drifting thousands of kilometres below GEO, or eccentric). The 648 inside already cover the whole band from the zone to +1,739 km. The excluded retired payloads are a known blind spot, and the "what the register cannot see" text must say that objects sent much higher, left GEO, or drift well below it may be missing. No change to `config.ts`, and `docs/methodology.md` does not exist yet (Task 15 writes it with these limits).

### Luch/Olymp (40258)
In SATCAT: LUCH (OLYMP-K 1), 2014-058A, owner CIS, launched 2014-09-27, OBJECT_TYPE PAY, OPS_STATUS_CODE `-`, ORBIT_CENTER `EA`, no decay date, inclination 2.3°. SATCAT altitudes are 36,095 × 36,133 km, so p = +309 km, q = +347 km. It passes the filter. It is not in GPZ and not in the GPZ table, so its orbit is SATCAT-only. The engine gives it verdict buried, not borderline (29 km above +280), 12 years since launch, launched on or after the FCC rule date. The pair LUCH-5X (OLYMP-K 2, 55841) is operational (`+`) and in GPZ at p +79 km. A debris object named LUCH (OLYMP-K 1) DEB (67745) is at −3,984 to +5,209 km and is outside the filter.

### Status agreement
All 868 GPZ table rows are in SATCAT. Counts, table code against SATCAT type and status:

| GPZ table | SATCAT | Rows |
| --- | --- | --- |
| PAY+ | PAY `+` | 517 |
| PAY+ | PAY `P` | 21 |
| PAY+ | PAY `B` | 7 |
| PAY+ | PAY `S` | 1 |
| PAY- | PAY `-` | 191 |
| PAY- | PAY, blank status | 48 |
| R/B | R/B | 70 |
| DEB | DEB | 13 |

- 820 agree and 48 disagree. All 48 are table PAY- (not operational) where SATCAT has a payload with a blank OPS_STATUS_CODE. They were launched between 1973-03-06 and 1997-11-12. All have GP orbits, with perigee from −182.8 to +125.9 km above GEO.
- OPS_STATUS_CODE `-` is the field that decides "retired" in the engine (SATCAT decides, the table is only a fallback when SATCAT has no row, design 2.5). So these 48 are "unknown payload" and get no verdict. If the table decided in this case, the retired payloads would be 696, and all 48 would be unquiet or fallen. **This was an open choice for the owner.** Decided 2026-11-22: when SATCAT has a payload with a blank or unknown status, the engine uses the GPZ table's status (status source "GPZ table") and keeps the disagreement record. The retired payloads are now 696. See design 2.5.
- No SATCAT `+` payload is called retired by the table, and no table PAY+ is `-` in SATCAT.

### Verdict bands, retired payloads (648)
| Perigee above GEO | Retired payloads | From GP | From SATCAT |
| --- | --- | --- | --- |
| at or below +200 km | 267 | 191 | 76 |
| above +200 to below +247 km | 30 | 0 | 30 |
| +247 to below +280 km | 51 | 0 | 51 |
| +280 km or more | 300 | 0 | 300 |

- Verdicts: buried 280, uncertain 50, shallow grave 30, unquiet 264, restless 21, fallen 3. (Restless is above +247 with e > 0.003.)
- Of the 351 at or above +247 km, 21 have e > 0.003. Another 37 below +247 km also have e > 0.003, so 58 retired payloads in all.
- Within 25 km of an edge: 28 of +200, 60 of +247, 87 of +280. The ranges overlap, so the number flagged borderline is 141 (22%). Every one of the 141 uses a SATCAT orbit.
- Three SATCAT objects sit exactly on an edge: EUTELSAT 33D and OPTUS D2 at +247 (uncertain), TELKOM 2 at +280 (buried). Eight SATCAT objects are within 1 km of an edge.
- Launched before 18 March 2002: 517. On or after: 131.

### How much of this rests on SATCAT whole-kilometre altitudes
- 457 of 648 retired payloads (70.5%) get their orbit from SATCAT. The other 191 (29.5%) come from GP. No object with a verdict lacks one of the two.
- Everything above +200 km is SATCAT-only: 381 of 381. GP covers only the orbits that stay inside the protected zone.
- Against GP, the SATCAT altitude is off by a median 0.29 km, and by under 1 km for every retired payload that has both (see above). The assumption that this carries over to SATCAT-only objects is untested. It holds for the 191 retired payloads that can be checked, all of them inside the zone.
- 25 SATCAT-only retired payloads have e within 0.0005 of the 0.003 limit, so their restless or not-restless result rests on whole-km altitudes (the closest is GORIZONT 28 at 0.00302, about 2e-5 from the limit, against a rounding error of up to 1.2e-5).

### Highest perigee and oddities
- Highest perigee above GEO among retired payloads: **+1,739 km** (OPS 9441, DSCS 2-11, SATCAT). 15 retired payloads are at +1,000 km or higher, and 175 are between +280 and +400.
- Fallen: 3 (ATS 6 at −618 km, OLYMPUS at −372 km, EUTELSAT W75 at −684 km).
- No retired payload lacks an owner or a launch date. The highest inclination among them is 29.7°, and four are above 20°.
- The GPZ file changes from day to day: +6, −1 in two days. Today's six additions include INTELSAT 4A-F2 (8620), a retired payload.
- The oldest GP epoch in today's file is 2026-11-02 (USA 270), the newest 2026-11-22.
- These counts cover only objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.

## Status: GO
- SATCAT perigee is within 5 km of GP for 863 of 868 GPZ objects, and within 1 km for every retired payload that is in both. The condition of about 5 km is met.
- The near-GEO filter finds 300 retired payloads at or above +280 km, so the graveyard is visible. The condition is met.
- The whole-kilometre rounding (at most 0.5 km) is small against the ±25 km band.
- `nearGeo` stays at ±2,000 km and `EA`.

Open items for later tasks:
- The 48 payloads that the table calls not operational and SATCAT leaves blank (Task 20 decides whether the table fills the gap).
- The ±2,000 km window leaves out 45 retired payloads that a ±10,000 km window would add. The census text names this blind spot.
- SATCAT is 21 hours older than the GP files, so a few manoeuvring objects differ in both.
## Task 21: Luch/Olymp case file status
- The committed snapshot `data/raw/2026-11-22/satcat.csv` has a row for 40258: LUCH (OLYMP-K 1), PAY, OPS_STATUS_CODE `-`, ORBIT_CENTER `EA`, no decay date, apogee 36,133 km, perigee 36,095 km. The row matches the register record (p +309 km, SATCAT orbit).
- SATCAT therefore confirms where the object is. `provisional` in `data/cases/40258.md` is set to `false`.
- This confirms the catalogue entry and the orbit. It does not add a source for the object's history, and the case file claims none.
