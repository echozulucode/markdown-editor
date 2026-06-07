import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Coverage for the hybrid mode inline-editable table (Obsidian-style): cells are
 * contenteditable and edits round-trip to the Markdown source, the contextual
 * toolbar and right-click context menu perform structural edits, and column
 * alignment is written back to the separator row. The `full-page-docs` example
 * starts in hybrid mode and contains a 3-column table.
 */
test.describe('hybrid editable tables', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples');
    await expect(page.getByTestId('examples-gallery')).toBeVisible();
  });

  function example(page: Page): Locator {
    return page.getByTestId('example-full-page-docs');
  }

  async function table(page: Page): Promise<Locator> {
    const shell = example(page);
    await shell.scrollIntoViewIfNeeded();
    const grid = shell.locator('.cm-me-table').first();
    await expect(grid).toBeVisible();
    return grid;
  }

  async function switchToMarkdown(page: Page): Promise<Locator> {
    await example(page).locator('.me-toolbar').first().getByRole('button', { name: 'Markdown' }).click();
    const source = example(page).locator('.cm-content').first();
    await expect(source).toBeVisible();
    return source;
  }

  test('editing a cell round-trips to the Markdown source', async ({ page }) => {
    const grid = await table(page);
    const cell = grid.locator('[contenteditable="true"]', { hasText: 'Syntax highlighting' }).first();

    await cell.click({ clickCount: 3 });
    await page.keyboard.type('Linting');

    const source = await switchToMarkdown(page);
    await expect(source).toContainText('Linting');
    await expect(source).not.toContainText('Syntax highlighting');
  });

  test('toolbar inserts a row that appears in the source', async ({ page }) => {
    const grid = await table(page);
    const firstBodyCell = grid.locator('tbody [contenteditable="true"]').first();
    await firstBodyCell.click();

    // The toolbar is a sibling of the table inside .cm-me-table-wrap, shown once
    // the table has focus-within.
    await example(page).locator('.cm-me-table-wrap button[aria-label="Insert row below"]').click();

    const source = await switchToMarkdown(page);
    // A new empty 3-column row serializes as an all-empty pipe row.
    await expect(source).toContainText('|  |  |  |');
  });

  test('right-click opens a context menu that dismisses on Escape', async ({ page }) => {
    const grid = await table(page);
    await grid.locator('tbody [contenteditable="true"]').first().click({ button: 'right' });

    const menu = page.locator('.cm-me-table-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Insert row above');
    await expect(menu).toContainText('Delete table');

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  });

  test('context-menu alignment writes the separator marker to the source', async ({ page }) => {
    const grid = await table(page);
    // Right-click a first-column cell, then center that column.
    await grid.locator('tbody tr').first().locator('[contenteditable="true"]').first().click({ button: 'right' });
    await page.locator('.cm-me-table-menu').getByRole('menuitem', { name: 'Align center' }).click();

    const source = await switchToMarkdown(page);
    await expect(source).toContainText(':--:');
  });

  test('the keyboard advances focus to the next cell', async ({ page }) => {
    const grid = await table(page);
    // Header is "Check | Owner | Status"; from the first cell, advance one cell.
    await grid.locator('thead [contenteditable="true"]').first().click();
    await page.keyboard.press('Tab');

    const focusedText = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(focusedText).toBe('Owner');
  });

  test('deleting the table removes it from the source', async ({ page }) => {
    const grid = await table(page);
    await grid.locator('tbody [contenteditable="true"]').first().click({ button: 'right' });
    await page.locator('.cm-me-table-menu').getByRole('menuitem', { name: 'Delete table' }).click();

    const source = await switchToMarkdown(page);
    // A cell unique to the table is gone; surrounding document content remains.
    await expect(source).not.toContainText('PlantUML rendering');
    await expect(source).toContainText('Release Runbook');
  });
});
