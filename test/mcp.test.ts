// The MCP server (stretch S1): each tool on the fixture register, the error cases, the language
// check over every output, and one run over real stdio through the SDK client.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkFiles, findHits } from '../scripts/check-language.ts';
import { TOOL_NAMES, createServer, parseArgs } from '../scripts/mcp/server.ts';
import { parishOf } from '../src/engine/parish.ts';
import { census, explain, isBuried, list, parish, pathsFor } from '../scripts/mcp/tools.ts';
import type { Paths, ToolOutput } from '../scripts/mcp/tools.ts';
import { VERDICT_NAMES } from '../src/engine/census.ts';
import type { SatRecord } from '../src/engine/types.ts';
import { formatShare } from '../src/ui/format.ts';
import type { UiRegister } from '../src/ui/register.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_REGISTER = join(ROOT, 'test/fixtures/register.json');
const fixture = JSON.parse(readFileSync(FIXTURE_REGISTER, 'utf8')) as UiRegister;
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;

/** Temp copy of the fixture register in which 27378 has a case file, plus that case file. */
const work = mkdtempSync(join(tmpdir(), 'sexton-mcp-'));
const withCase: UiRegister = { ...fixture, records: fixture.records.map((r) => (r.norad === 27378 ? { ...r, caseFile: true } : r)) };
const caseRegister = join(work, 'register.json');
const casesDir = join(work, 'cases');
const CASE_TEXT = 'This is test text for the case file of 27378.';
writeFileSync(caseRegister, JSON.stringify(withCase));
mkdirSync(casesDir);
writeFileSync(join(casesDir, '27378.md'), `---\nnorad: 27378\ntitle: Test case file\nprovisional: false\n---\n${CASE_TEXT}\n`);

const paths: Paths = { registerPath: FIXTURE_REGISTER, casesDir: join(ROOT, 'test/fixtures/cases') };
const casePaths: Paths = { registerPath: caseRegister, casesDir };

const retired = fixture.records.filter((r) => r.verdict.kind === 'verdict');
const noVerdict = fixture.records.filter((r) => r.verdict.kind !== 'verdict');
const verdictOf = (r: SatRecord): string => (r.verdict.kind === 'verdict' ? r.verdict.verdict : '');

/** Every output is collected here and checked against the language rules at the end. */
const outputs: string[] = [];
const seen = (out: ToolOutput): ToolOutput => {
  outputs.push(out.text);
  return out;
};

describe('is_buried', () => {
  it('gives the verdict word, the borderline flag, p, q, margins and data age for every retired fixture object', () => {
    for (const r of retired) {
      const out = seen(isBuried(paths, r.norad));
      expect(out.ok).toBe(true);
      expect(out.text).toContain(`This object's verdict is ${verdictOf(r)}.`);
      expect(out.text).toMatch(/^Verdict: [A-Z]/m);
      expect(out.text).toMatch(/^Borderline: (yes|no)\./m);
      expect(out.text).toContain('p (perigee above GEO):');
      expect(out.text).toContain('q (apogee above GEO):');
      expect(out.text).toContain('Margins:');
      expect(out.text).toContain('Data age:');
      expect(out.text).toContain('C_R·A/m');
      expect(out.text).toContain('voluntary');
      expect(out.text).not.toMatch(/^(yes|no)\b/i);
    }
  });
  it('names buried as one of six verdicts', () => {
    const out = seen(isBuried(paths, 90002));
    expect(out.text).toContain('Buried is one of six verdicts: fallen, unquiet, shallow grave, restless, uncertain, buried.');
    expect(out.text).toContain('Verdict: Buried (');
  });
  it('shows the borderline flag as the register has it', () => {
    for (const r of retired) {
      const flag = r.verdict.kind === 'verdict' && r.verdict.borderline ? 'yes' : 'no';
      expect(isBuried(paths, r.norad).text).toContain(`Borderline: ${flag}.`);
    }
  });
  it('gives the GP epoch for a GP orbit and the SATCAT note for a SATCAT orbit', () => {
    expect(seen(isBuried(paths, 27378)).text).toMatch(/Data age: GP mean elements, epoch \d{4}-\d\d-\d\d \d\d:\d\d UTC/);
    expect(seen(isBuried(paths, 90002)).text).toContain('Data age: SATCAT whole-km apogee and perigee, element date not given');
  });
  it('says plainly that an object with no verdict has none', () => {
    for (const r of noVerdict) {
      const out = seen(isBuried(paths, r.norad));
      expect(out.ok).toBe(true);
      expect(out.text).toContain(`NORAD ${r.norad}) has no verdict`);
    }
  });
});

describe('census', () => {
  const out = seen(census(paths));
  const c = fixture.census;
  it('gives each verdict as "n of N"', () => {
    expect(out.ok).toBe(true);
    for (const v of VERDICT_NAMES) expect(out.text).toContain(`- ${v}: ${formatShare(c.retired.byVerdict[v], c.retired.total)}`);
  });
  it('gives the borderline count, the orbit-source and status-source shares and the snapshot set', () => {
    expect(out.text).toContain(`Borderline (perigee within 25 km of a band edge): ${formatShare(c.retired.borderline.yes, c.retired.total)}`);
    expect(out.text).toContain(`- GP mean elements: ${formatShare(c.retired.orbitSource.GP, c.retired.total)}`);
    expect(out.text).toContain(`- SATCAT whole-km altitudes: ${formatShare(c.retired.orbitSource.SATCAT, c.retired.total)}`);
    const fromGpz = fixture.records.filter((r) => r.verdict.kind === 'verdict' && r.statusSource === 'GPZ table').length;
    expect(out.text).toContain(`- GPZ table: ${formatShare(fromGpz, c.retired.total)}`);
    expect(out.text).toContain(`- SATCAT: ${formatShare(c.retired.total - fromGpz, c.retired.total)}`);
    expect(out.text).toContain(`snapshot set ${fixture.snapshot.set}`);
  });
  it('states the assumptions, that the guidelines are voluntary, and what the register cannot see', () => {
    expect(out.text).toContain('C_R·A/m');
    expect(out.text).toContain('voluntary');
    expect(out.text).toContain('The register only sees objects still near GEO.');
  });
  it('matches the real register too', () => {
    const real = census(pathsFor(ROOT));
    expect(real.ok).toBe(true);
    expect(real.text).toContain('of 696');
  });
});

describe('explain', () => {
  it('gives the ledger with assumptions and data age', () => {
    const out = seen(explain(paths, 27378));
    expect(out.ok).toBe(true);
    for (const part of ['The object', 'The verdict', 'The threshold maths', 'Assumptions', 'Orbit source and data age', 'Snapshot and sources', 'Status source', 'Context']) {
      expect(out.text).toContain(part);
    }
    expect(out.text).toContain('C_R·A/m');
    expect(out.text).toContain('GP mean elements, epoch');
    expect(out.text).toContain('Unquiet (');
    expect(out.text).not.toContain('<');
  });
  it('has the same words as the ledger page for a SATCAT-only object', () => {
    const out = seen(explain(paths, 90002));
    expect(out.text).toContain('SATCAT whole-km apogee and perigee, element date not given');
    expect(out.text).toContain('SATCAT rounds each altitude to 1 km');
  });
  it('adds the case file when the register lists one', () => {
    const out = seen(explain(casePaths, 27378));
    expect(out.text).toContain('Case file');
    expect(out.text).toContain('Test case file');
    expect(out.text).toContain(CASE_TEXT);
  });
  it('leaves the case file out when the register lists none', () => {
    expect(explain(paths, 27378).text).not.toContain('Case file');
  });
  it('says so when a listed case file cannot be read', () => {
    const out = seen(explain({ registerPath: caseRegister, casesDir: join(work, 'missing') }, 27378));
    expect(out.ok).toBe(true);
    expect(out.text).toContain('could not be read');
  });
  it('says plainly that an object with no verdict has none', () => {
    const out = seen(explain(paths, noVerdict[0]!.norad));
    expect(out.ok).toBe(true);
    expect(out.text).toContain('has no verdict');
  });
});

describe('list', () => {
  it('lists the objects with a verdict by NORAD id, with the total', () => {
    const out = seen(list(paths, 'buried'));
    const ids = retired.filter((r) => verdictOf(r) === 'buried').map((r) => r.norad).sort((a, b) => a - b);
    expect(out.ok).toBe(true);
    expect(out.text).toContain(`Showing ${ids.length} of ${ids.length}`);
    expect(out.text).toContain(`Verdict buried: ${formatShare(ids.length, fixture.census.retired.total)} retired payloads.`);
    const shown = [...out.text.matchAll(/^(\d+) {2}/gm)].map((m) => Number(m[1]));
    expect(shown).toEqual(ids);
  });
  it('caps the list, 20 by default, and still gives the total', () => {
    const many = {
      ...fixture,
      records: Array.from({ length: 30 }, (_, i) => ({ ...retired.find((r) => verdictOf(r) === 'buried')!, norad: 100 + i })),
    };
    const file = join(work, 'many.json');
    writeFileSync(file, JSON.stringify(many));
    const p: Paths = { registerPath: file, casesDir };
    const byDefault = seen(list(p, 'buried'));
    expect(byDefault.text).toContain('Showing 20 of 30');
    expect([...byDefault.text.matchAll(/^(\d+) {2}/gm)]).toHaveLength(20);
    const three = seen(list(p, 'buried', 3));
    expect(three.text).toContain('Showing 3 of 30');
    expect([...three.text.matchAll(/^(\d+) {2}/gm)].map((m) => Number(m[1]))).toEqual([100, 101, 102]);
  });
  it('gives every verdict, and tells when none has it', () => {
    for (const v of VERDICT_NAMES) expect(seen(list(paths, v)).ok).toBe(true);
    const none = { ...fixture, records: [] };
    const file = join(work, 'none.json');
    writeFileSync(file, JSON.stringify(none));
    expect(seen(list({ registerPath: file, casesDir }, 'fallen')).text).toContain('No object has this verdict.');
  });
  it('accepts a verdict in capitals', () => {
    expect(list(paths, ' Shallow Grave ').ok).toBe(true);
  });
  it('says what the register cannot see', () => {
    expect(list(paths, 'buried').text).toContain('The register only sees objects still near GEO.');
  });
});

describe('errors', () => {
  const bad: [string, ToolOutput][] = [
    ['an unknown NORAD id in is_buried', isBuried(paths, 1)],
    ['an unknown NORAD id in explain', explain(paths, 99999999)],
    ['a negative id', isBuried(paths, -5)],
    ['a fractional id', explain(paths, 27378.5)],
    ['a text id', isBuried(paths, 'abc')],
    ['a missing id', explain(paths, undefined)],
    ['an unknown verdict', list(paths, 'dead')],
    ['an empty verdict', list(paths, '')],
    ['a verdict that is not text', list(paths, 7)],
    ['a limit of 0', list(paths, 'buried', 0)],
    ['a limit that is too large', list(paths, 'buried', 1000)],
    ['a limit that is not a number', list(paths, 'buried', 'ten')],
    ['a missing register file', census({ registerPath: join(work, 'nope.json'), casesDir })],
    ['a file that is not a register', census({ registerPath: join(ROOT, 'package.json'), casesDir })],
  ];
  for (const [label, out] of bad) {
    it(`gives a plain message for ${label}`, () => {
      seen(out);
      expect(out.ok).toBe(false);
      expect(out.text.length).toBeGreaterThan(10);
      expect(out.text).not.toMatch(/\bat .*\.ts:\d+/);
    });
  }
  it('names the six verdicts when the verdict is unknown', () => {
    expect(list(paths, 'dead').text).toContain(VERDICT_NAMES.join(', '));
  });
  it('says the register has no such object', () => {
    expect(isBuried(paths, 1).text).toBe('The register has no object with NORAD id 1.');
  });
});

describe('arguments', () => {
  it('reads --register and --cases', () => {
    const p = parseArgs(['--register', 'a.json', '--cases', 'dir']);
    expect(p.registerPath.endsWith('a.json')).toBe(true);
    expect(p.casesDir.endsWith('dir')).toBe(true);
  });
  it('defaults to data/register.json and data/cases', () => {
    expect(parseArgs([])).toEqual(pathsFor(ROOT));
  });
  it('rejects an unknown argument', () => {
    expect(() => parseArgs(['--write', 'x'])).toThrow('unknown argument');
    expect(() => parseArgs(['--register'])).toThrow('needs a value');
  });
});

describe('real register', () => {
  const p = pathsFor(ROOT);
  const realRetired = real.records.filter((r) => r.verdict.kind === 'verdict');
  it('gives an is_buried and an explain reply for every retired payload, and the language check finds nothing', () => {
    expect(realRetired.length).toBe(real.census.retired.total);
    const hits = [];
    for (const r of realRetired) {
      for (const out of [isBuried(p, r.norad), explain(p, r.norad)]) {
        expect(out.ok).toBe(true);
        hits.push(...findHits(out.text, `mcp:${r.norad}`));
      }
    }
    expect(hits).toEqual([]);
  }, 120_000); // Each call reads the 1.4 MB register again, 1,392 times.
  it('explain(27378) includes the case file', () => {
    expect(explain(p, 27378).text).toContain('Case file');
  });
  it('the totals in list add up to the census', () => {
    let sum = 0;
    for (const v of VERDICT_NAMES) {
      const m = /: (\d[\d,]*) of /.exec(list(p, v, 1).text);
      sum += Number((m?.[1] ?? '').replace(/,/g, ''));
    }
    expect(sum).toBe(real.census.retired.total);
  });
});

describe('parish', () => {
  const realPaths = pathsFor(ROOT);
  it('gives an operator\'s verdict counts as "n of N", the data age, the assumptions, each source and what the register cannot see', () => {
    const out = parish(realPaths, 'Intelsat');
    expect(out.ok).toBe(true);
    expect(out.text).toContain('Operator (sourced): Intelsat. Snapshot set 2026-11-22.');
    expect(out.text).toContain('- Unquiet: 2 of 2');
    expect(out.text).toContain('- Buried: 0 of 2');
    expect(out.text).toContain('Data age: GP mean elements, epochs from');
    expect(out.text).toContain('Assumes C_R·A/m from 0.012 to 0.045 m²/kg and a mean-element uncertainty of ±25 km.');
    expect(out.text).toContain('operator Intelsat, source https://spaceflightnow.com/');
    expect(out.text).toContain('only sees objects still near GEO');
    expect(out.text).toContain('The IADC guidelines are voluntary');
    expect(out.text).toContain('We do not know when a satellite retired.');
  });
  it('finds a name in any case, by its start, and an owner code', () => {
    expect(parish(realPaths, 'intelsat').text).toContain('Operator (sourced): Intelsat.');
    expect(parish(realPaths, 'RSCC').text).toContain('RSCC (Russian Satellite Communications Company)');
    const jpn = parish(realPaths, 'jpn');
    expect(jpn.ok).toBe(true);
    expect(jpn.text).toContain('SATCAT owner (country or organisation): JPN.');
    expect(jpn.text).toContain('It may name a country or an organisation, and not the operator.');
    expect(parish(realPaths, 'JPN', 'owner').ok).toBe(true);
  });
  it('the parts of an owner group add up to the register\'s own count for that owner', () => {
    const counts = real.census.retired.byOwner['JPN']!;
    const out = parish(realPaths, 'JPN', 'owner').text;
    const page = parishOf(real.records, { kind: 'owner', key: 'JPN' });
    for (const v of VERDICT_NAMES) {
      expect(page.parts.onOrAfter.byVerdict[v] + page.parts.before.byVerdict[v] + page.parts.unknown.byVerdict[v]).toBe(counts[v]);
      const word = `${v.charAt(0).toUpperCase()}${v.slice(1)}`;
      expect(out).toContain(`- ${word}: ${page.parts.onOrAfter.byVerdict[v]} of ${page.parts.onOrAfter.total}`);
      expect(out).toContain(`- ${word}: ${page.parts.before.byVerdict[v]} of ${page.parts.before.total}`);
    }
  });
  it('says plainly when a name is not found, or matches several, or the kind is wrong, and lists the names', () => {
    const none = parish(realPaths, 'No Such Operator');
    expect(none.ok).toBe(false);
    expect(none.text).toContain('Operators (named only where a source that was opened names one):');
    const many = parish(realPaths, 'S', 'operator');
    expect(many.ok).toBe(false);
    expect(many.text).toContain('matches more than one operator');
    expect(parish(realPaths, 'Intelsat', 'owner').ok).toBe(false);
    expect(parish(realPaths, 'Intelsat', 'company').text).toContain('is not a kind');
    expect(parish(realPaths, '   ').ok).toBe(false);
    expect(parish(realPaths, 42).ok).toBe(false);
  });
  it('does not say a satellite has an operator where none is sourced', () => {
    const out = parish(realPaths, 'ITSO', 'owner').text;
    expect(out).toContain('SATCAT owner (country or organisation): ITSO.');
    expect(out).toContain('operator not sourced');
  });
  it('passes the language check, for every operator and owner code, and with no ranking words', () => {
    const groups = [...new Set(real.records.flatMap((r) => (typeof r.operator === 'string' ? [r.operator] : [])))];
    const owners = Object.keys(real.census.retired.byOwner);
    for (const [name, kind] of [...groups.map((g) => [g, 'operator'] as const), ...owners.map((o) => [o, 'owner'] as const)]) {
      const out = parish(realPaths, name, kind);
      expect(out.ok, name).toBe(true);
      expect(findHits(out.text, `parish-${name}`), name).toEqual([]);
      expect(out.text, name).not.toMatch(/\b(rank|ranking|score|grade|best|worst)\b/i);
    }
  });
});
describe('language', () => {
  it('no tool output has a banned word (scripts/check-language.ts)', () => {
    expect(outputs.length).toBeGreaterThan(40);
    const hits = outputs.flatMap((text, i) => findHits(text, `mcp-output-${i}`));
    expect(hits).toEqual([]);
  });
  it('no tool output states a retirement date', () => {
    for (const text of outputs) expect(text).not.toMatch(/retired (on|in|at) \d|date of retirement|retirement date:/i);
  });
  it('the server files pass the language check', () => {
    const files = ['scripts/mcp/server.ts', 'scripts/mcp/tools.ts', 'src/ui/ledger-text.ts'].map((f) => join(ROOT, f));
    expect(checkFiles(ROOT, files)).toEqual([]);
  });
  it('the check does catch a banned word in a tool-shaped output', () => {
    expect(findHits('Verdict: it violated the rule', 'mcp-output')).toHaveLength(1);
  });
});

describe('read-only', () => {
  it('the server files import no network module and no write function', () => {
    for (const f of ['scripts/mcp/server.ts', 'scripts/mcp/tools.ts']) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      expect(text).not.toMatch(/node:(http|https|net|dgram|dns|tls)|\bfetch\(|writeFile|appendFile|mkdir|unlink|rmSync|renameSync|createWriteStream/);
    }
  });
});

describe('over stdio', () => {
  let client: Client;
  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(ROOT, 'scripts/mcp/server.ts'), '--register', caseRegister, '--cases', casesDir],
      stderr: 'pipe',
    });
    client = new Client({ name: 'sexton-test', version: '0.0.0' });
    await client.connect(transport);
    return async () => {
      await client.close();
    };
  }, 30_000);

  const textOf = (result: unknown): string => {
    const content = (result as { content: { type: string; text: string }[] }).content;
    return content.map((c) => c.text).join('\n');
  };

  it('lists the five tools, each read-only and with a description and an input schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const t of tools) {
      expect(t.description?.length ?? 0).toBeGreaterThan(40);
      expect(t.inputSchema.type).toBe('object');
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.openWorldHint).toBe(false);
    }
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(Object.keys(byName.is_buried!.inputSchema.properties ?? {})).toEqual(['norad']);
    expect(Object.keys(byName.list!.inputSchema.properties ?? {})).toEqual(['verdict', 'limit']);
    expect(byName.list!.inputSchema.required).toEqual(['verdict']);
    expect(Object.keys(byName.parish!.inputSchema.properties ?? {})).toEqual(['name', 'kind']);
    expect(byName.parish!.inputSchema.required).toEqual(['name']);
  });

  it('calls explain and gets the ledger and the case file', async () => {
    const result = await client.callTool({ name: 'explain', arguments: { norad: 27378 } });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain('The verdict');
    expect(text).toContain(CASE_TEXT);
    expect(findHits(text, 'stdio')).toEqual([]);
  });

  it('calls census, is_buried and list', async () => {
    expect(textOf(await client.callTool({ name: 'census', arguments: {} }))).toContain('of 20');
    expect(textOf(await client.callTool({ name: 'is_buried', arguments: { norad: 90002 } }))).toContain("verdict is buried.");
    expect(textOf(await client.callTool({ name: 'list', arguments: { verdict: 'fallen', limit: 1 } }))).toContain('Showing 1 of 2');
  });

  it('answers an unknown id and an unknown verdict with an error result, not a crash', async () => {
    const id = await client.callTool({ name: 'is_buried', arguments: { norad: 1 } });
    expect(id.isError).toBe(true);
    expect(textOf(id)).toBe('The register has no object with NORAD id 1.');
    const verdict = await client.callTool({ name: 'list', arguments: { verdict: 'dead' } });
    expect(verdict.isError).toBe(true);
    expect(textOf(verdict)).toContain('is not a verdict');
    // The server is still alive after the errors.
    expect(textOf(await client.callTool({ name: 'census', arguments: {} }))).toContain('Census');
  });

  it('answers input the schema rejects with a message, and stays alive', async () => {
    let message = '';
    try {
      const result = await client.callTool({ name: 'explain', arguments: { norad: -5 } });
      message = result.isError ? textOf(result) : 'NOT AN ERROR';
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe('NOT AN ERROR');
    expect(message.length).toBeGreaterThan(10);
    expect(textOf(await client.callTool({ name: 'census', arguments: {} }))).toContain('Census');
  });
});

describe('createServer', () => {
  it('builds a server without reading any file', () => {
    expect(createServer({ registerPath: join(work, 'never-read.json'), casesDir })).toBeDefined();
  });
});
