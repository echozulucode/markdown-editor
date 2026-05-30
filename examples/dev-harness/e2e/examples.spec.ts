import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

test.describe('examples gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples');
    await expect(page.getByTestId('examples-gallery')).toBeVisible();
  });

  test('renders every required MVP and Phase 4 host shell', async ({ page }) => {
    await expect(page.getByTestId('example-full-page-docs')).toContainText('Full-page technical docs editor');
    await expect(page.getByTestId('example-markdown-preview')).toContainText('Split source and preview workflow');
    await expect(page.getByTestId('example-hybrid-knowledge')).toContainText('Knowledge-base note editor');
    await expect(page.getByTestId('example-wysiwyg-contributor')).toContainText('Contributor article editor');
    await expect(page.getByTestId('example-published-docs')).toContainText('Published documentation page');
    await expect(page.getByTestId('example-comment-composer')).toContainText('Comment composer');
    await expect(page.getByTestId('example-side-pane-review')).toContainText('Side-pane review editor');
    await expect(page.getByTestId('example-modal-quick-edit')).toContainText('Modal quick-edit editor');
    await expect(page.getByTestId('example-technical-runbook')).toContainText('Technical runbook editor');
    await expect(page.getByTestId('example-mobile-note')).toContainText('Mobile-first note editor');
    await expect(page.getByTestId('example-ai-prompt-composer')).toContainText('AI prompt composer');
    await expect(page.getByTestId('example-host-services')).toContainText('Page mentions and image upload');
    await expect(page.getByTestId('example-conflict-resolver')).toContainText('Conflict/diff resolver');
  });

  test('all-modes example exposes each mode control and technical content', async ({ page }) => {
    const example = page.getByTestId('example-full-page-docs');
    const toolbar = example.locator('.me-toolbar').first();

    await expect(toolbar.getByRole('button', { name: 'Hybrid' })).toHaveAttribute('aria-pressed', 'true');
    await expect(toolbar.getByRole('button', { name: 'Markdown' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Preview' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Rich Text' })).toBeVisible();
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
    await expect(page.getByTestId('example-wysiwyg-contributor').getByRole('button', { name: 'Rich Text' })).toHaveCount(0);
    await expect(page.getByTestId('example-published-docs').getByRole('toolbar')).toHaveCount(0);
    await expect(page.getByTestId('example-comment-composer').getByRole('toolbar')).toHaveCount(0);
  });

  test('wysiwyg examples render Font Awesome toolbar icons', async ({ page }) => {
    const example = page.getByTestId('example-wysiwyg-contributor');
    const toolbar = example.getByRole('toolbar', { name: 'Rich text formatting controls' });

    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator('svg.svg-inline--fa')).toHaveCount(6);
  });

  test('wysiwyg code language popover survives scroll and resize without Lexical state errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const example = page.getByTestId('example-full-page-docs');
    await example.scrollIntoViewIfNeeded();
    await example.getByRole('button', { name: 'Rich Text' }).click();
    await expect(example.getByRole('toolbar', { name: 'Rich text formatting controls' })).toBeVisible();

    await example.locator('.me-wysiwyg-code').first().click();
    await expect(example.getByLabel('Code block language')).toBeVisible();

    await page.setViewportSize({ width: 1180, height: 780 });
    await example.locator('.me-wysiwyg').evaluate((element) => {
      element.scrollTop = 48;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(100);

    expect(pageErrors.filter((message) => message.includes('Unable to find an active editor state'))).toEqual([]);
  });

  test('hybrid examples expose compact schema-backed property editing', async ({ page }) => {
    const example = page.getByTestId('example-full-page-docs');

    await example.scrollIntoViewIfNeeded();
    await expect(example.locator('.cm-me-properties-heading')).toContainText('Properties');
    await expect(example.locator('.cm-me-property-row[data-property-key="tags"] .cm-me-property-tag')).toContainText([
      'release',
      'runbook',
    ]);

    await example.locator('.cm-me-property-row[data-property-key="tags"] .cm-me-property-tag-input').fill('qa');
    await page.keyboard.press('Enter');
    await expect(example.locator('.cm-me-property-row[data-property-key="tags"] .cm-me-property-tag')).toContainText([
      'release',
      'runbook',
      'qa',
    ]);

    await example.getByRole('button', { name: 'Add property' }).click();
    await expect(example.locator('.cm-me-property-row[data-property-key="review_time"]')).toBeVisible();

    await example.locator('.cm-me-property-row[data-property-key="title"] .cm-me-property-drag-handle').dispatchEvent(
      'keydown',
      { key: 'ArrowDown', altKey: true, bubbles: true },
    );
    await expect(example.locator('.cm-me-property-row').first()).toHaveAttribute('data-property-key', 'owner');

    await example.locator('[aria-label="published property settings"]').click();
    await expect(example.getByRole('menuitemradio', { name: 'Set published property type to Boolean' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
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

  test('side-pane review example keeps document context and review editor visible', async ({ page }) => {
    const example = page.getByTestId('example-side-pane-review');

    await example.scrollIntoViewIfNeeded();

    await expect(example.getByLabel('Document under review')).toBeVisible();
    await expect(example.getByLabel('Review side pane')).toBeVisible();
    await expect(example.locator('.me-editor[aria-label="Side-pane review editor"]')).toBeVisible();
    await expect(example.getByRole('button', { name: 'Resolve' })).toBeVisible();
    await expect(example.getByRole('button', { name: 'Request changes' })).toBeVisible();
  });

  test('modal quick-edit example renders as an accessible dialog editor', async ({ page }) => {
    const example = page.getByTestId('example-modal-quick-edit');
    const dialog = example.getByRole('dialog', { name: 'API Rate Limits' });

    await example.scrollIntoViewIfNeeded();

    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.me-editor[aria-label="Modal quick-edit editor"]')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close quick edit' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Apply changes' })).toBeVisible();
  });

  test('runbook, prompt, and conflict examples embed the expected editor instances', async ({ page }) => {
    const runbook = page.getByTestId('example-technical-runbook');
    const prompt = page.getByTestId('example-ai-prompt-composer');
    const conflict = page.getByTestId('example-conflict-resolver');

    await runbook.scrollIntoViewIfNeeded();
    await expect(runbook.getByLabel('Runbook outline')).toBeVisible();
    await expect(runbook.locator('.me-editor[aria-label="Technical runbook editor"]')).toBeVisible();
    await expect(runbook).toContainText('Incident Runbook');

    await prompt.scrollIntoViewIfNeeded();
    await expect(prompt.getByLabel('Available page mentions')).toContainText('[[Release Runbook]]');
    await expect(prompt.locator('.me-editor[aria-label="AI prompt composer with Markdown and page mentions"]')).toBeVisible();
    await expect(prompt.locator('.me-editor[aria-label="AI prompt rendered preview"]')).toBeVisible();

    await conflict.scrollIntoViewIfNeeded();
    await expect(conflict.locator('.me-editor[aria-label="Conflict base Markdown"]')).toBeVisible();
    await expect(conflict.locator('.me-editor[aria-label="Conflict incoming Markdown"]')).toBeVisible();
    await expect(conflict.locator('.me-editor[aria-label="Conflict resolved Markdown editor"]')).toBeVisible();
    await expect(conflict.locator('.me-editor')).toHaveCount(3);
  });

  test('host-service example inserts wiki-link suggestions and uploaded images', async ({ page }) => {
    const example = page.getByTestId('example-host-services');
    const editor = example.getByLabel('Host-service Markdown editor').locator('.cm-content');

    await example.scrollIntoViewIfNeeded();
    await editor.click();
    await page.keyboard.press('End');

    await example.getByLabel('Search pages').fill('release');
    await expect(example.getByRole('listbox', { name: 'Page suggestions' })).toBeVisible();
    await example.getByRole('option', { name: /Release Runbook/ }).click();

    await expect(editor).toContainText('[[Release Runbook]]');
    await expect(example.getByLabel('Host service activity')).toContainText('searchLinks("release")');

    await example.getByLabel('Upload image').setInputFiles({
      name: 'diagram.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect width="80" height="40" fill="#2f6f9f"/></svg>'),
    });

    await expect(editor).toContainText('![diagram](');
    await expect(example.getByLabel('Host service activity')).toContainText('uploadAsset("diagram.svg")');
    await expect(example.getByLabel('Host-service rendered preview').locator('img[alt="diagram"]')).toBeVisible();
  });

  test('gallery editors keep usable dimensions across responsive projects', async ({ page }) => {
    const editors = page.locator('[data-testid^="example-"] .me-editor');
    const count = await editors.count();

    expect(count).toBeGreaterThanOrEqual(17);

    for (let index = 0; index < count; index += 1) {
      const editor = editors.nth(index);
      await editor.scrollIntoViewIfNeeded();
      const box = await editor.boundingBox();

      expect(box, `editor ${index} should have a rendered box`).not.toBeNull();
      expect(box!.width, `editor ${index} should not collapse horizontally`).toBeGreaterThanOrEqual(280);
      expect(box!.height, `editor ${index} should remain accessible`).toBeGreaterThanOrEqual(160);
    }
  });
});
