import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Each scenario creates its own company, so every test can run on its own worker.
  fullyParallel: true,
  // Half the cores: each worker drives a browser, and multi-person scenarios open several contexts.
  workers: '50%',
  // Recording a trace for every test roughly doubles the suite's CPU cost; pass --trace on to debug.
  use: { baseURL: 'http://127.0.0.1:4173', screenshot: 'only-on-failure' },
  outputDir: process.env.NELSON_BROWSER_RESULTS ?? 'artifacts/browser-results',
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI && !process.env.NELSON_BROWSER_ISOLATED,
  },
});
