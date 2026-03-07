import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * Video-recording config for demo/narrative E2E tests.
 * Run with: npx playwright test --config=playwright.video.config.ts
 */
export default defineConfig({
  testDir: './tests/video',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: { slowMo: 500 },
  },

  globalSetup: path.resolve(__dirname, 'global-setup.ts'),

  projects: [
    {
      name: 'video-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
