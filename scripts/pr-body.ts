// Writes the pull request body for the snapshot refresh workflow (design 8.2). Reads files only.
// Run: node scripts/pr-body.ts --old <register.json> --new <register.json> --set <data/raw/date dir>
// It prints Markdown: each source's status code, byte size and sha256 from the set's manifest,
// then the census diff (old and new verdict counts).
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isMain } from './is-main.ts';

interface ManifestEntry {
  file: string;
  httpStatus: number | null;
  bytes: number;
  sha256: string | null;
}
interface Manifest {
  entries: ManifestEntry[];
}
interface RegisterLike {
  snapshot?: { set?: string };
  census?: { retired?: { total?: number; byVerdict?: Record<string, number> } };
}

/** The last manifest entry for each file, in the order the files first appear. */
export function lastEntryPerFile(manifest: Manifest): ManifestEntry[] {
  const byFile = new Map<string, ManifestEntry>();
  for (const e of manifest.entries) byFile.set(e.file, e);
  return [...byFile.values()];
}

function verdictCounts(r: RegisterLike): Record<string, number> {
  return r.census?.retired?.byVerdict ?? {};
}

export function buildPrBody(oldRegister: RegisterLike, newRegister: RegisterLike, manifest: Manifest, setName: string): string {
  const lines: string[] = [];
  lines.push(`Snapshot refresh for ${setName}. Made by the refresh-snapshot workflow. Review the numbers before merging.`);
  lines.push('');
  lines.push('## Downloads');
  lines.push('');
  lines.push('| File | HTTP status | Bytes | sha256 |');
  lines.push('| --- | --- | --- | --- |');
  for (const e of lastEntryPerFile(manifest)) {
    lines.push(`| ${e.file} | ${e.httpStatus === null ? 'none' : e.httpStatus} | ${e.bytes} | ${e.sha256 === null ? 'none' : `\`${e.sha256}\``} |`);
  }
  lines.push('');
  lines.push('## Census diff (retired payloads)');
  lines.push('');
  const before = verdictCounts(oldRegister);
  const after = verdictCounts(newRegister);
  const names = [...new Set([...Object.keys(after), ...Object.keys(before)])];
  lines.push(`Old register: snapshot ${oldRegister.snapshot?.set ?? 'unknown'}. New register: snapshot ${newRegister.snapshot?.set ?? 'unknown'}.`);
  lines.push('');
  lines.push('| Verdict | Old | New | Change |');
  lines.push('| --- | --- | --- | --- |');
  for (const name of names) {
    const o = before[name] ?? 0;
    const n = after[name] ?? 0;
    lines.push(`| ${name} | ${o} | ${n} | ${n - o > 0 ? '+' : ''}${n - o} |`);
  }
  const oldTotal = oldRegister.census?.retired?.total ?? 0;
  const newTotal = newRegister.census?.retired?.total ?? 0;
  lines.push(`| total | ${oldTotal} | ${newTotal} | ${newTotal - oldTotal > 0 ? '+' : ''}${newTotal - oldTotal} |`);
  lines.push('');
  if (newRegister.snapshot?.set !== setName) {
    lines.push(
      `The register was not rebuilt from ${setName}, because that set is not complete. It still reads snapshot ${newRegister.snapshot?.set ?? 'unknown'}. The downloads are committed so they are not lost.`,
    );
    lines.push('');
  }
  lines.push('The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.');
  return lines.join('\n') + '\n';
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function main(argv: string[]): number {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined || (flag !== '--old' && flag !== '--new' && flag !== '--set')) {
      console.error('Usage: node scripts/pr-body.ts --old <register.json> --new <register.json> --set <snapshot dir>');
      return 2;
    }
    args.set(flag, resolve(value));
  }
  const oldPath = args.get('--old');
  const newPath = args.get('--new');
  const setDir = args.get('--set');
  if (oldPath === undefined || newPath === undefined || setDir === undefined) {
    console.error('Usage: node scripts/pr-body.ts --old <register.json> --new <register.json> --set <snapshot dir>');
    return 2;
  }
  const manifestPath = join(setDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest.json in ${setDir}.`);
    return 1;
  }
  const setName = setDir.split('/').filter(Boolean).pop() ?? setDir;
  process.stdout.write(buildPrBody(readJson(oldPath), readJson(newPath), readJson(manifestPath), setName));
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
