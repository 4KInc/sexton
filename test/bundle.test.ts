// The main chunk stays under 100 kB. The case files are bundled with the ledger, not with the first page.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { describe, expect, it } from 'vitest';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIMIT = 100_000;
type Output = Rolldown.RolldownOutput | Rolldown.RolldownOutput[];
describe('the production bundle', () => {
  it('has a main chunk under 100 kB (raw bytes), and the case files are not in it', async () => {
    const result = (await build({ root: ROOT, logLevel: 'silent', build: { write: false } })) as Output;
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((o) => o.output);
    const entries = outputs.filter((o): o is Rolldown.OutputChunk => o.type === 'chunk' && o.isEntry);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      const bytes = Buffer.byteLength(e.code);
      expect(bytes, `${e.fileName} is ${bytes} bytes`).toBeLessThan(LIMIT);
      expect(e.code, 'the case files are not in the entry chunk').not.toContain('Cause category:');
    }
  }, 60_000);
});
