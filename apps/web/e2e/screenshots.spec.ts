import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const OUT = resolve(__dirname, '..', '..', '..', 'docs', 'screenshots');

/** Captures README screenshots. Run with: SCREENSHOTS=1 pnpm exec playwright test e2e/screenshots.spec.ts */
test.describe('screenshots', () => {
  test.skip(!process.env.SCREENSHOTS, 'only on demand');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('agent page after a multi-step turn (light + dark)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('connected', { exact: true })).toBeVisible();
    const input = page.getByLabel('Type a question');
    await input.fill(
      'How many PTO days do I have left this year, and can I carry unused days over?',
    );
    await input.press('Enter');
    await expect(page.getByRole('log').getByText(/PTO days left/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Answer ready').first()).toBeVisible();
    await page.waitForTimeout(800);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.screenshot({ path: `${OUT}/agent-light.png` });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/agent-dark.png` });
  });

  test('knowledge base search playground', async ({ page }) => {
    await page.goto('/knowledge');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page
      .getByLabel('Search query')
      .fill('How long do I have to claim back money I spent on a business trip?');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('article').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/knowledge-search.png` });
  });

  test('conversation history', async ({ page }) => {
    await page.goto('/conversations');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/conversations.png` });
  });

  test('tools dashboard', async ({ page }) => {
    await page.goto('/tools');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(6);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/tools-dashboard.png` });
  });
});
