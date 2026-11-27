// Rewrites the census numbers in README.md from data/register.json.
// Runs build-register first. If that fails, prints why, exits 1 and leaves README.md unchanged.
//
// Run: node scripts/census.ts            (or: npm run census)
// Only the text between <!-- census:start --> and <!-- census:end --> changes.
// Exit codes: 0 done (README.md is current), 1 nothing was changed.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './is-main.ts';
import type { Register } from '../src/engine/types.ts';
import { CONFIG } from '../src/engine/config.ts';
import { VERDICT_NAMES } from '../src/engine/census.ts';
import { CAUSES } from '../src/ui/copy.ts';
import { main as buildRegister } from './build-register.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const START = '<!-- census:start -->';
export const END = '<!-- census:end -->';
/** The cause line in the README headline (R14.7). Optional: a README without these markers keeps no cause line. */
export const CAUSE_START = '<!-- causes:start -->';
export const CAUSE_END = '<!-- causes:end -->';
/** The README's cause line: counts only, from the register and the case files. */
export function renderCauseLine(register: Register): string {
  const k = register.causes;
  if (k === undefined || k.n === 0) return CAUSES.noGroup(CONFIG.validation.afterLaunchYear);
  return `${CAUSES.line(k.n, k.byCategory['failed in orbit or broke up before disposal'])} ${CAUSES.readme(CONFIG.validation.afterLaunchYear)}`;
}

export interface Io {
  /** Project root: where README.md, data/raw and data/register.json live. Default: this repository. */
  root?: string;
  log?: (line: string) => void;
  error?: (line: string) => void;
}

/** The markdown that goes between the markers. Counts only, with the snapshot date and what the register cannot see. */
export function renderCensus(register: Register): string {
  const c = register.census;
  const noStatus = register.records.filter((r) => r.statusSource === 'GPZ table' && r.disagreement !== null).length;
  const lines = [
    `Counts from the snapshot of ${c.snapshotDate}. Run \`npm run census\` to refresh them.`,
    '',
    `- Objects near GEO in the register: ${c.population.total}`,
    `- Retired payloads with a verdict: ${c.retired.total}`,
    ...VERDICT_NAMES.map((v) => `  - ${v}: ${c.retired.byVerdict[v]}`),
    `- Retired payloads close to a threshold (borderline): ${c.retired.borderline.yes}`,
    `- Objects where SATCAT and the GPZ table disagree on status: ${c.disagreements.total}`,
    `  - of these, SATCAT lists a payload but gives no status, so the GPZ table's status is used: ${noStatus}`,
    '',
    `Verdicts assume a C_R·A/m range of ${CONFIG.iadc.crAmMin} to ${CONFIG.iadc.crAmMax} m²/kg and a ±${CONFIG.uncertaintyKm} km uncertainty in mean elements. The IADC guidelines are voluntary. The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.`,
  ];
  return lines.join('\n');
}

/** Replaces the text between the markers. Returns null if the markers are missing, repeated or out of order. */
export function replaceBetweenMarkers(readme: string, body: string): string | null {
  return replaceBetween(readme, START, END, body);
}
/** The same, for any pair of markers. */
export function replaceBetween(readme: string, startMark: string, endMark: string, body: string): string | null {
  const start = readme.indexOf(startMark);
  const end = readme.indexOf(endMark);
  if (start === -1 || end === -1 || end < start) return null;
  if (readme.indexOf(startMark, start + 1) !== -1 || readme.indexOf(endMark, end + 1) !== -1) return null;
  return readme.slice(0, start + startMark.length) + '\n' + body + '\n' + readme.slice(end);
}

export function main(io: Io = {}): number {
  const log = io.log ?? ((line: string) => console.log(line));
  const error = io.error ?? ((line: string) => console.error(line));
  const root = io.root ?? ROOT;
  const readmePath = join(root, 'README.md');
  const registerPath = join(root, 'data', 'register.json');

  const built = buildRegister([], { root, log, error });
  if (built !== 0) {
    error(`census: build-register failed (exit ${built}), so README.md was not changed.`);
    return 1;
  }

  let register: Register;
  try {
    register = JSON.parse(readFileSync(registerPath, 'utf8')) as Register;
    if (register.census === undefined) throw new Error('no census in the file');
  } catch (e) {
    error(`census: can't read ${registerPath}: ${(e as Error).message}. README.md was not changed.`);
    return 1;
  }

  const readme = readFileSync(readmePath, 'utf8');
  const next = replaceBetweenMarkers(readme, renderCensus(register));
  if (next === null) {
    error(`census: README.md needs exactly one ${START} followed by one ${END}. README.md was not changed.`);
    return 1;
  }
  let final = next;
  if (next.includes(CAUSE_START) && next.includes(CAUSE_END)) {
    const withCauses = replaceBetween(next, CAUSE_START, CAUSE_END, renderCauseLine(register));
    if (withCauses === null) {
      error(`census: README.md needs exactly one ${CAUSE_START} followed by one ${CAUSE_END}. README.md was not changed.`);
      return 1;
    }
    final = withCauses;
  }
  if (final === readme) {
    log('README.md census is already current.');
    return 0;
  }
  const tmpPath = `${readmePath}.census.tmp`;
  writeFileSync(tmpPath, final);
  renameSync(tmpPath, readmePath);
  log(`Updated the census in README.md from ${register.census.snapshotDate}.`);
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = main();
}
