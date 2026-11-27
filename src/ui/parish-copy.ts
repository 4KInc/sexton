// User-facing text of the parish register (R13). Loaded with the view, not with the first page. Every number is an argument.
import { formatCount } from './format.ts';

export const PARISH = {
  indexLead:
    'The retired payloads of one operator or one SATCAT owner code, each with its verdicts. The lists are in alphabetical order and show counts only.',
  operators: {
    heading: 'Operator (sourced)',
    note: 'An operator is named here only where a source that was opened names it. For every other payload the page says "operator not sourced". No operator is worked out from a satellite\u2019s name or its owner code.',
    none: 'No operator has been sourced yet.',
  },
  owners: {
    heading: 'SATCAT owner (country or organisation)',
    note: 'The code exactly as SATCAT gives it. A code may name a country or an organisation, and not the operator. No code is turned into a name here.',
  },
  notGiven: 'Owner not given',
  groupCount: (n: number): string => `${formatCount(n)} retired ${n === 1 ? 'payload' : 'payloads'}`,
  allGroups: 'All groups',
  printTitle: 'Parish register',
  kind: { operator: 'Operator (sourced)', owner: 'SATCAT owner (country or organisation)' },
  ownerNote: (code: string, withOperator: number, total: number): string =>
    `${code === 'unknown' ? 'SATCAT gives no owner for these payloads.' : `This is SATCAT\u2019s owner field, shown as SATCAT gives it: ${code}.`} It may name a country or an organisation, and not the operator. ${formatCount(withOperator)} of ${formatCount(total)} have a sourced operator.`,
  operatorNote: (n: number): string =>
    `${formatCount(n)} retired ${n === 1 ? 'payload' : 'payloads'} launched on or after 18 March 2002 ${n === 1 ? 'is' : 'are'} here because a source that was opened names this operator. The source is linked on each row.`,
  empty: (what: string): string => `The register has no retired payloads for ${what}.`,
  counts: {
    caption: 'Retired payloads in this group, by verdict. Each count links to the table, filtered to this group and that verdict.',
    verdict: 'Verdict',
    count: 'Retired payloads',
    of: (n: number, total: number): string => `${formatCount(n)} of ${formatCount(total)}`,
  },
  details: {
    borderline: (n: number, total: number, u: number): string => `Borderline (the perigee is within ${u} km of a band edge): ${formatCount(n)} of ${formatCount(total)}.`,
    era: 'Launch era',
    before: 'Before the FCC rule (18 March 2002)',
    after: 'On or after the FCC rule',
    unknown: 'Launch date unknown',
    source: 'Orbit source',
    gp: 'GP mean elements',
    satcat: 'SATCAT altitudes',
  },
  dataAge: (gp: { first: string; last: string; n: number } | null, satcat: number): string => {
    const stamp = (e: string): string => `${e.slice(0, 10)} ${e.slice(11, 16)} UTC`;
    const parts: string[] = [];
    if (gp !== null) parts.push(gp.first === gp.last ? `GP mean elements, epoch ${stamp(gp.first)}, for ${formatCount(gp.n)}` : `GP mean elements, epochs from ${stamp(gp.first)} to ${stamp(gp.last)}, for ${formatCount(gp.n)}`);
    if (satcat > 0) parts.push(`SATCAT, element date not given, for ${formatCount(satcat)}`);
    return `Data age: ${parts.join('; ')}.`;
  },
  snapshot: (date: string): string => `Snapshot: ${date}.`,
  rows: {
    caption: 'The retired payloads in this group',
    name: 'Name',
    norad: 'NORAD id',
    launch: 'Launch date',
    verdict: 'Verdict',
    p: 'Perigee above GEO (km)',
    age: 'Data age',
    operator: 'Operator',
    source: 'Operator source',
    notSourced: 'operator not sourced',
    outOfScope: 'not looked for (launched before 18 March 2002)',
    unknownLaunch: 'unknown',
  },
  relation: (name: string, relation: string): string => (relation === 'operator' ? name : `${name} (${relation})`),
  csv: 'Download CSV',
  json: 'Download JSON',
  print: 'Print',
  caveats: {
    counts: 'These counts are not all of a group\u2019s satellites. The register sees only the retired payloads still near GEO.',
  },
  csvColumns: [
    'Row',
    'Group kind',
    'Group',
    'Name',
    'NORAD id',
    'SATCAT owner',
    'Operator',
    'Operator relation',
    'Operator source',
    'Launch date',
    'Verdict',
    'Borderline',
    'Perigee above GEO (km)',
    'Apogee above GEO (km)',
    'Eccentricity',
    'Orbit source',
    'Data age',
    'Snapshot',
    'C_R·A/m range (m²/kg)',
    'Mean-element uncertainty (km)',
  ],
} as const;
