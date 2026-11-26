// Figures from outside the register that a case file cites and the ledger shows beside the register's own numbers.
// Only where a case file in data/cases/ cites the figure and its source, and the figure differs from the snapshot.
// test/external.test.ts checks each entry against its case file and the register. No figure here is invented.
export interface ExternalFigures {
  /** One sentence for the identity section, under the launch-era note, with the order linked. */
  fine?: { before: string; linkText: string; after: string; url: string };
  /** The perigee the source gives, beside the register's perigee. */
  perigee?: { km: number; source: string };
}
export const DA_23_888 = 'https://docs.fcc.gov/public/attachments/DA-23-888A1.txt';
/** Keyed by NORAD id. EchoStar 7: FCC Order DA 23-888 (2 October 2023), cited in data/cases/27378.md and docs/methodology.md. */
export const EXTERNAL: ReadonlyMap<number, ExternalFigures> = new Map([
  [
    27378,
    {
      fine: { before: 'Fined by the FCC in 2023 (', linkText: 'DA 23-888', after: ', $150,000) over its disposal orbit.', url: DA_23_888 },
      perigee: { km: 122, source: 'FCC, 2023' },
    },
  ],
]);
/** "About 122 km at disposal (FCC, 2023); 110 km in the snapshot's elements." The register's perigee is rounded to whole km here. */
export const perigeeAside = (ext: { km: number; source: string }, pKm: number): string =>
  `About ${ext.km} km at disposal (${ext.source}); ${Math.round(pKm)} km in the snapshot's elements.`;
