// Sexton MCP server (stdio). Read-only: it reads data/register.json and data/cases/*.md, makes no
// network calls and writes no files. Run it with plain node:
//   node scripts/mcp/server.ts
//   node scripts/mcp/server.ts --register <file> --cases <dir>     (for tests)
// Nothing but MCP messages may go to stdout. Notes for people go to stderr.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { isMain } from '../is-main.ts';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, census, explain, isBuried, list, parish, pathsFor } from './tools.ts';
import type { Paths, ToolOutput } from './tools.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SERVER_NAME = 'sexton';
export const SERVER_VERSION = '0.0.0';

/** The five tools, by name. The README and .kiro/settings/mcp.json (autoApprove) list the same names. */
export const TOOL_NAMES = ['is_buried', 'census', 'explain', 'list', 'parish'] as const;

const INSTRUCTIONS =
  'Sexton is a register of retired geostationary satellites. Each retired payload has one of six verdicts: ' +
  'fallen, unquiet, shallow grave, restless, uncertain, buried. Always report the verdict word, never only yes or no. ' +
  'Verdicts rest on stated assumptions and on data of a stated age. The IADC guidelines are voluntary. ' +
  'The register only sees objects still near GEO.';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const reply = (out: ToolOutput) => ({ content: [{ type: 'text' as const, text: out.text }], ...(out.ok ? {} : { isError: true }) });

/** Builds the server. `paths` says where the register and case files are. */
export function createServer(paths: Paths = pathsFor(ROOT)): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  const noradField = z.number().int().min(1).describe('NORAD catalogue id of the object, for example 27378 (EchoStar-7).');

  server.registerTool(
    'is_buried',
    {
      title: 'Is this satellite buried?',
      description:
        'Gives the verdict for one retired payload, found by NORAD id. "Buried" is one of six verdicts (fallen, unquiet, shallow grave, restless, uncertain, buried), ' +
        'so the answer is a verdict word, never a yes or no. The reply also gives the borderline flag, p (perigee above GEO) and q (apogee above GEO), ' +
        'the margins to the three band edges, and the data age. Objects that are not retired payloads have no verdict, and the reply says so.',
      inputSchema: { norad: noradField },
      annotations: { title: 'Is this satellite buried?', ...READ_ONLY },
    },
    ({ norad }) => reply(isBuried(paths, norad)),
  );

  server.registerTool(
    'census',
    {
      title: 'Register census',
      description:
        'Counts for the whole register: retired payloads by verdict as "n of N", the borderline count, ' +
        'the share of orbits from GP mean elements and from SATCAT whole-km altitudes, the share of statuses from SATCAT and from the GPZ table, and the snapshot set. ' +
        'Takes no input. The reply says what the register cannot see.',
      inputSchema: {},
      annotations: { title: 'Register census', ...READ_ONLY },
    },
    () => reply(census(paths)),
  );

  server.registerTool(
    'explain',
    {
      title: 'Explain a verdict',
      description:
        'Gives the ledger for one retired payload, found by NORAD id: the object, the verdict in plain words, the threshold maths, ' +
        'the assumptions (the C_R·A/m range and the mean-element uncertainty), the orbit source and data age, the snapshot, and the status source. ' +
        'When the register has a case file for the object, the reply includes it.',
      inputSchema: { norad: noradField },
      annotations: { title: 'Explain a verdict', ...READ_ONLY },
    },
    ({ norad }) => reply(explain(paths, norad)),
  );

  server.registerTool(
    'list',
    {
      title: 'List objects with a verdict',
      description:
        'Lists the retired payloads that have one verdict, sorted by NORAD id, with the total for that verdict. ' +
        `Shows ${DEFAULT_LIST_LIMIT} by default, and at most ${MAX_LIST_LIMIT} per call.`,
      inputSchema: {
        verdict: z.string().describe('One of: fallen, unquiet, shallow grave, restless, uncertain, buried.'),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional().describe(`How many objects to show. Default ${DEFAULT_LIST_LIMIT}, at most ${MAX_LIST_LIMIT}.`),
      },
      annotations: { title: 'List objects with a verdict', ...READ_ONLY },
    },
    ({ verdict, limit }) => reply(list(paths, verdict, limit)),
  );

  server.registerTool(
    'parish',
    {
      title: 'The disposal record of one operator or SATCAT owner code',
      description:
        'Gives the retired payloads of one operator (named only where a source that was opened names one, for example Intelsat) or of one SATCAT owner code (a country or organisation, for example JPN), ' +
        'with the six verdict counts as "n of N", the borderline count, each payload\'s verdict and perigee, the data age, the assumptions, and what the register cannot see. ' +
        'The operator list is short: it holds only payloads launched on or after 18 March 2002, so it is not all of an operator\'s satellites. A name that is not found gets the list of names.',
      inputSchema: {
        name: z.string().describe('An operator name such as "Intelsat", or a SATCAT owner code such as "JPN". Any case.'),
        kind: z.enum(['operator', 'owner']).optional().describe('Say which, when a name could be both. Default: an operator is looked for first, then an owner code.'),
      },
      annotations: { title: 'The disposal record of one operator or SATCAT owner code', ...READ_ONLY },
    },
    ({ name, kind }) => reply(parish(paths, name, kind)),
  );
  return server;
}

/** Reads `--register <file>` and `--cases <dir>` from the arguments. */
export function parseArgs(args: readonly string[]): Paths {
  const paths = pathsFor(ROOT);
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === '--register') paths.registerPath = resolve(value);
    else if (flag === '--cases') paths.casesDir = resolve(value);
    else throw new Error(`unknown argument ${flag}. Use --register <file> and --cases <dir>.`);
  }
  return paths;
}

async function main(): Promise<void> {
  const server = createServer(parseArgs(process.argv.slice(2)));
  await server.connect(new StdioServerTransport());
  console.error('sexton MCP server running on stdio (read-only).');
}

if (isMain(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(`sexton MCP server: ${(e as Error).message}`);
    process.exitCode = 1;
  });
}
