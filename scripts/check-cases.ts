// Checks every case file in a folder with the same parser the site uses (design 5.8).
// The Vite build calls this first, so a bad file stops `npm run build` with its name.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCaseFile } from '../src/ui/case-file.ts';

/** Throws CaseFileError for the first bad .md file. A missing folder means no case files. Returns the count. */
export function checkCaseDir(dir: string): number {
  if (!existsSync(dir)) return 0;
  const names = readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
  const seen = new Set<number>();
  for (const name of names) {
    const file = `data/cases/${name}`;
    const parsed = parseCaseFile(file, readFileSync(join(dir, name), 'utf8'));
    seen.add(parsed.norad);
  }
  return seen.size;
}
