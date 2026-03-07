import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * Playwright configuration optimised for VIDEO RECORDING.
 *
 * Usage:
 *   npx playwright test --config playwright.video.config.ts
 *
 * Or via npm script:
 *   npm run test:video
 *
 * Videos are saved to ./test-videos/<test-name>/video.webm
 */
export default defineConfig({
  testDir: './tests/video',
  fullyParallel: false, // Run sequentially for cleaner video output
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries — we want clean single-pass recordings
  workers: 1, // Single worker for sequential execution
  timeout: 120_000, // 2-minute timeout per test (allow for slower visual flows)
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'video-report' }],
  ],

  use: {
    baseURL,
    trace: 'on', // Full trace for debugging
    screenshot: 'on', // Capture screenshots at key moments
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: {
      slowMo: 500, // Slow down actions for visible, watchable recordings
    },

    // ─── VIDEO RECORDING CONFIG ──────────────────────────────────────────
    video: {
      mode: 'on', // Always record video
      size: { width: 1280, height: 720 }, // 720p for clean output
    },
  },

  // Output directory for test artifacts (videos, screenshots, traces)
  outputDir: './test-videos',

  projects: [
    {
      name: 'video-demo',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        colorScheme: 'light',
      },
    },
  ],
});
