import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: '../../scripts/run-e2e-backend.sh',
      port: 8010,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'VITE_API_PROXY_TARGET=http://127.0.0.1:8010 npm run dev -- --host 127.0.0.1 --port 4173',
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
