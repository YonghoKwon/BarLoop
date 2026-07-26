import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-15-pro-safari',
      use: {
        ...devices['iPhone 15 Pro'],
        browserName: 'webkit',
      },
    },
    {
      name: 'ipad-air-4-safari',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'webkit',
        viewport: { width: 820, height: 1180 },
        screen: { width: 820, height: 1180 },
      },
    },
    {
      name: 'ipad-air-4-landscape-safari',
      use: {
        ...devices['iPad (gen 7) landscape'],
        browserName: 'webkit',
        viewport: { width: 1180, height: 820 },
        screen: { width: 1180, height: 820 },
      },
    },
  ],
});
