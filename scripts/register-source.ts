// Which register.json the site is built with (design 3, "Which register the site uses").
// Used by vite.config.ts. Reads files only.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REAL_REGISTER = join('data', 'register.json');
export const FIXTURE_REGISTER = join('test', 'fixtures', 'register.json');

/** The real register if data/register.json exists. Otherwise the fixture, with "sample": true. */
export function registerText(root: string): { text: string; sample: boolean } {
  const real = join(root, REAL_REGISTER);
  if (existsSync(real)) return { text: readFileSync(real, 'utf8'), sample: false };
  const fixture = JSON.parse(readFileSync(join(root, FIXTURE_REGISTER), 'utf8')) as Record<string, unknown>;
  fixture['sample'] = true;
  return { text: JSON.stringify(fixture, null, 2) + '\n', sample: true };
}
