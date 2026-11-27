// The main chunk stays under 110 kB, and the case files are bundled with the ledger, not with the first page.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { describe, expect, it } from 'vitest';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
// The steering limit (tech.md) is 185 kB. 110 kB is a tighter guard against a regression such as the eager case-file import, which took
// the main chunk to 145 kB. The main chunk was 99.75 kB at commit a54d878 (the parish register), so this leaves about 10 kB for later work.
const LIMIT = 110_000;
type Output = Rolldown.RolldownOutput | Rolldown.RolldownOutput[];
describe('the production bundle', () => {
  it('has a main chunk under 110 kB (raw bytes), and the case files are not in it', async () => {
    const result = (await build({ root: ROOT, logLevel: 'silent', build: { write: false } })) as Output;
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((o) => o.output);
    const entries = outputs.filter((o): o is Rolldown.OutputChunk => o.type === 'chunk' && o.isEntry);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      const bytes = Buffer.byteLength(e.code);
      expect(bytes, `${e.fileName} is ${bytes} bytes`).toBeLessThan(LIMIT);
      expect(e.code, 'the case files are not in the entry chunk').not.toContain('Cause category:');
    }
    // The browser checks and axe are development tools (MPL-2.0 for axe): none of their code is in the site.
    for (const o of outputs) if (o.type === 'chunk') expect(o.code, o.fileName).not.toMatch(/axe-core|@axe-core|playwright/i);
  }, 60_000);
});
