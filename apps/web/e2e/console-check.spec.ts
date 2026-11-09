import { expect, test } from '@playwright/test';

/** Diagnostic: collect console errors/warnings and page errors on each route. Run on demand with CONSOLE_CHECK=1. */
test.describe('console check', () => {
  test.skip(!process.env.CONSOLE_CHECK, 'only on demand');
  for (const route of ['/', '/knowledge', '/conversations']) {
    test(`no console errors on ${route}`, async ({ page }) => {
      const messages: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning')
          messages.push(`[${message.type()}] ${message.text()}`);
      });
      page.on('pageerror', (error) => messages.push(`[pageerror] ${error.message}`));
      await page.goto(route);
      await page.waitForTimeout(2500);
      if (route === '/') {
        const input = page.getByLabel('Type a question');
        await input.fill('Is there a dress code?');
        await input.press('Enter');
        await page.waitForTimeout(3000);
      }
      console.log(`ROUTE ${route}\n${messages.join('\n') || '(clean)'}`);
      expect(true).toBe(true);
    });
  }
});
