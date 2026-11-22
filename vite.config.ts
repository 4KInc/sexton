import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
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

export default defineConfig({
  base: BASE,
  plugins: [registerPlugin()],
});
