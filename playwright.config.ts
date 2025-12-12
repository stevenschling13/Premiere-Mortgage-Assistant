import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev -- --host --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
