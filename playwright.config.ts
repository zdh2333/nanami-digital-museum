import { defineConfig, devices } from '@playwright/test'

const chromePath = process.env.NANAMI_CHROME_PATH

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'line',
  outputDir: 'test-results',
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    locale: 'en-US',
    reducedMotion: 'no-preference',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      ...(chromePath ? { executablePath: chromePath } : {}),
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
