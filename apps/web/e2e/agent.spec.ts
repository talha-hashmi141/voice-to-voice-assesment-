import { expect, test } from '@playwright/test';

test.describe('Voice agent (text input path)', () => {
  test('answers with citations, shows the agent trace and resets', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('connected', { exact: true })).toBeVisible();

    const input = page.getByLabel('Type a question');
    await input.fill(
      'How many PTO days do I have left this year, and can I carry unused days over?',
    );
    await input.press('Enter');

    const log = page.getByRole('log');
    await expect(log.getByText(/How many PTO days do I have left/)).toBeVisible();
    await expect(log.getByText(/PTO days left/)).toBeVisible({ timeout: 30_000 });

    // agent trace: tools ran and retrieval was graded
    await expect(page.getByText('Searching the knowledge base').first()).toBeVisible();
    await expect(page.getByText('Looking up leave balance').first()).toBeVisible();
    await expect(page.getByText(/Retrieval (strong|weak|none)/).first()).toBeVisible();
    await expect(page.getByText('Answer ready').first()).toBeVisible();

    // citation chip opens the sources sheet
    await log
      .getByRole('button', { name: /^Source 1:/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Sources' })).toBeVisible();
    await expect(sheet.getByText('PTO and Leave Policy').first()).toBeVisible();
    await page.keyboard.press('Escape');

    // latency badges filled in
    const totalBadge = page.locator('aside').getByText('Total').locator('..');
    await expect(totalBadge).not.toContainText('–');

    await page.getByRole('button', { name: 'Reset conversation' }).click();
    await expect(page.getByText('Say something')).toBeVisible();
  });

  test('keeps context across turns and performs a confirmed action', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('connected', { exact: true })).toBeVisible();
    const input = page.getByLabel('Type a question');
    const log = page.getByRole('log');

    await input.fill('My laptop screen is cracked, what should I do?');
    await input.press('Enter');
    await expect(log.getByText(/ticket/i).first()).toBeVisible({ timeout: 30_000 });

    await input.fill('Yes please, high priority');
    await input.press('Enter');
    await expect(log.getByText(/TCK-[A-Z0-9]{6}/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Creating a support ticket').first()).toBeVisible();
  });
});
