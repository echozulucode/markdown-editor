import { expect, type Locator, type Page } from '@playwright/test';
import { Given, When, Then } from './fixtures';

// The bdd-table example is an UNCONTROLLED hybrid editor with a 3-column,
// 3-row table — a stable surface (no controlled-value round-trip) for these
// scenarios.
const example = (page: Page): Locator => page.getByTestId('example-bdd-table');
const grid = (page: Page): Locator => example(page).locator('.cm-me-table').first();

/** Leave the table, switch the example to Markdown, and return the source view. */
async function markdownSource(page: Page): Promise<Locator> {
  await example(page).locator('.me-toolbar').first().getByRole('button', { name: 'Markdown' }).click();
  const source = example(page).locator('.cm-content').first();
  await expect(source).toBeVisible();
  return source;
}

function contextMenu(page: Page): Locator {
  return page.locator('.cm-me-table-menu');
}

async function openMenuOnFirstBodyCell(page: Page): Promise<void> {
  await grid(page).locator('tbody [contenteditable="true"]').first().click({ button: 'right' });
  await expect(contextMenu(page)).toBeVisible();
}

// --- Background ---

Given('the author is editing a document with a table in Hybrid mode', async ({ page }) => {
  await page.goto('/examples');
  await expect(page.getByTestId('examples-gallery')).toBeVisible();
  await example(page).scrollIntoViewIfNeeded();
  await expect(grid(page)).toBeVisible();
});

// --- Editing a cell ---

When('the author changes the text of a cell', async ({ page, world }) => {
  const cell = grid(page).locator('[contenteditable="true"]', { hasText: 'Syntax highlighting' }).first();
  await cell.click({ clickCount: 3 });
  world.typedText = 'Linting';
  await page.keyboard.type(world.typedText);
});

Then('the document reflects the new cell text', async ({ page, world }) => {
  const source = await markdownSource(page);
  await expect(source).toContainText(world.typedText!);
});

// --- Keyboard navigation ---

Given('the author is editing a cell', async ({ page }) => {
  await grid(page).locator('thead [contenteditable="true"]').first().click();
});

When('the author advances to the next cell', async ({ page }) => {
  await page.keyboard.press('Tab');
});

Then('the next cell becomes ready for editing', async ({ page }) => {
  const focused = await page.evaluate(() => ({
    editable: document.activeElement?.getAttribute('contenteditable'),
    text: document.activeElement?.textContent,
  }));
  expect(focused.editable).toBe('true');
  expect(focused.text).toBe('Owner');
});

// --- Inserting a row ---

When('the author inserts a row below the current row', async ({ page, world }) => {
  await grid(page).locator('tbody [contenteditable="true"]').first().click();
  world.rowsBefore = await grid(page).locator('tbody tr').count();
  await example(page).locator('.cm-me-table-wrap button[aria-label="Insert row below"]').click();
});

Then('the table has an additional empty row', async ({ page, world }) => {
  await expect(grid(page).locator('tbody tr')).toHaveCount((world.rowsBefore ?? 0) + 1);
});

Then('the document reflects the added row', async ({ page }) => {
  const source = await markdownSource(page);
  await expect(source).toContainText('|  |  |  |');
});

// --- Inserting a column ---

When('the author inserts a column beside the current column', async ({ page, world }) => {
  await grid(page).locator('tbody [contenteditable="true"]').first().click();
  world.colsBefore = await grid(page).locator('thead th').count();
  await example(page).locator('.cm-me-table-wrap button[aria-label="Insert column right"]').click();
});

Then('the table has an additional empty column', async ({ page, world }) => {
  await expect(grid(page).locator('thead th')).toHaveCount((world.colsBefore ?? 0) + 1);
});

Then('the document reflects the added column', async ({ page }) => {
  const source = await markdownSource(page);
  await expect(source).toContainText('| Check |  | Owner |');
});

// --- Column alignment ---

When('the author centers the current column', async ({ page }) => {
  await grid(page).locator('tbody tr').first().locator('[contenteditable="true"]').first().click({ button: 'right' });
  await contextMenu(page).getByRole('menuitem', { name: 'Align center' }).click();
});

Then("the column's contents are centered", async ({ page }) => {
  const firstColumnCell = grid(page).locator('tbody tr').first().locator('[contenteditable="true"]').first();
  await expect(firstColumnCell).toHaveCSS('text-align', 'center');
});

Then('the document records the column as centered', async ({ page }) => {
  const source = await markdownSource(page);
  await expect(source).toContainText(':--:');
});

// --- Deleting a row ---

Given('the table has more than one body row', async ({ page }) => {
  expect(await grid(page).locator('tbody tr').count()).toBeGreaterThan(1);
});

When('the author deletes the current row', async ({ page, world }) => {
  world.rowsBefore = await grid(page).locator('tbody tr').count();
  const firstRow = grid(page).locator('tbody tr').first();
  world.typedText = (await firstRow.locator('[contenteditable="true"]').first().textContent()) ?? '';
  await firstRow.locator('[contenteditable="true"]').first().click({ button: 'right' });
  await contextMenu(page).getByRole('menuitem', { name: 'Delete row' }).click();
});

Then('that row is removed from the table and the document', async ({ page, world }) => {
  await expect(grid(page).locator('tbody tr')).toHaveCount((world.rowsBefore ?? 1) - 1);
  const source = await markdownSource(page);
  await expect(source).not.toContainText(world.typedText!);
});

// --- Keeping at least one column ---

Given('the table has a single column', async ({ page }) => {
  // The widget rebuilds on every commit (controlled editor), so wait for each
  // delete to settle via a retrying count before issuing the next.
  await expect(grid(page).locator('thead th')).toHaveCount(3);
  for (const remaining of [2, 1]) {
    await grid(page).locator('thead th').first().click({ button: 'right' });
    await contextMenu(page).getByRole('menuitem', { name: 'Delete column' }).click();
    await expect(grid(page).locator('thead th')).toHaveCount(remaining);
  }
});

When('the author tries to delete that column', async ({ page }) => {
  await grid(page).locator('thead th').first().click({ button: 'right' });
  // "Delete column" is disabled with one column left; force the click past the
  // actionability check so the attempt is made and proves to be a no-op.
  await contextMenu(page).getByRole('menuitem', { name: 'Delete column' }).click({ force: true });
});

Then('the column remains so the block is still a table', async ({ page }) => {
  await expect(grid(page).locator('thead th')).toHaveCount(1);
});

// --- Removing the table ---

When('the author deletes the table', async ({ page }) => {
  await openMenuOnFirstBodyCell(page);
  await contextMenu(page).getByRole('menuitem', { name: 'Delete table' }).click();
});

Then('the table is removed from the document', async ({ page }) => {
  const source = await markdownSource(page);
  await expect(source).not.toContainText('PlantUML rendering');
  await expect(source).toContainText('Table editing fixture');
});

// --- Context menu ---

When('the author opens the context menu on a cell', async ({ page }) => {
  await openMenuOnFirstBodyCell(page);
});

Then('the menu offers row, column, alignment, and delete operations', async ({ page }) => {
  const labels = await contextMenu(page).locator('.cm-me-table-menu-item').allTextContents();
  expect(labels).toContain('Insert row above');
  expect(labels).toContain('Insert column left');
  expect(labels).toContain('Align center');
  expect(labels).toContain('Delete table');
});

Given('the author has opened the context menu on a cell', async ({ page }) => {
  await openMenuOnFirstBodyCell(page);
});

When('the author dismisses the menu without choosing an operation', async ({ page }) => {
  await page.keyboard.press('Escape');
});

Then('the document is unchanged', async ({ page }) => {
  await expect(contextMenu(page)).toHaveCount(0);
  // No structural change: the table keeps its original shape.
  await expect(grid(page).locator('thead th')).toHaveCount(3);
  await expect(grid(page).locator('tbody tr')).toHaveCount(3);
});
