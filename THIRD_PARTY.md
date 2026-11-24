# Third-party software, data and fonts

Sexton's own code is under the MIT licence (`LICENSE`). Everything below was checked on 2026-11-24 against `package.json`, `package-lock.json` and the installed packages.

## Data

| Data | Where it comes from | Terms |
| --- | --- | --- |
| SATCAT (`data/raw/<date>/satcat.csv`) | CelesTrak, https://celestrak.org/pub/satcat.csv, the satellite catalogue (CelesTrak describes it as the official USSF SATCAT) | CelesTrak's usage policy: https://celestrak.org/usage-policy.php. It limits how often data may be downloaded. It sets no attribution rule that was found, and CelesTrak states a tradition of making data freely available. Sexton credits CelesTrak anyway (below). |
| GPZ OMM CSV (`gpz.csv`) | CelesTrak, `gp.php?SPECIAL=GPZ&FORMAT=csv` | The same policy. |
| GPZ status table (`table-gpz.csv`) | CelesTrak, `table.php?SPECIAL=gpz&FORMAT=csv` (it returns HTML) | The same policy. |

Attribution: orbit and catalogue data are from CelesTrak (https://celestrak.org, Dr. T.S. Kelso).

How Sexton follows the usage policy:
- Only `scripts/snapshot.ts` downloads data. The site never calls CelesTrak.
- At most one download per data set per 2 hours, gzip requested, `FORMAT=csv`, no retries, stop on any response other than 200, and wait at least 15 minutes after a 500 or 503.
- The committed snapshot is the only data the site uses.

Sexton does not republish a licence for CelesTrak data. If you reuse the files in `data/raw/`, read the policy above first.

## Texts that are cited, not copied

| Source | Link | Use |
| --- | --- | --- |
| FCC DA 23-888 | https://docs.fcc.gov/public/attachments/DA-23-888A1.txt | Quoted figures and a short quotation, with the link. |
| 47 CFR § 25.283 | https://www.law.cornell.edu/cfr/text/47/25.283 | Short quotations, with the link. |
| IADC Space Debris Mitigation Guidelines, IADC-02-01 Rev. 2 | https://orbitaldebris.jsc.nasa.gov/library/IADC-Space-Debris-Guidelines-Revision-2.pdf | Formula and one quoted phrase, with the link. |
| ESA's Annual Space Environment Report, Issues 9.1 and 10 | https://www.sdo.esoc.esa.int/environment_report/Space_Environment_Report_I9R1_20251021.pdf and `..._I10R1_20260908.pdf` | One quoted sentence with its page, with the link. |
| Roberts (2025), Georgia Tech | https://iac.gatech.edu/publications/pub/8089 | Credited for the idea. The paper was not opened. |

## Fonts
| Font | Licence | Files |
| --- | --- | --- |
| IM FELL English, Igino Marini (copyright 2010). Display: headings and headstone names | SIL Open Font License 1.1, https://openfontlicense.org/open-font-license-official-text/ | `src/ui/fonts/im-fell-english-latin.woff2`, licence text in `src/ui/fonts/OFL.txt`. |
| IBM Plex Sans, IBM Corp. (copyright 2017). Body text. Weights 400 and 600 | SIL Open Font License 1.1 | `src/ui/fonts/ibm-plex-sans-latin-400.woff2`, `src/ui/fonts/ibm-plex-sans-latin-600.woff2`, licence text in `src/ui/fonts/OFL-IBM-Plex.txt`. |
| IBM Plex Mono, IBM Corp. (copyright 2017). Readings and labels: every number, unit, date and NORAD id. Weights 400 and 500 | SIL Open Font License 1.1 | `src/ui/fonts/ibm-plex-mono-latin-400.woff2`, `src/ui/fonts/ibm-plex-mono-latin-500.woff2`, the same licence text. |
All five are self-hosted latin subsets, loaded with `font-display: swap`. The woff2 files total 136 KB. Origin and hashes: `docs/credits.md`. No font is loaded from another server.
## Skill
| Skill | Source | Licence | Files |
| --- | --- | --- | --- |
| frontend-design, Anthropic | https://github.com/anthropics/skills/tree/main/skills/frontend-design | Apache License 2.0 | `.kiro/skills/frontend-design/SKILL.md` and `LICENSE.txt`, copied unchanged. A Kiro instruction file. It is not part of the shipped site. |
## Software

Direct dependencies (from `package.json`):

| Package | Version | Licence | Used for | In the shipped site |
| --- | --- | --- | --- | --- |
| marked | 18.2.1 | MIT | Rendering the methodology and case files | Yes |
| @modelcontextprotocol/sdk | 1.32.2 | MIT | The MCP server in `scripts/mcp/` | No |
| zod | 4.6.7 | MIT | MCP tool input schemas | No |
| vite | 8.3.8 | MIT | Build | No |
| typescript | 7.0.2 | Apache-2.0 | Type checking | No |
| vitest | 5.1.1 | MIT | Tests | No |
| fast-check | 4.10.3 | MIT | Property tests | No |
| yaml | 2.9.1 | ISC | Parsing the workflow files in tests | No |
| @types/node | 24.19.2 | MIT | Types | No |

Transitive dependencies: `package-lock.json` lists 189 packages in all (the 9 above and 180 others, counting each platform build of a package). By licence, as read from the lock file: MIT 140, Apache-2.0 23, MPL-2.0 12, ISC 9, BSD-3-Clause 3, BSD-2-Clause 1, 0BSD 1. The 12 MPL-2.0 packages are all builds of `lightningcss`, a build-time tool that Vite uses. It is not part of the shipped site. Each package's own licence file is in `node_modules/<name>` after `npm install`.

## GitHub Actions

Pinned by commit SHA in `.github/workflows/`: `actions/checkout` and `actions/setup-node` (MIT). The workflow `kiro-verify.yml` also downloads Kiro CLI with the installer from https://cli.kiro.dev/install, under Kiro's own terms. It is not part of the site.
