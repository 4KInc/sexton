// The ledger's sentences and its plain-text form. Pure, with no DOM, no Vite and no network, so the
// ledger view, the tests and the MCP server (scripts/mcp/) all use the same words.
import type { Config } from '../engine/config.ts';
import type { ObjectKind, SatRecord, VerdictName } from '../engine/types.ts';
import type { CaseFile } from './case-file.ts';
import { CARD, CHURCHYARD_INTRO, ECC_NOTE_BAND, LEDGER, assumptionsLine, dataAge, verdictCopy } from './copy.ts';
import { formatE, formatGap, formatP, formatSigned, MINUS } from './format.ts';
import type { UiRegister } from './register.ts';
import { SCALE, offScale } from './svg/scale.ts';

export type Retired = SatRecord & { verdict: Extract<SatRecord['verdict'], { kind: 'verdict' }> };
export const isRetired = (r: SatRecord): r is Retired => r.verdict.kind === 'verdict';

export const edgesOf = (c: Config): number[] => [c.protectedZoneKm, c.thresholdLowKm, c.thresholdHighKm];

/** "+110.4" becomes "110.4 km above GEO", and "\u221289.6" becomes "89.6 km below GEO". */
function height(signedText: string): string {
  return signedText.startsWith(MINUS) ? `${signedText.slice(1)} km below GEO` : `${signedText.replace('+', '')} km above GEO`;
}

/** A distance from an edge: "136.6 km below 247 km", or "exactly at 247 km". */
export function against(margin: number, edgeKm: number, decimals: number): string {
  if (margin === 0) return `exactly at ${edgeKm} km`;
  return `${formatGap(margin, decimals)} km ${margin > 0 ? 'above' : 'below'} ${edgeKm} km`;
}

/** The verdict in plain words, with the numbers filled in. */
export function verdictSentence(r: Retired, config: Config): string {
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const ph = height(formatP(r.pKm, r.orbitSource.kind, edgesOf(config)));
  const qh = height(formatSigned(r.qKm, decimals));
  const e = formatE(r.e, config.iadc.eccentricityMax);
  const limit = config.iadc.eccentricityMax;
  const [zone, low, high] = [config.protectedZoneKm, config.thresholdLowKm, config.thresholdHighKm];
  const stated = 'is below the IADC disposal threshold under the stated assumptions';
  const byVerdict: Record<VerdictName, string> = {
    fallen: `Its whole orbit is below the protected zone (±${zone} km). Its apogee is ${qh} and its perigee is ${ph}. Its perigee ${stated}.`,
    unquiet: `Its perigee is ${ph}. Its orbit reaches the protected zone (±${zone} km). Its perigee ${stated}.`,
    'shallow grave': `Its perigee is ${ph}, above the protected zone (±${zone} km) but below ${low} km, the lowest threshold in the assumed range. Its perigee ${stated}.`,
    restless: `Its perigee is ${ph}, at or above ${low} km, the lowest threshold in the assumed range. Its eccentricity is ${e}, above the IADC limit of ${limit}.`,
    uncertain: `Its perigee is ${ph}, inside the IADC threshold band of ${low} to ${high} km. Whether it is above the IADC disposal threshold depends on C_R·A/m, which is not known. Its eccentricity is ${e}, within the limit of ${limit}.`,
    buried: `Its perigee is ${ph}, at or above ${high} km, the highest threshold in the assumed range. It is above the IADC disposal threshold for every assumed C_R·A/m. Its eccentricity is ${e}, within the limit of ${limit}.`,
  };
  return byVerdict[r.verdict.verdict];
}

/** True for a SATCAT-only orbit whose eccentricity is close enough to the limit that whole-km rounding can decide it. */
export function eccentricityRoundingMatters(r: SatRecord, config: Config): boolean {
  if (r.verdict.kind !== 'verdict' || r.orbitSource.kind !== 'SATCAT') return false;
  // Eccentricity only decides the verdict when the perigee is at or above the lowest threshold.
  if (r.pKm < config.thresholdLowKm) return false;
  return Math.abs(r.e - config.iadc.eccentricityMax) <= ECC_NOTE_BAND;
}

const GPZ_VALUE: Partial<Record<ObjectKind, string>> = { 'retired payload': 'retired', 'living payload': 'living' };

/** The GPZ table code for a kind, such as "PAY-". */
function tableCode(kind: ObjectKind, config: Config): string {
  const want = GPZ_VALUE[kind] ?? kind;
  const hit = Object.entries(config.gpzTableStatus).find(([, v]) => v === want);
  return hit === undefined ? kind : hit[0];
}

/** The sentences for section 7. */
export function statusLines(r: SatRecord, config: Config): string[] {
  const d = r.disagreement;
  if (r.statusSource === 'GPZ table') {
    const code = tableCode(r.status, config);
    return [d !== null && d.satcat === 'unknown' ? LEDGER.statusGapSatcat(code) : LEDGER.statusNoSatcat(code), LEDGER.statusFrom(r.status, 'the GPZ table')];
  }
  const lines = [LEDGER.statusFrom(r.status, 'SATCAT')];
  if (d !== null) lines.push(LEDGER.statusDisagree(d.satcat, d.gpzTable, tableCode(d.gpzTable, config)));
  return lines;
}

/** The orbit notes of section 5: where the numbers come from, and what rounding or the drawn scale does to them. */
export function orbitNotes(r: Retired, config: Config): string[] {
  const notes: string[] = [r.orbitSource.kind === 'GP' ? LEDGER.gpOrbit : LEDGER.satcatOrbit];
  if (eccentricityRoundingMatters(r, config)) notes.push(LEDGER.eccentricityRounding(formatE(r.e, config.iadc.eccentricityMax), config.iadc.eccentricityMax));
  const off = offScale(r.pKm);
  if (off === 'above') notes.push(LEDGER.offScaleAbove(SCALE.maxKm));
  else if (off === 'below') notes.push(LEDGER.offScaleBelow(SCALE.minKm));
  else if (r.pKm > SCALE.linearMaxKm) notes.push(LEDGER.highGround(SCALE.linearMaxKm));
  return notes;
}

/** The three margins as sentences: "136.6 km below 247 km", and so on. */
export function marginsSentence(r: Retired, config: Config): string {
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const m = r.verdict.margins;
  const pText = formatP(r.pKm, r.orbitSource.kind, edgesOf(config));
  return `p = ${pText} km. That is ${against(m.low, config.thresholdLowKm, decimals)}, ${against(m.high, config.thresholdHighKm, decimals)}, and ${against(m.zone, config.protectedZoneKm, decimals)}, the edge of the protected zone.`;
}

/** The ledger as plain text: the same sections and sentences as the page, with no markup. */
export function ledgerText(r: Retired, reg: UiRegister, caseFile?: CaseFile): string {
  const config = reg.config;
  const v = r.verdict;
  const decimals = r.orbitSource.kind === 'GP' ? 1 : 0;
  const pText = formatP(r.pKm, r.orbitSource.kind, edgesOf(config));
  const F = LEDGER.fields;
  const H = LEDGER.headings;
  const block = (title: string, lines: readonly string[]): string => `${title}\n${lines.join('\n')}`;
  const parts: string[] = [
    `${LEDGER.printTitle}: NORAD ${r.norad}`,
    block(H.identity, [
      `${F.name}: ${r.name}`,
      `${F.norad}: ${r.norad}`,
      `${F.designator}: ${r.intlDes ?? LEDGER.notGiven}`,
      `${F.owner}: ${r.owner ?? LEDGER.notGiven}`,
      `${F.launch}: ${r.launchDate ?? LEDGER.unknown}`,
      ...(v.era === 'before FCC rule' ? [CARD.beforeRule] : []),
    ]),
    block(H.verdict, [verdictCopy(v.verdict, config).pair, verdictSentence(r, config)]),
    block(H.maths, [
      `${LEDGER.formula(config)} ${LEDGER.range(config)}`,
      marginsSentence(r, config),
      `Eccentricity e = ${formatE(r.e, config.iadc.eccentricityMax)}. The IADC limit is ${config.iadc.eccentricityMax}.`,
    ]),
    block(H.assumptions, [assumptionsLine(config), LEDGER.assumedRanges(config), v.borderline ? CARD.borderline(config) : LEDGER.notBorderline(config)]),
    block(H.orbit, [
      r.orbitSource.kind === 'GP' ? dataAge(r) : LEDGER.satcatSource,
      `${F.perigee}: ${pText} km`,
      `${F.apogee}: ${formatSigned(r.qKm, decimals)} km`,
      `${F.eccentricity}: ${formatE(r.e, config.iadc.eccentricityMax)}`,
      ...orbitNotes(r, config),
    ]),
    block(H.snapshot, [LEDGER.snapshotLine(reg.snapshot.set), ...(reg.sample ? [LEDGER.sampleNote] : [])]),
    block(H.status, statusLines(r, config)),
  ];
  if (r.caseFile && caseFile !== undefined) {
    parts.push(block(H.caseFile, [...(caseFile.provisional ? [LEDGER.provisional] : []), caseFile.title, '', caseFile.body]));
  }
  parts.push(block(H.context, [CHURCHYARD_INTRO.voluntary, CHURCHYARD_INTRO.noRetirementDate]));
  return parts.join('\n\n');
}
