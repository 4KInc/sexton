// True when the module at `metaUrl` is the script node was started with.
// Both sides go through realpath, so a symlinked argv[1] (macOS /var -> /private/var) still matches.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isMain(metaUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  if (argv1 === undefined || argv1 === '') return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argv1);
  } catch {
    return false;
  }
}
