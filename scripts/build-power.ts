// Builds the Sexton Kiro power's files (R17, design 14): the MCP server as one file that runs under plain `node`, and the data it reads.
//   node scripts/build-power.ts           write powers/sexton/server/sexton-mcp.mjs, data/register.json and data/cases/*.md
//   node scripts/build-power.ts --check   write nothing; exit 1 if any of them is out of date
// The power is installed from a folder, so it must not reach back into the repository: the server, the register and the case files travel with it.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { isMain } from './is-main.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const POWER = join(ROOT, 'powers', 'sexton');
export const BUNDLE = join(POWER, 'server', 'sexton-mcp.mjs');

/** The server and everything it imports (the MCP SDK, zod and the repository's own modules) as one ES module, and the packages inside it. Node's own modules stay external. */
export async function bundle(): Promise<{ code: string; packages: string[] }> {
  const result = await build({
    root: ROOT,
    configFile: false,
    logLevel: 'silent',
    ssr: { noExternal: true },
    build: { ssr: join(ROOT, 'scripts/mcp/server.ts'), write: false, minify: false, target: 'node24', rolldownOptions: { output: { format: 'es', entryFileNames: 'sexton-mcp.mjs', codeSplitting: false } } },
  });
  type Chunk = { type: string; code?: string; modules?: Record<string, unknown> };
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => (r as { output: Chunk[] }).output);
  const chunk = outputs.find((o) => o.type === 'chunk');
  if (chunk?.code === undefined) throw new Error('the bundle has no chunk');
  const packages = new Set<string>();
  for (const id of Object.keys(chunk.modules ?? {})) {
    const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id.replaceAll('\\', '/'));
    if (m !== null) packages.add(m[1]!);
  }
  return { code: chunk.code, packages: [...packages].sort() };
}

/** The licence notices of the packages inside the bundle. MIT, BSD and ISC licences ask that the notice travel with the copy. */
export function noticesText(packages: readonly string[]): string {
  const parts = packages.map((name) => {
    const dir = join(ROOT, 'node_modules', name);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string; license: string };
    const file = readdirSync(dir).find((n) => /^licen[sc]e(\.\w+)?$/i.test(n));
    if (file === undefined) throw new Error(`${name} has no licence file`);
    return `==== ${name} ${pkg.version} (${pkg.license}) ====\n${readFileSync(join(dir, file), 'utf8').trim()}\n`;
  });
  return `Packages bundled into sexton-mcp.mjs, with their licence notices.\n\n${parts.join('\n')}`;
}

/** Every file the power needs from the repository: path inside the power, and its text. */
export async function powerFiles(): Promise<Map<string, string | Buffer>> {
  const files = new Map<string, string | Buffer>();
  const { code, packages } = await bundle();
  files.set('server/sexton-mcp.mjs', code);
  files.set('server/THIRD_PARTY_LICENSES.txt', noticesText(packages));
  files.set('data/register.json', readFileSync(join(ROOT, 'data', 'register.json')));
  for (const name of readdirSync(join(ROOT, 'data', 'cases')).filter((n) => n.endsWith('.md')).sort()) files.set(`data/cases/${name}`, readFileSync(join(ROOT, 'data', 'cases', name)));
  return files;
}

/** The files under the power's `server/` and `data/` folders as they are on disk now. */
export function onDisk(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) (e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : out.add(`${prefix}${e.name}`));
  };
  walk(join(POWER, 'server'), 'server/');
  walk(join(POWER, 'data'), 'data/');
  return out;
}

/** What is out of date: files that differ, are missing or should not be there. */
export async function stale(): Promise<string[]> {
  const want = await powerFiles();
  const have = onDisk();
  const out: string[] = [];
  for (const [path, content] of want) {
    const file = join(POWER, path);
    if (!existsSync(file)) out.push(`missing: ${path}`);
    else if (!readFileSync(file).equals(Buffer.from(content))) out.push(`differs: ${path}`);
  }
  for (const path of have) if (!want.has(path)) out.push(`extra: ${path}`);
  return out;
}

export async function main(argv: string[]): Promise<number> {
  if (argv.includes('--check')) {
    const out = await stale();
    for (const line of out) console.error(line);
    if (out.length > 0) console.error('Run: node scripts/build-power.ts');
    return out.length > 0 ? 1 : 0;
  }
  const want = await powerFiles();
  for (const path of onDisk()) if (!want.has(path)) rmSync(join(POWER, path));
  for (const [path, content] of want) {
    const file = join(POWER, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  console.log(`Wrote ${want.size} files under powers/sexton/ (the server, its licence notices, data/register.json and ${want.size - 3} case files).`);
  return 0;
}
if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
