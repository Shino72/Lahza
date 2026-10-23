import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const withBackend = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const server = 'node dist/server/entry.mjs';

/*
 * Runs against the Node build (`LAHZA_ADAPTER=node npm run build`).
 * Port 4322 serves the sample content; port 4321 serves the database-backed
 * site when a local Supabase stack is configured.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'public-mobile', testMatch: 'public-site.spec.ts', use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4322' } },
    {
      name: 'public-desktop',
      testMatch: 'public-site.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, baseURL: 'http://localhost:4322' },
    },
    ...(withBackend
      ? [{ name: 'newsroom', testMatch: 'admin-workflow.spec.ts', use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4321' } }]
      : []),
  ],
  webServer: [
    {
      command: server,
      url: 'http://localhost:4322/ar/',
      reuseExistingServer: !process.env.CI,
      env: { PORT: '4322', HOST: 'localhost', LAHZA_CONTENT_SOURCE: 'demo', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SECRET_KEY: '' },
    },
    ...(withBackend
      ? [{ command: server, url: 'http://localhost:4321/ar/', reuseExistingServer: !process.env.CI, env: { PORT: '4321', HOST: 'localhost' } }]
      : []),
  ],
});
