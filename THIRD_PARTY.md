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
| ag-grid-community | 36.3.0 (exact) | MIT | The desktop table (Community features only; loaded on `#/table` over 600 px). Brings `ag-stack` 36.3.0 and `ag-charts-types` 14.3.0, both MIT | Yes |
| @modelcontextprotocol/sdk | 1.32.2 | MIT | The MCP server in `scripts/mcp/` | No |
| zod | 4.6.7 | MIT | MCP tool input schemas | No |
| vite | 8.3.8 | MIT | Build | No |
| typescript | 7.0.2 | Apache-2.0 | Type checking | No |
| vitest | 5.1.1 | MIT | Tests | No |
| fast-check | 4.10.3 | MIT | Property tests | No |
| yaml | 2.9.1 | ISC | Parsing the workflow files in tests | No |
| @types/node | 24.19.2 | MIT | Types | No |
| happy-dom | 21.0.4 (exact) | MIT | A DOM for the grid smoke test | No |

Transitive dependencies: `package-lock.json` lists 346 packages in all (the 16 direct ones and 330 others, counting each platform build of a package; recounted 2026-11-27 after adding the five development-only packages below, which brought 147 of them). By licence, as read from the lock file: MIT 262, Apache-2.0 41, ISC 15, MPL-2.0 14, 0BSD 5, BSD-3-Clause 5, BSD-2-Clause 2, CC-BY-4.0 1, BlueOak-1.0.0 1. Twelve of the 14 MPL-2.0 packages are builds of `lightningcss`, a build-time tool that Vite uses. The other two are `axe-core` and `@axe-core/playwright`, below. None of the 14 is part of the shipped site. Each package's own licence file is in `node_modules/<name>` after `npm install`.

## The Kiro power's bundled server (not in dist/)

`powers/sexton/server/sexton-mcp.mjs` is `scripts/mcp/server.ts` bundled with the packages it imports, so the power runs under plain `node` from any folder. It is built by `node scripts/build-power.ts` and is not part of the site. The packages inside it are already direct or transitive dependencies of the repository: `@modelcontextprotocol/sdk` (MIT), `zod` (MIT), `ajv` (MIT), `ajv-formats` (MIT), `fast-deep-equal` (MIT), `json-schema-traverse` (MIT), `fast-uri` (BSD-3-Clause) and `zod-to-json-schema` (ISC). Their licence notices are in `powers/sexton/server/THIRD_PARTY_LICENSES.txt`, and a test checks that the file is current and that no other package enters the bundle.

## Development only (not in dist/)

Added 2026-11-27 for requirements R15 and R16. All five are `devDependencies`, pinned to an exact version. Versions and licences were read from the npm registry and from the installed packages. No test or script in `src/` imports them, so the Vite build never bundles them. `npm run build` was run after installing them, and `dist/` holds no `axe-core`, `@axe-core`, `playwright` or `stryker` text (searched with grep). The one match for "lightningcss" is the CSS variable name `--lightningcss-light` that the build tool writes into the minified stylesheet. It is not that tool's code.

| Package | Version | Licence | Used for |
| --- | --- | --- | --- |
| @playwright/test | 1.65.1 | Apache-2.0 | End-to-end tests in Chromium, Firefox and WebKit (R15). Started by `npm run test:e2e`, never by `npm test` |
| @axe-core/playwright | 4.14.1 | MPL-2.0 | Runs axe-core inside the Playwright pages (R15) |
| axe-core | 4.14.1 | MPL-2.0 | The accessibility rules (R15). Its WCAG 2.2 AA tag `wcag22aa` is in the installed `axe.js` and in axe-core's API documentation |
| @stryker-mutator/core | 10.1.1 | Apache-2.0 | Mutation testing of `src/engine/` (R16). Started by `npm run mutate`, never by `npm test` |
| @stryker-mutator/vitest-runner | 10.1.1 | Apache-2.0 | Lets Stryker run the Vitest tests (R16) |

MPL-2.0 is a file-level licence. The two axe packages are used unmodified as test tools and are neither copied into this repository nor shipped. New licences in the lock file from these five: `caniuse-lite` (CC-BY-4.0, browser-support data, comes with Stryker's Babel), `minimatch` (BlueOak-1.0.0, comes with Stryker) and `tslib` (0BSD, four copies inside Stryker). They are also development only. The two Playwright packages' browsers are downloaded by `npx playwright install` on the developer's machine or the runner. They are not in the repository.

## GitHub Actions

Pinned by commit SHA in `.github/workflows/`: `actions/checkout` and `actions/setup-node` (MIT). The workflow `kiro-verify.yml` also downloads Kiro CLI with the installer from https://cli.kiro.dev/install, under Kiro's own terms. It is not part of the site.
