// Build-time content (design 5.8). Vite bundles the case files as raw text. A bad file throws when
// this module loads, and the Vite plugin in vite.config.ts checks the same files during the build.
import { parseCaseFiles } from './case-file.ts';
import type { CaseFile } from './case-file.ts';

const raw = import.meta.glob('/data/cases/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every case file, by NORAD id. Empty when data/cases/ has none. */
export const CASES: ReadonlyMap<number, CaseFile> = parseCaseFiles(raw);
