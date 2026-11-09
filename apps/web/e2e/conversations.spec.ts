import { expect, test } from '@playwright/test';

test.describe('Conversations and theme', () => {
  test('lists past conversations and opens a transcript', async ({ page }) => {
    // create a conversation first
    await page.goto('/');
    await expect(page.getByText('connected', { exact: true })).toBeVisible();
    const input = page.getByLabel('Type a question');
    await input.fill('Is there a dress code?');
    await input.press('Enter');
    await expect(page.getByRole('log').locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('/conversations');
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
    const link = page.getByRole('link', { name: /Is there a dress code/ }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole('log').getByText('Is there a dress code?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue by voice' })).toBeVisible();
  });

  test('toggles between light and dark themes', async ({ page }) => {
    await page.goto('/knowledge');
    const toggle = page.getByRole('button', { name: /^Theme:/ }).first();
    await toggle.click(); // → light
    await toggle.click(); // → dark
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
