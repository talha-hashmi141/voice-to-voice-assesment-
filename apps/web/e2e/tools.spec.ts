import { expect, test } from '@playwright/test';

test.describe('Tools & tickets dashboard', () => {
  test('shows the tool catalogue, usage and tickets, and updates a ticket status', async ({
    page,
  }) => {
    await page.goto('/tools');
    await expect(page.getByRole('heading', { name: 'Tools & tickets' })).toBeVisible();
    await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(7);
    await expect(
      page.getByTestId('tool-create_support_ticket').getByText('creates records'),
    ).toBeVisible();
    await expect(page.getByText('Calls per tool')).toBeVisible();

    // the agent spec created a ticket earlier in the run
    const table = page.getByTestId('ticket-table');
    await expect(table).toBeVisible();
    const firstReference =
      (await table.locator('tbody tr').first().locator('td').first().textContent())?.trim() ?? '';
    expect(firstReference).toMatch(/^TCK-/);

    await page.getByRole('combobox', { name: `Status of ${firstReference}` }).click();
    await page.getByRole('option', { name: 'Resolved' }).click();
    await expect(page.getByText(`${firstReference} marked resolved`)).toBeVisible();
  });
});
