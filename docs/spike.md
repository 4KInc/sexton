# Day-1 data spike (partial)

Snapshot: `data/raw/2026-11-20/`, fetched 2026-11-20 between 20:27 and 20:29 UTC. See `manifest.json` for URLs, sizes and sha256.
Analysis script: `scripts/spike-2026-11-20.ts` (reads only those files, no network).

Files used:

- `gpz.csv`: CelesTrak GPZ, OMM CSV, 863 objects.
- `gpz-plus.csv`: CelesTrak GPZ-PLUS, OMM CSV, 1,732 objects. Kept only as evidence for section d. It is not a Sexton source.
- `table-gpz.csv`: the GPZ status table. It is HTML despite `FORMAT=csv`.

SATCAT is not in the snapshot. CelesTrak stalled partway through every large download after its outage, so the SATCAT questions are PENDING (section f).

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

A partial download confirmed these columns: OBJECT_NAME, OBJECT_ID, NORAD_CAT_ID, OBJECT_TYPE, OPS_STATUS_CODE, OWNER, LAUNCH_DATE, LAUNCH_SITE, DECAY_DATE, PERIOD, INCLINATION, APOGEE, PERIGEE, RCS, DATA_STATUS_CODE, ORBIT_CENTER, ORBIT_TYPE.

APOGEE and PERIGEE are altitudes in whole kilometres.

This means SATCAT has every field we asked about: OBJECT_TYPE, OPS_STATUS_CODE, OWNER, LAUNCH_DATE, PERIOD, APOGEE, PERIGEE and DECAY_DATE.

Every other SATCAT question is PENDING until the full `satcat.csv` is in the snapshot:

- PENDING: precision against GP. This is the max and median |SATCAT perigee − GP perigee| over the 863 GPZ objects, and whether SATCAT is precise enough for a ±25 km verdict band.
- PENDING: a near-GEO filter and its counts by OBJECT_TYPE and OPS_STATUS_CODE, and whether all 863 GPZ objects fall inside it.
- PENDING: Luch/Olymp (40258), meaning whether it is in SATCAT and inside the filter, and its orbit and status.
- PENDING: whether OPS_STATUS_CODE agrees with the GPZ table's PAY+/PAY-, the number of disagreements, and which field decides "retired".
- PENDING: verdict-band counts for retired payloads. These are the counts at or below +200, from +200 to +247, from +247 to +280 and at or above +280 km. They include, of those at or above +247, how many have e > 0.003, and how many are within 25 km of +200, +247 or +280.
- PENDING: the max perigee above GEO among retired payloads, and any oddities.

These counts will cover only objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.

## Status: CONDITIONAL GO, pending SATCAT

What is settled:

- The perigee formula matches CelesTrak's table to within 0.515 km for all 863 GPZ objects. That is rounding.
- EchoStar-7 and Intelsat 511 match the expected values.
- The GPZ status table can be parsed. Its PAY+/PAY-/R/B/DEB codes cover every GPZ object.
- SATCAT has the columns Sexton needs.

What is not settled:

- GPZ and GPZ-PLUS stop at +200 km, so SATCAT is the only source that covers the graveyard.
- The GO conditions that depend on SATCAT are still open. SATCAT perigee must be within about 5 km of GP for GPZ objects, and the near-GEO filter must find retired payloads above +280 km.
- Until both are checked, we don't know whether SATCAT's whole-kilometre apogee and perigee support a ±25 km verdict band.
