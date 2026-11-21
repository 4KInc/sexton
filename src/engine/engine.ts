// runEngine (design 2.3): parse, merge, classify, count. Pure: no DOM, network, fs or clock.
// It never throws (R1.12). A problem becomes a rejection.
import { buildCensus } from './census.ts';
import { classify } from './classify.ts';
import { CONFIG } from './config.ts';
import type { Config } from './config.ts';
import { parseGp } from './gp.ts';
import { parseGpzTable } from './gpz-table.ts';
import { mergeSources } from './merge.ts';
import { parseSatcat } from './satcat.ts';
import type { Census, Rejection, SatRecord } from './types.ts';
import { isIsoDate } from './values.ts';

export interface EngineInput {
  /** Absent until SATCAT is downloaded. */
  satcatCsv?: string;
  gpzCsv?: string;
  gpzTableHtml?: string;
  /** ISO date, passed in (no clock). */
  snapshotDate: string;
}

export interface EngineResult {
  records: SatRecord[];
  rejections: Rejection[];
  noOrbitDataCount: number;
  census: Census;
}

const ENGINE_SOURCE = 'engine';

function emptyResult(snapshotDate: string, rejections: Rejection[]): EngineResult {
  return {
    records: [],
    rejections,
    noOrbitDataCount: 0,
    census: buildCensus([], { snapshotDate, outsidePopulation: 0, rejectedRows: rejections.length, noOrbitData: 0 }),
  };
}

export function runEngine(input: EngineInput, config: Config = CONFIG): EngineResult {
  const snapshotDate = String(input?.snapshotDate);
  try {
    if (!isIsoDate(snapshotDate)) {
      return emptyResult(snapshotDate, [{ source: ENGINE_SOURCE, line: 0, reason: 'snapshotDate is not YYYY-MM-DD' }]);
    }
    const satcat = typeof input.satcatCsv === 'string' ? parseSatcat(input.satcatCsv, config) : null;
    const gp = typeof input.gpzCsv === 'string' ? parseGp(input.gpzCsv) : null;
    const table = typeof input.gpzTableHtml === 'string' ? parseGpzTable(input.gpzTableHtml) : null;

    const rejections = [...(satcat?.rejections ?? []), ...(gp?.rejections ?? []), ...(table?.rejections ?? [])];
    const noOrbitDataCount = satcat?.noOrbitDataCount ?? 0;

    const merged = mergeSources({ satcat: satcat?.rows ?? null, gp: gp?.rows ?? [], table: table?.rows ?? [] }, snapshotDate);
    const records: SatRecord[] = merged.records.map((m) => ({ ...m, verdict: classify(m, snapshotDate, config), caseFile: false }));

    return {
      records,
      rejections,
      noOrbitDataCount,
      census: buildCensus(records, {
        snapshotDate,
        outsidePopulation: merged.outsidePopulation,
        rejectedRows: rejections.length,
        noOrbitData: noOrbitDataCount,
      }),
    };
  } catch (error) {
    const reason = `unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    return emptyResult(snapshotDate, [{ source: ENGINE_SOURCE, line: 0, reason }]);
  }
}
