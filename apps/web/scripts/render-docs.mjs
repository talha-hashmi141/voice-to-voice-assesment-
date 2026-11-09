#!/usr/bin/env node
/**
 * Renders the HTML documents in docs/src to PDF with headless Chromium (Playwright).
 * Mermaid diagrams are rendered in-page before printing, so they ship as vector graphics.
 * Usage: node scripts/render-docs.mjs [name ...]   (defaults to every *.html in docs/src)
 */
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(here, '..', '..', '..', 'docs');
const srcDir = join(docsDir, 'src');
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(srcDir).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));

const browser = await chromium.launch();
try {
  for (const name of names) {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text());
    });
    await page.goto(pathToFileURL(join(srcDir, `${name}.html`)).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60_000 });
    await page.emulateMedia({ media: 'print' });
    const output = join(docsDir, `${name}.pdf`);
    await page.pdf({
      path: output,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#8a8f98;padding:0 16mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">' +
        '<span class="title"></span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
    const diagrams = await page.locator('.mermaid svg').count();
    console.log(`${name}.pdf written (${diagrams} diagrams)${failures.length ? ` – page errors: ${failures.join(' | ')}` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
