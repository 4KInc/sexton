// Downloads the CelesTrak data sets into data/raw/<UTC date>/.
// Policy (see .kiro/steering/tech.md): gzip, FORMAT=csv, at most one download
// per data set per 2 hours, stop on any non-200, no retries, and after a
// 500 or 503 wait at least 15 minutes before trying that data set again.
//
// Resumes: a data set is fetched only if no manifest in data/raw has a
// download of its URL younger than 2 hours. A download is a 200 entry or a
// failed partial body (headers arrived, body did not finish). New entries are appended to the
// manifest of today's set, so earlier entries are kept.
//
// Run: node scripts/snapshot.ts

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_INTERVAL_MS = 2 * 60 * 60 * 1000;
const AFTER_SERVER_ERROR_MS = 15 * 60 * 1000;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'data', 'raw');

interface Source {
  file: string;
  url: string;
}

const SOURCES: Source[] = [
  { file: 'gpz.csv', url: 'https://celestrak.org/NORAD/elements/gp.php?SPECIAL=GPZ&FORMAT=csv' },
  { file: 'table-gpz.csv', url: 'https://celestrak.org/NORAD/elements/table.php?SPECIAL=gpz&FORMAT=csv' },
  { file: 'satcat.csv', url: 'https://celestrak.org/pub/satcat.csv' },
];

interface ManifestEntry {
  file: string;
  url: string;
  fetchedAt: string;
  httpStatus: number | null;
  contentEncoding: string | null;
  bytes: number;
  sha256: string | null;
  partialBody?: boolean;
  error?: string;
}

interface Manifest {
  startedAt: string;
  complete: boolean;
  entries: ManifestEntry[];
}

function allEntries(): ManifestEntry[] {
  if (!existsSync(RAW_DIR)) return [];
  const entries: ManifestEntry[] = [];
  for (const dir of readdirSync(RAW_DIR)) {
    const path = join(RAW_DIR, dir, 'manifest.json');
    if (!existsSync(path)) continue;
    entries.push(...(JSON.parse(readFileSync(path, 'utf8')) as Manifest).entries);
  }
  return entries;
}

// Older entries have no partialBody field. undici reports a body that failed
// after the headers arrived as "TypeError: terminated".
function isPartialBody(e: ManifestEntry): boolean {
  return e.partialBody === true || (e.httpStatus === null && (e.error ?? '').startsWith('TypeError: terminated'));
}

type Plan = { action: 'fetch' } | { action: 'skip'; reason: string } | { action: 'wait'; reason: string };

function plan(source: Source, entries: ManifestEntry[], now: number): Plan {
  const mine = entries.filter((e) => e.url === source.url);
  const recent = (e: ManifestEntry) => now - Date.parse(e.fetchedAt) < MIN_INTERVAL_MS;
  const recentOk = mine.find((e) => e.httpStatus === 200 && recent(e));
  if (recentOk) return { action: 'skip', reason: `have a 200 from ${recentOk.fetchedAt}` };
  const recentPartial = mine.find((e) => isPartialBody(e) && recent(e));
  if (recentPartial) {
    const minutes = Math.ceil((MIN_INTERVAL_MS - (now - Date.parse(recentPartial.fetchedAt))) / 60000);
    return { action: 'wait', reason: `partial body at ${recentPartial.fetchedAt} counts as a download; wait ${minutes} more minutes` };
  }
  const serverError = mine.find(
    (e) => (e.httpStatus === 500 || e.httpStatus === 503) && now - Date.parse(e.fetchedAt) < AFTER_SERVER_ERROR_MS,
  );
  if (serverError) {
    const minutes = Math.ceil((AFTER_SERVER_ERROR_MS - (now - Date.parse(serverError.fetchedAt))) / 60000);
    return { action: 'wait', reason: `got ${serverError.httpStatus} at ${serverError.fetchedAt}; wait ${minutes} more minutes` };
  }
  return { action: 'fetch' };
}

async function download(source: Source, outDir: string): Promise<ManifestEntry> {
  const fetchedAt = new Date().toISOString();
  // Headers can arrive before the body fails, so keep the status if we got one.
  let headerStatus: number | null = null;
  let headerEncoding: string | null = null;
  try {
    // fetch sends Accept-Encoding: gzip and decodes the body for us.
    const response = await fetch(source.url, {
      headers: { 'Accept-Encoding': 'gzip', 'User-Agent': 'sexton-snapshot (https://github.com/4KInc/sexton)' },
      redirect: 'error',
    });
    headerStatus = response.status;
    headerEncoding = response.headers.get('content-encoding');
    const ok = response.status === 200;
    const body = ok ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
    if (ok) writeFileSync(join(outDir, source.file), body);
    return {
      file: source.file,
      url: source.url,
      fetchedAt,
      httpStatus: response.status,
      contentEncoding: response.headers.get('content-encoding'),
      bytes: body.length,
      sha256: ok ? createHash('sha256').update(body).digest('hex') : null,
    };
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    return {
      file: source.file,
      url: source.url,
      fetchedAt,
      httpStatus: null,
      contentEncoding: headerEncoding,
      bytes: 0,
      sha256: null,
      partialBody: headerStatus !== null,
      error:
        String(error) +
        (cause ? ` (cause: ${String(cause)})` : '') +
        (headerStatus !== null ? ` after headers with HTTP ${headerStatus}; body incomplete` : ''),
    };
  }
}

async function main(): Promise<void> {
  const now = Date.now();
  const entries = allEntries();

  const outDir = join(RAW_DIR, new Date(now).toISOString().slice(0, 10));
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  const manifest: Manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest)
    : { startedAt: new Date(now).toISOString(), complete: false, entries: [] };
  const writeManifest = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  for (const source of SOURCES) {
    const decision = plan(source, entries, now);
    if (decision.action === 'skip') {
      console.log(`skip ${source.file}: ${decision.reason}`);
      continue;
    }
    if (decision.action === 'wait') {
      console.error(`Stopping: ${source.file} ${decision.reason}.`);
      process.exit(2);
    }
    const entry = await download(source, outDir);
    manifest.entries.push(entry);
    writeManifest();
    console.log(`${entry.httpStatus ?? 'ERR'} ${entry.bytes} bytes ${source.file}`);
    if (entry.httpStatus !== 200) {
      console.error(`Stopping: ${source.url} did not return 200. No retries.`);
      process.exit(1);
    }
  }

  // Complete when every current source has a 200 entry in this set.
  manifest.complete = SOURCES.every((s) =>
    manifest.entries.some((e) => e.url === s.url && e.httpStatus === 200 && existsSync(join(outDir, e.file))),
  );
  writeManifest();
  console.log(`Saved to ${outDir} (complete: ${manifest.complete})`);
}

await main();
