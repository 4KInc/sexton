// The four read-only tools of the Sexton MCP server, as plain functions that return text.
// They read data/register.json and the case files in data/cases/. No network, no writes.
// Every sentence comes from src/ui/copy.ts, src/ui/ledger-text.ts or the lines below, and the tests
// run every output through scripts/check-language.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERDICT_NAMES } from '../../src/engine/census.ts';
import type { SatRecord, VerdictName } from '../../src/engine/types.ts';
import { parseCaseFile } from '../../src/ui/case-file.ts';
import type { CaseFile } from '../../src/ui/case-file.ts';
import { CARD, CHURCHYARD_INTRO, LEDGER, assumptionsLine, dataAge, verdictCopy } from '../../src/ui/copy.ts';
import { formatCount, formatGap, formatP, formatShare, formatSigned } from '../../src/ui/format.ts';
import { edgesOf, isRetired, ledgerText, verdictSentence } from '../../src/ui/ledger-text.ts';
import type { Retired } from '../../src/ui/ledger-text.ts';
import { isRegister } from '../../src/ui/register.ts';
import type { UiRegister } from '../../src/ui/register.ts';

/** What a tool gives back. `ok: false` is a plain error message for the person asking. */
export interface ToolOutput {
  ok: boolean;
  text: string;
}

/** Where the data lives. */
export interface Paths {
  registerPath: string;
  casesDir: string;
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

/** The default paths under a project root. */
export const pathsFor = (root: string): Paths => ({ registerPath: join(root, 'data', 'register.json'), casesDir: join(root, 'data', 'cases') });

const fail = (text: string): ToolOutput => ({ ok: false, text });
const done = (text: string): ToolOutput => ({ ok: true, text });

/** Reads and checks the register. Returns an error output when the file is missing or is not a register. */
export function loadRegister(paths: Paths): UiRegister | ToolOutput {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(paths.registerPath, 'utf8'));
  } catch (e) {
    return fail(`The register could not be read from ${paths.registerPath}: ${(e as Error).message}`);
  }
  if (!isRegister(value)) return fail(`The file ${paths.registerPath} is not a Sexton register (schema 1).`);
  return value;
}

const isOutput = (x: UiRegister | ToolOutput): x is ToolOutput => 'ok' in x && 'text' in x;

/** The case file for a record, or a note saying it could not be read. Case files are read only when the register says one exists. */
function caseFileFor(r: SatRecord, paths: Paths): { file?: CaseFile; note?: string } {
  if (!r.caseFile) return {};
  const path = join(paths.casesDir, `${r.norad}.md`);
  try {
    return { file: parseCaseFile(path, readFileSync(path, 'utf8')) };
  } catch (e) {
    return { note: `The register lists a case file for NORAD ${r.norad}, but it could not be read: ${(e as Error).message}` };
  }
}

/** What every total or share is read against. */
const blindSpot = (): string => CHURCHYARD_INTRO.blindSpot;

const dataAgeOf = (r: SatRecord): string => (r.orbitSource.kind === 'GP' ? dataAge(r) : LEDGER.satcatSource);

/** A distance from a band edge with its sign: "+103.4 km" is above the edge, "−12.0 km" is below it. */
function margin(m: number, decimals: number): string {
  if (m === 0) return `0 km`;
  return `${m > 0 ? '+' : '\u2212'}${formatGap(m, decimals)} km`;
}

function checkNorad(norad: unknown): number | ToolOutput {
  if (typeof norad !== 'number' || !Number.isSafeInteger(norad) || norad < 1) {
    return fail(`"${String(norad)}" is not a NORAD id. Give a whole number such as 27378.`);
  }
  return norad;
}

/** The record for a NORAD id, or the plain "not in the register" message. */
function find(reg: UiRegister, norad: unknown): SatRecord | ToolOutput {
  const id = checkNorad(norad);
  if (typeof id !== 'number') return id;
  return reg.records.find((x) => x.norad === id) ?? fail(LEDGER.notFound(id));
}
const isRecord = (x: SatRecord | ToolOutput): x is SatRecord => 'norad' in x;

/** The sentence for an object that has no verdict. */
function noVerdictText(r: SatRecord): string {
  const reason = r.verdict.kind === 'no verdict' ? r.verdict.reason : `unmarked bones, ${r.status}`;
  return `${r.name} (NORAD ${r.norad}) has no verdict (${reason}). The register gives a verdict only to retired payloads.`;
}

/** The verdict of one object, with the numbers it rests on. Never a bare yes or no. */
export function isBuried(paths: Paths, norad: unknown): ToolOutput {
  const reg = loadRegister(paths);
  if (isOutput(reg)) return reg;
  const r = find(reg, norad);
  if (!isRecord(r)) return r;
  if (!isRetired(r)) return done(noVerdictText(r));
  const config = reg.config;
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const copy = verdictCopy(v.verdict, config);
  const lines = [
    `${r.name} (NORAD ${r.norad})`,
    `Verdict: ${copy.pair}`,
    `Buried is one of six verdicts: ${VERDICT_NAMES.join(', ')}. This object's verdict is ${v.verdict}.`,
    `Borderline: ${v.borderline ? 'yes' : 'no'}. ${v.borderline ? CARD.borderline(config) : LEDGER.notBorderline(config)}`,
    `p (perigee above GEO): ${formatP(r.pKm, r.orbitSource.kind, edgesOf(config))} km`,
    `q (apogee above GEO): ${formatSigned(r.qKm, decimals)} km`,
    `Margins: ${margin(v.margins.zone, decimals)} from the protected zone edge (${config.protectedZoneKm} km), ${margin(v.margins.low, decimals)} from the lowest threshold (${config.thresholdLowKm} km), ${margin(v.margins.high, decimals)} from the highest threshold (${config.thresholdHighKm} km). A plus sign means above the edge.`,
    `Data age: ${dataAgeOf(r)}`,
    `Snapshot: ${reg.snapshot.set}${reg.sample ? `. ${LEDGER.sampleNote}` : ''}`,
    verdictSentence(r, config),
    assumptionsLine(config),
    CHURCHYARD_INTRO.voluntary,
  ];
  return done(lines.join('\n'));
}

/** The census: verdict counts as "n of N", the borderline count, and where orbits and statuses come from. */
export function census(paths: Paths): ToolOutput {
  const reg = loadRegister(paths);
  if (isOutput(reg)) return reg;
  const c = reg.census;
  const config = reg.config;
  const total = c.retired.total;
  const retired = reg.records.filter(isRetired);
  const fromGpz = retired.filter((r) => r.statusSource === 'GPZ table').length;
  const fromSatcat = retired.filter((r) => r.statusSource === 'SATCAT').length;
  const lines = [
    `Census, snapshot set ${reg.snapshot.set}${reg.sample ? `. ${LEDGER.sampleNote}` : ''}`,
    `Objects near GEO in the register: ${formatCount(c.population.total)}`,
    `Retired payloads with a verdict: ${formatCount(total)}`,
    'Verdicts, as shares of retired payloads:',
    ...VERDICT_NAMES.map((v: VerdictName) => `- ${v}: ${formatShare(c.retired.byVerdict[v], total)}`),
    `Borderline (perigee within ${config.uncertaintyKm} km of a band edge): ${formatShare(c.retired.borderline.yes, total)}`,
    'Where the orbit comes from:',
    `- GP mean elements: ${formatShare(c.retired.orbitSource.GP, total)}`,
    `- SATCAT whole-km altitudes: ${formatShare(c.retired.orbitSource.SATCAT, total)}`,
    'Where the status comes from:',
    `- SATCAT: ${formatShare(fromSatcat, total)}`,
    `- GPZ table: ${formatShare(fromGpz, total)}`,
    assumptionsLine(config),
    CHURCHYARD_INTRO.voluntary,
    blindSpot(),
  ];
  return done(lines.join('\n'));
}

/** The ledger text for one object, with the case file when there is one. */
export function explain(paths: Paths, norad: unknown): ToolOutput {
  const reg = loadRegister(paths);
  if (isOutput(reg)) return reg;
  const r = find(reg, norad);
  if (!isRecord(r)) return r;
  if (!isRetired(r)) return done(noVerdictText(r));
  const { file, note } = caseFileFor(r, paths);
  return done(ledgerText(r, reg, file) + (note === undefined ? '' : `\n\n${note}`));
}

/** One line of a list. */
function listLine(r: Retired, reg: UiRegister): string {
  const p = formatP(r.pKm, r.orbitSource.kind, edgesOf(reg.config));
  return `${r.norad}  ${r.name}  p ${p} km${r.verdict.borderline ? '  borderline' : ''}`;
}

/** Objects with one verdict, by NORAD id, capped, with the total. */
export function list(paths: Paths, verdict: unknown, limit?: unknown): ToolOutput {
  const reg = loadRegister(paths);
  if (isOutput(reg)) return reg;
  const word = typeof verdict === 'string' ? verdict.trim().toLowerCase() : '';
  const name = VERDICT_NAMES.find((v) => v === word);
  if (name === undefined) {
    return fail(`"${String(verdict)}" is not a verdict. The six verdicts are: ${VERDICT_NAMES.join(', ')}.`);
  }
  let cap = DEFAULT_LIST_LIMIT;
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      return fail(`"${String(limit)}" is not a valid limit. Give a whole number from 1 to ${MAX_LIST_LIMIT}.`);
    }
    cap = limit;
  }
  const hits = reg.records.filter(isRetired).filter((r) => r.verdict.verdict === name).sort((a, b) => a.norad - b.norad);
  const shown = hits.slice(0, cap);
  const retiredTotal = reg.census.retired.total;
  const lines = [
    `Verdict ${name}: ${formatShare(hits.length, retiredTotal)} retired payloads. Snapshot set ${reg.snapshot.set}.`,
    hits.length === 0
      ? 'No object has this verdict.'
      : `Showing ${formatCount(shown.length)} of ${formatCount(hits.length)}, sorted by NORAD id.${hits.length > shown.length ? ' Raise limit to see more.' : ''}`,
    ...shown.map((r) => listLine(r, reg)),
    assumptionsLine(reg.config),
    blindSpot(),
  ];
  return done(lines.join('\n'));
}
