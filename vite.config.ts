import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { checkCaseDir } from './scripts/check-cases.ts';
import { registerText } from './scripts/register-source.ts';

const BASE = '/sexton/';

/** Serves and emits register.json: data/register.json, or the fixture marked as sample data. */
function registerPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'sexton-register',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path === `${BASE}register.json` || path === '/register.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(registerText(root).text);
        } else {
          next();
        }
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'register.json', source: registerText(root).text });
    },
  };
}

/** Stops the build, naming the file, when a case file in data/cases/ is bad. SEXTON_CASES_DIR is for tests. */
function casesPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'sexton-cases',
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      const dir = process.env.SEXTON_CASES_DIR ?? `${root}/data/cases`;
      try {
        checkCaseDir(dir);
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    },
  };
}
export default defineConfig({
  base: BASE,
  plugins: [registerPlugin(), casesPlugin()],
});
