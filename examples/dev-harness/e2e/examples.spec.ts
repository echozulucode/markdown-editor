import { expect, test } from '@playwright/test';

test.describe('examples gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples');
    await expect(page.getByTestId('examples-gallery')).toBeVisible();
  });

  test('renders every required MVP host shell', async ({ page }) => {
    await expect(page.getByTestId('example-full-page-docs')).toContainText('Full-page technical docs editor');
    await expect(page.getByTestId('example-markdown-preview')).toContainText('Split source and preview workflow');
    await expect(page.getByTestId('example-hybrid-knowledge')).toContainText('Knowledge-base note editor');
    await expect(page.getByTestId('example-wysiwyg-contributor')).toContainText('Contributor article editor');
    await expect(page.getByTestId('example-published-docs')).toContainText('Published documentation page');
    await expect(page.getByTestId('example-comment-composer')).toContainText('Comment composer');
  });

  test('all-modes example exposes each mode control and technical content', async ({ page }) => {
    const example = page.getByTestId('example-full-page-docs');
    const toolbar = example.locator('.me-toolbar').first();

    await expect(toolbar.getByRole('button', { name: 'Hybrid' })).toHaveAttribute('aria-pressed', 'true');
    await expect(toolbar.getByRole('button', { name: 'Markdown' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Preview' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'WYSIWYG' })).toBeVisible();
    await expect(example).toContainText('Release Runbook');
    await expect(example).toContainText('Validate renderer isolation');
  });

  test('markdown plus preview example keeps source and rendered output visible', async ({ page }) => {
    const example = page.getByTestId('example-markdown-preview');

    await expect(example.locator('.me-editor[data-mode="markdown"]')).toBeVisible();
    await expect(example.locator('.me-editor[data-mode="preview"]')).toBeVisible();
    await expect(example.getByText('Release Runbook').first()).toBeVisible();
  });

  test('single-mode examples hide the mode switcher for focused host workflows', async ({ page }) => {
    await expect(page.getByTestId('example-hybrid-knowledge').getByRole('toolbar')).toHaveCount(1);
    await expect(page.getByTestId('example-wysiwyg-contributor').getByRole('button', { name: 'WYSIWYG' })).toHaveCount(0);
    await expect(page.getByTestId('example-published-docs').getByRole('toolbar')).toHaveCount(0);
    await expect(page.getByTestId('example-comment-composer').getByRole('toolbar')).toHaveCount(0);
  });

  test('wysiwyg examples render Font Awesome toolbar icons', async ({ page }) => {
    const example = page.getByTestId('example-wysiwyg-contributor');
    const toolbar = example.getByRole('toolbar', { name: 'WYSIWYG formatting controls' });

    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator('svg.svg-inline--fa')).toHaveCount(6);
  });

  test('read-only published docs render properties and code without editing chrome', async ({ page }) => {
    const example = page.getByTestId('example-published-docs');

    await expect(example.getByText('Published API Guide').first()).toBeVisible();
    await expect(example.getByText('Supported modes')).toBeVisible();
    await expect(example.getByText('version')).toBeVisible();
    await expect(example.getByRole('button')).toHaveCount(0);
  });

  test('compact comment composer edits markdown and updates host state', async ({ page }) => {
    const example = page.getByTestId('example-comment-composer');
    const editor = example.locator('.cm-content').first();

    await example.scrollIntoViewIfNeeded();
    await editor.fill('Ship it.');

    await expect(example).toContainText('Ship it.');
    await expect(example.getByText(/characters$/)).toBeVisible();
  });
});
