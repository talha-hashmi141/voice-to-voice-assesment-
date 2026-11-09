import { expect, test } from '@playwright/test';

/**
 * Hands-free voice flow with Chromium's fake microphone playing a synthesized utterance:
 * VAD detects speech → WAV uploaded → (mock) transcription → agent reply → audio playback.
 */
test.describe('Voice agent (microphone path)', () => {
  test('captures an utterance hands-free and speaks a reply', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('connected', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByText('Listening…')).toBeVisible({ timeout: 30_000 });

    const log = page.getByRole('log');
    await expect(log.locator('[data-role="user"]').first()).toBeVisible({ timeout: 45_000 });
    await expect(log.locator('[data-role="assistant"]').first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Answer ready').first()).toBeVisible();

    const sttBadge = page.locator('aside').getByText('STT', { exact: true }).locator('..');
    await expect(sttBadge).not.toContainText('–');

    await page.getByRole('button', { name: 'Stop listening' }).click();
    await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
  });
});
