import { expect, test } from '@playwright/test';

test.describe('Knowledge base', () => {
  test('lists documents, runs a semantic search with scores and opens a document', async ({
    page,
  }) => {
    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: 'Knowledge base' })).toBeVisible();
    await expect(page.getByRole('button', { name: /PTO and Leave Policy/ })).toBeVisible();

    await page
      .getByLabel('Search query')
      .fill('How long do I have to claim back money I spent on a business trip?');
    await page.getByRole('button', { name: 'Search' }).click();

    const results = page.locator('article');
    await expect(results.first()).toBeVisible();
    await expect(page.getByText(/passages · hybrid/)).toBeVisible();
    await expect(results.first().getByText('fused')).toBeVisible();
    await expect(results.first().getByText('keyword')).toBeVisible();

    await page.getByRole('radio', { name: 'Keyword' }).click();
    await expect(page.getByText(/passages · sparse/)).toBeVisible();

    await page.getByRole('button', { name: /PTO and Leave Policy/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.locator('[data-slot="sheet-title"]')).toHaveText('PTO and Leave Policy');
    await expect(sheet.locator('h1')).toHaveCount(0);
    await expect(sheet.getByText(/Carryover of unused PTO/)).toBeVisible();
  });
});
