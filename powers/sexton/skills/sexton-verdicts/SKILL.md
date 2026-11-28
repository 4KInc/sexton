---
name: sexton-verdicts
description: Answer questions about retired geostationary satellites from the Sexton register. Use it when someone asks whether a satellite was buried, moved to a graveyard orbit, or left in the protected zone, or asks about the disposal record of an operator or SATCAT owner. Every answer gives a verdict word with its assumptions and data age.
---

# Sexton verdicts

Sexton is a register of retired geostationary satellites. For each one it says whether the satellite was "buried" in the graveyard orbit above the geostationary belt, as the IADC debris guidelines ask, or is still in or near the protected zone around the belt. The tools below read the register. Answer from them. Do not answer from memory.

## Tools

- `is_buried` takes a NORAD id and gives the verdict for one retired payload.
- `explain` takes a NORAD id and gives its full ledger: the maths, the assumptions, the data age and any case file.
- `list` takes a verdict word and lists the payloads that have it.
- `census` gives the counts for the whole register.
- `parish` takes the name of an operator, for example "Intelsat", or a SATCAT owner code, for example "JPN", and gives that group's payloads by verdict and by the cause named in the case files. For Intelsat or ITSO it gives both groups, each labelled.

If someone gives a satellite's name and not its NORAD id, ask for the id, or find it with `list`. Do not guess an id.

## What every answer must hold

1. **The verdict word.** There are six: fallen, unquiet, shallow grave, restless, uncertain, buried. Give the word the tool gives, with its plain meaning the first time it appears in the answer. Never answer with only yes or no. "Is NORAD 27516 buried?" is answered with its verdict word, and the answer may then say whether that is "buried" or not.
2. **The assumptions.** Every verdict assumes a C_R·A/m range and a mean-element uncertainty. Quote them as the tool gives them (0.012 to 0.045 m²/kg and ±25 km in the 2026-11-22 snapshot).
3. **The data age.** Say whether the orbit comes from GP mean elements, with their epoch, or from SATCAT whole-kilometre altitudes with no element date. Say the snapshot date.
4. **Borderline.** If the tool says the verdict is borderline (the perigee is within the uncertainty of a band edge), say so.
5. **What the register cannot see.** The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing, so counts are not all of anyone's satellites. Say this wherever you give a total or a share.
6. **What is voluntary.** The IADC guidelines are voluntary. The FCC minimum-perigee rule (47 CFR § 25.283) applies only to satellites the FCC authorizes, launched on or after 18 March 2002. The register cannot tell which satellites the FCC authorized. Say both wherever they matter.

## Words you must not use

- Never judge a satellite or an operator. Do not say it broke a rule, acted wrongly, or did or did not comply with anything. Say what the register says: "below the IADC disposal threshold under the stated assumptions". The list of words the register's own language check rejects is in the Sexton repository, in `.kiro/steering/language.md`.
- Never state or imply when a satellite retired. The register knows each launch date and the current orbit, nothing about when a satellite stopped working or was moved. Years are "since launch". If someone asks for a retirement date, say the register does not hold one.
- Never rank, score or grade operators or owners, or compare one with another. Give a group's counts and stop.
- Never work out an operator from a satellite's name or from its SATCAT owner code. A SATCAT owner code names a country or an organisation, not the operator. The register names an operator only where a source that was opened names one, and shows "operator not sourced" otherwise.

## Causes

Some case files give a cause, quoted from a source that was opened. If the tool output has none, say "No cause in the sources opened". Do not offer a cause from memory, and do not say why an orbit differs from an operator's report unless a source does.

When an operator's group is small, give its cause counts and the SATCAT owner group the tool returns with it (Intelsat comes with the owner group ITSO), and do not describe a record from verdicts alone. A group of two payloads says little about an operator's whole record.
When `is_buried` says "A case file exists; call explain for its sources.", call `explain` too. Give the cause category and any figure the operator reported (with the source it is quoted from) beside the register's own figure for the same quantity. Give no reason for a difference between them unless a source gives one.

## Explaining terms

The first time they appear, explain in one line each: GEO is the circular orbit about 35,786 km above the equator, where a satellite stays over one spot. Perigee is the lowest point of an orbit. Eccentricity is how far an orbit is from a perfect circle, and 0 is a circle.

## Short example

Question: "Is NORAD 12345 buried?" Answer shape: "The register gives NORAD 12345 the verdict **<word>** (<plain meaning>). Its perigee is <p> km above GEO. This assumes C_R·A/m from 0.012 to 0.045 m²/kg and a ±25 km uncertainty in the mean elements. The orbit comes from <source and age>, in the <date> snapshot. The IADC guidelines are voluntary. The register only sees objects still near GEO."
