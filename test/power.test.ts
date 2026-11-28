// R17: the Sexton Kiro power (powers/sexton). The format is the Agent Plugins 1.0.0 one that kiro.dev's "Create powers" page describes:
// plugin.json, skills/<name>/SKILL.md and mcp.json at the power root. These tests run the server as an installed copy would run, from a folder
// outside the repository, with ${PLUGIN_ROOT} expanded the way the specification says a client does it. They do not need Kiro.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, describe, expect, it } from 'vitest';
import { findHits } from '../scripts/check-language.ts';
import { bundle, noticesText, stale } from '../scripts/build-power.ts';
import { TOOL_NAMES } from '../scripts/mcp/server.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POWER = join(ROOT, 'powers', 'sexton');
const read = (p: string): string => readFileSync(join(POWER, p), 'utf8');
const plugin = JSON.parse(read('plugin.json')) as Record<string, unknown> & { name: string; version: string; keywords: string[]; author: { name: string } };
const mcp = JSON.parse(read('mcp.json')) as { $schema: string; mcpServers: Record<string, Record<string, unknown>> };
const server = mcp.mcpServers['sexton']!;
const skill = read('skills/sexton-verdicts/SKILL.md');

describe('plugin.json', () => {
  it('has the fields kiro.dev asks for, and a kebab-case name', () => {
    expect(plugin['$schema']).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(plugin.name).toMatch(/^[a-z0-9][a-z0-9.-]{0,63}$/);
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(String(plugin['description']).length).toBeGreaterThan(40);
    expect(plugin.author.name).not.toBe('');
    expect(plugin.keywords.length).toBeGreaterThanOrEqual(5);
    for (const k of ['geostationary', 'graveyard orbit', 'disposal record', 'NORAD']) expect(plugin.keywords).toContain(k);
  });
  it('says the register\u2019s answer is a verdict with its assumptions and data age, and uses no word of judgement', () => {
    expect(String(plugin['description'])).toContain('assumptions');
    expect(findHits(JSON.stringify(plugin), 'plugin.json')).toEqual([]);
  });
});

describe('mcp.json', () => {
  it('targets the same Agent Plugins version as plugin.json, and has no other top-level field', () => {
    expect(mcp.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
    expect(Object.keys(mcp).sort()).toEqual(['$schema', 'mcpServers']);
    expect(mcp.$schema.match(/schemas\/([\d.]+)\//)![1]).toBe((plugin['$schema'] as string).match(/schemas\/([\d.]+)\//)![1]);
  });
  it('is one stdio server with only the fields the closed schema allows', () => {
    expect(Object.keys(mcp.mcpServers)).toEqual(['sexton']);
    expect(server['type']).toBe('stdio');
    for (const key of Object.keys(server)) expect(['type', 'command', 'args', 'env', 'cwd'], key).toContain(key);
  });
  it('has no autoApprove: the format has no such field, and an unknown field makes the server entry invalid', () => {
    expect(server).not.toHaveProperty('autoApprove');
    expect(server).not.toHaveProperty('disabled');
    expect(JSON.stringify(mcp)).not.toContain('autoApprove');
  });
  it('uses a bare command and ${PLUGIN_ROOT} for every path, and no secret', () => {
    expect(server['command']).toBe('node');
    expect(server['command'] as string).not.toMatch(/[\s/\\]/);
    const args = server['args'] as string[];
    expect(args).toEqual(['${PLUGIN_ROOT}/server/sexton-mcp.mjs', '--register', '${PLUGIN_ROOT}/data/register.json', '--cases', '${PLUGIN_ROOT}/data/cases']);
    expect(server['cwd']).toBe('${PLUGIN_ROOT}');
    expect(Object.keys((server['env'] as Record<string, string> | undefined) ?? {})).not.toEqual(expect.arrayContaining(['PLUGIN_ROOT']));
    expect(JSON.stringify(mcp)).not.toMatch(/KEY|TOKEN|SECRET|PASSWORD/i);
  });
});

describe('the files the power carries', () => {
  it('are up to date with scripts/mcp, data/register.json and data/cases (run: node scripts/build-power.ts)', async () => {
    expect(await stale()).toEqual([]);
  }, 60_000);
  it('needs nothing from the repository: the server, the register and 40 case files are inside powers/sexton', () => {
    for (const f of ['server/sexton-mcp.mjs', 'data/register.json', 'data/cases/27516.md', 'plugin.json', 'mcp.json', 'skills/sexton-verdicts/SKILL.md']) expect(existsSync(join(POWER, f)), f).toBe(true);
    expect(read('server/sexton-mcp.mjs')).not.toMatch(/from ["']\.\.?\//);
  });
});

describe('what is bundled into the server', () => {
  it('is eight packages, all under licences steering allows (MIT, Apache-2.0, BSD, ISC), and their notices travel with the power', async () => {
    const { packages } = await bundle();
    expect(packages).toEqual(['@modelcontextprotocol/sdk', 'ajv', 'ajv-formats', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'zod', 'zod-to-json-schema']);
    const notices = read('server/THIRD_PARTY_LICENSES.txt');
    expect(notices).toBe(noticesText(packages));
    for (const name of packages) {
      const license = (JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { license: string }).license;
      expect(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'], `${name}: ${license}`).toContain(license);
      expect(notices).toContain(`==== ${name} `);
    }
  }, 60_000);
});

describe('installed in a folder outside the repository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sexton power install '));
  const installed = join(dir, 'sexton');
  cpSync(POWER, installed, { recursive: true });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  /** The client's job (specification, section 9.2): replace ${PLUGIN_ROOT} in args, env values and cwd. Nothing else is expanded. */
  const expand = (s: string): string => s.split('${PLUGIN_ROOT}').join(installed);
  it('starts from the expanded mcp.json, with the plugin root as the working directory, and answers', async () => {
    const transport = new StdioClientTransport({
      command: server['command'] as string,
      args: (server['args'] as string[]).map(expand),
      cwd: expand(server['cwd'] as string),
      stderr: 'pipe',
    });
    const client = new Client({ name: 'power-test', version: '0.0.0' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
      const text = (r: unknown): string => (r as { content: { text: string }[] }).content.map((c) => c.text).join('\n');
      const buried = text(await client.callTool({ name: 'is_buried', arguments: { norad: 27516 } }));
      expect(buried).toMatch(/unquiet/i);
      expect(buried).toContain('0.012');
      expect(buried).toContain('disposal reported by operator');
      expect(buried).toContain('A case file exists; call explain for its sources.');
      expect(buried).not.toContain('292');
      const explain = text(await client.callTool({ name: 'explain', arguments: { norad: 27516 } }));
      expect(explain, 'the case file is found through --cases').toContain('disposal reported by operator');
      const parish = text(await client.callTool({ name: 'parish', arguments: { name: 'Intelsat' } }));
      expect(parish).toContain('Unquiet: 2 of 2');
      expect(parish).toContain('failed in orbit or broke up before disposal: 2 of 2');
      expect(parish).toContain('SATCAT owner ITSO (country or organisation), all launch years: 60 of 60');
    } finally {
      await client.close();
    }
  }, 60_000);
  it('also works when started from another working directory, because every path is absolute after expansion', async () => {
    const transport = new StdioClientTransport({ command: 'node', args: (server['args'] as string[]).map(expand), cwd: tmpdir(), stderr: 'pipe' });
    const client = new Client({ name: 'power-test', version: '0.0.0' });
    await client.connect(transport);
    try {
      const r = (await client.callTool({ name: 'census', arguments: {} })) as { content: { text: string }[] };
      expect(r.content[0]!.text).toContain('snapshot set 2026-11-22');
    } finally {
      await client.close();
    }
  }, 60_000);
  it('says so, and does not crash, when the register is not where mcp.json points', async () => {
    const transport = new StdioClientTransport({ command: 'node', args: [expand('${PLUGIN_ROOT}/server/sexton-mcp.mjs'), '--register', join(dir, 'nowhere.json'), '--cases', join(dir, 'nowhere')], cwd: dir, stderr: 'pipe' });
    const client = new Client({ name: 'power-test', version: '0.0.0' });
    await client.connect(transport);
    try {
      const r = (await client.callTool({ name: 'census', arguments: {} })) as { isError?: boolean; content: { text: string }[] };
      expect(r.isError).toBe(true);
      expect(r.content[0]!.text).toContain('could not be read');
    } finally {
      await client.close();
    }
  }, 60_000);
});

describe('the skill', () => {
  it('has a name that matches its folder and a description that says when to use it', () => {
    const front = /^---\nname: ([\w-]+)\ndescription: (.+)\n---\n/.exec(skill);
    expect(front).not.toBeNull();
    expect(front![1]).toBe('sexton-verdicts');
    expect(front![2]!.length).toBeGreaterThan(60);
  });
  it('holds the rules of language.md: the verdict word with assumptions and data age, never a bare yes or no, no judging, no retirement date, the near-GEO limit', () => {
    for (const must of [
      'Never answer with only yes or no',
      'The verdict word.',
      'The assumptions.',
      'The data age.',
      'The register only sees objects still near GEO',
      'The IADC guidelines are voluntary',
      '47 CFR § 25.283',
      'Never judge a satellite or an operator',
      '"below the IADC disposal threshold under the stated assumptions"',
      'Never state or imply when a satellite retired',
      'Never rank, score or grade',
      "Never work out an operator from a satellite's name or from its SATCAT owner code",
      'do not describe a record from verdicts alone',
      'GEO is the circular orbit about 35,786 km above the equator',
    ]) expect(skill, must).toContain(must);
    for (const tool of TOOL_NAMES) expect(skill, tool).toContain(`\`${tool}\``);
  });
  it('passes the language check', () => {
    expect(findHits(skill, 'powers/sexton/skills/sexton-verdicts/SKILL.md')).toEqual([]);
  });
});

describe('the README', () => {
  it('has the section "Install the Sexton power" with the folder to import, and what the check does and does not show', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('## Install the Sexton power');
    const section = readme.slice(readme.indexOf('## Install the Sexton power'));
    expect(section).toContain('Add Custom Power');
    expect(section).toContain('powers/sexton');
    expect(section).toContain('node scripts/build-power.ts');
  });
});
