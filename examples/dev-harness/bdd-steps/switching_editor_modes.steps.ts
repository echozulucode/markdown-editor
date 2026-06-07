import { expect, type Locator, type Page } from '@playwright/test';
import { Given, When, Then } from './fixtures';

// The /modes route hosts several MarkdownEditor cards with different `modes`
// configurations; each scenario targets the relevant card (tracked in `world`).
const card = (page: Page, id: string): Locator => page.getByTestId(id);
const toolbarOf = (page: Page, id: string): Locator => card(page, id).locator('.me-toolbar').first();

Given('the host offers the author every editing mode for a document', async ({ page, world }) => {
  world.cardId = 'mode-card-all-modes';
  await page.goto('/modes');
  await expect(page.getByRole('heading', { name: 'Mode Matrix' })).toBeVisible();
  await expect(card(page, world.cardId)).toContainText('Markdown editor harness');
});

Given('the author is editing in Hybrid mode', async ({ page, world }) => {
  await expect(card(page, world.cardId!).locator('.me-editor[data-mode="hybrid"]')).toBeVisible();
});

When('the author switches through each available mode and back', async ({ page, world }) => {
  const tb = toolbarOf(page, world.cardId!);
  for (const mode of ['Markdown', 'Preview', 'Rich Text', 'Hybrid']) {
    await tb.getByRole('button', { name: mode }).click();
    await page.waitForTimeout(200);
  }
});

Then('the document content is unchanged', async ({ page, world }) => {
  await expect(card(page, world.cardId!)).toContainText('Markdown editor harness');
});

Given('the host offers only Markdown and Preview', async ({ page, world }) => {
  world.cardId = 'mode-card-markdown-preview';
  await card(page, world.cardId).scrollIntoViewIfNeeded();
  await expect(card(page, world.cardId)).toBeVisible();
});

When('the author opens the mode controls', async ({ page, world }) => {
  await expect(toolbarOf(page, world.cardId!)).toBeVisible();
});

Then('only Markdown and Preview are available', async ({ page, world }) => {
  const tb = toolbarOf(page, world.cardId!);
  await expect(tb.getByRole('button', { name: 'Markdown' })).toBeVisible();
  await expect(tb.getByRole('button', { name: 'Preview' })).toBeVisible();
});

Then('the other modes are not offered', async ({ page, world }) => {
  const tb = toolbarOf(page, world.cardId!);
  await expect(tb.getByRole('button', { name: 'Hybrid' })).toHaveCount(0);
  await expect(tb.getByRole('button', { name: 'Rich Text' })).toHaveCount(0);
});

Given('the document is offered as a read-only preview', async ({ page, world }) => {
  world.cardId = 'mode-card-read-only-preview';
  await card(page, world.cardId).scrollIntoViewIfNeeded();
  await expect(card(page, world.cardId)).toBeVisible();
});

When('the author views the document', async () => {
  // The read-only preview card renders on load; nothing to do.
});

Then('the rendered output is displayed', async ({ page, world }) => {
  await expect(card(page, world.cardId!).locator('.me-preview')).toContainText('Markdown editor harness');
});

Then('no editing controls are shown', async ({ page, world }) => {
  await expect(card(page, world.cardId!).locator('.me-toolbar')).toHaveCount(0);
});

Given('the author has made no edits', async ({ page, world }) => {
  world.cardId = 'mode-card-all-modes';
  await expect(card(page, world.cardId)).toBeVisible();
});

When('the author switches between modes', async ({ page, world }) => {
  const tb = toolbarOf(page, world.cardId!);
  await tb.getByRole('button', { name: 'Markdown' }).click();
  world.sourceBefore = (await card(page, world.cardId!).locator('.cm-content').first().innerText()).trim();
  await tb.getByRole('button', { name: 'Preview' }).click();
  await tb.getByRole('button', { name: 'Hybrid' }).click();
  await tb.getByRole('button', { name: 'Markdown' }).click();
});

Then('saving the document returns the original source unchanged', async ({ page, world }) => {
  const after = (await card(page, world.cardId!).locator('.cm-content').first().innerText()).trim();
  expect(after).toBe(world.sourceBefore);
});
