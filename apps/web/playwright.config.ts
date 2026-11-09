import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const FAKE_MIC_WAV = resolve(__dirname, 'e2e/fixtures/utterance.wav');
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

/**
 * Browser end-to-end tests against the real stack (API in mock-provider mode + web app).
 * Chromium is launched with a fake microphone that plays e2e/fixtures/utterance.wav so the
 * hands-free voice flow (VAD → upload → transcript → spoken reply) is exercised for real.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-audio-capture=${FAKE_MIC_WAV}`,
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : [
        {
          command: 'pnpm --filter @voice-agent/api start',
          url: `${API_URL}/api/health`,
          reuseExistingServer: true,
          timeout: 120_000,
          cwd: resolve(__dirname, '..', '..'),
        },
        {
          command: 'pnpm --filter @voice-agent/web start',
          url: WEB_URL,
          reuseExistingServer: true,
          timeout: 120_000,
          cwd: resolve(__dirname, '..', '..'),
        },
      ],
});
