// End-to-end checks (R15, design 12): the built site, served under its /sexton/ base, in Chromium, Firefox and WebKit.
// Run with `npm run test:e2e`. Not part of `npm test`, and not run on every push (see .github/workflows/e2e.yml).
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
export const BASE = `http://localhost:${PORT}/sexton/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: BASE, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // The tests use the files that ship: build first, then serve dist/ with vite preview.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
