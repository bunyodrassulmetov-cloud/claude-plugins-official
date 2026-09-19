import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Сценарные проверки в настоящем браузере.
 * Перед первым запуском: npx playwright install chromium
 * Нужны собранное приложение и наполненная база (npm run build, npm run db:seed).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    // CHROMIUM_PATH пригодится там, где браузер уже установлен отдельно
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  projects: [
    // Мобильные проверки нужны только на узком экране, остальные — на обычном
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
