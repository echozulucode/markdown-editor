import { expect, test } from '@playwright/test';

test.describe('mode matrix route', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/modes');
    await expect(page.getByRole('heading', { name: 'Mode Matrix' })).toBeVisible();
  });

  test('all-modes card switches among markdown, preview, and wysiwyg without losing content', async ({ page }) => {
    const card = page.getByTestId('mode-card-all-modes');
    const toolbar = card.locator('.me-toolbar').first();

    await expect(card.locator('.me-editor[data-mode="hybrid"]')).toBeVisible();
    await expect(card).toContainText('Markdown editor harness');

    await toolbar.getByRole('button', { name: 'Markdown' }).click();
    await expect(card.locator('.me-editor[data-mode="markdown"]')).toBeVisible();
    await expect(card.locator('.cm-content')).toContainText('Markdown editor harness');

    await toolbar.getByRole('button', { name: 'Preview' }).click();
    await expect(card.locator('.me-editor[data-mode="preview"]')).toBeVisible();
    await expect(card.locator('.me-preview')).toContainText('Markdown editor harness');
    await expect(card.locator('.me-renderer-task-checkbox')).toHaveCount(3);

    await toolbar.getByRole('button', { name: 'WYSIWYG' }).click();
    await expect(card.locator('.me-editor[data-mode="wysiwyg"]')).toBeVisible();
    await expect(card.getByRole('toolbar', { name: 'WYSIWYG formatting controls' })).toBeVisible();
    await expect(card).toContainText('Markdown editor harness');
  });

  test('markdown plus preview card only exposes its configured modes', async ({ page }) => {
    const card = page.getByTestId('mode-card-markdown-preview');
    const toolbar = card.locator('.me-toolbar').first();

    await expect(toolbar.getByRole('button', { name: 'Markdown' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Preview' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Hybrid' })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'WYSIWYG' })).toHaveCount(0);

    await toolbar.getByRole('button', { name: 'Preview' }).click();
    await expect(card.locator('.me-editor[data-mode="preview"]')).toBeVisible();
    await expect(card.locator('.me-preview')).toContainText('Markdown editor harness');
  });

  test('read-only preview card has rendered output and no editor toolbar', async ({ page }) => {
    const card = page.getByTestId('mode-card-read-only-preview');

    await expect(card.locator('.me-editor[data-mode="preview"][data-readonly="true"]')).toBeVisible();
    await expect(card.locator('.me-preview')).toContainText('Markdown editor harness');
    await expect(card.locator('.me-toolbar')).toHaveCount(0);
  });

  test('controlled external value updates propagate across mode cards', async ({ page }) => {
    const sourceCard = page.getByTestId('mode-card-markdown-preview');
    const allModesCard = page.getByTestId('mode-card-all-modes');
    const updatedMarkdown = '# External update\n\nShared host state reached every editor.';

    await sourceCard.locator('.cm-content').fill(updatedMarkdown);

    await expect(allModesCard).toContainText('External update');
    await allModesCard.locator('.me-toolbar').first().getByRole('button', { name: 'Preview' }).click();
    await expect(allModesCard.locator('.me-preview')).toContainText('Shared host state reached every editor.');
  });
});

test.describe('renderer route', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/renderers');
    await expect(page.getByRole('heading', { name: 'Renderers' })).toBeVisible();
  });

  test('renders highlighted code, diagrams, properties, and fallback diagnostics', async ({ page }) => {
    const preview = page.getByLabel('Renderer preview harness').locator('.me-preview');
    const diagnostics = page.getByRole('heading', { name: 'Diagnostics' }).locator('..');

    await expect(preview.locator('.me-renderer-code-highlight[data-language="ts"] .shiki')).toBeVisible();
    await expect(preview.locator('.me-renderer-code-highlight[data-language="python"] .shiki')).toBeVisible();
    await expect(preview.locator('.me-renderer-code-highlight[data-language="madeup"]')).toBeVisible();
    await expect(preview.locator('.me-renderer-mermaid svg').first()).toBeVisible();
    await expect(preview.locator('.me-renderer-plantuml svg')).toBeVisible();
    await expect(preview.locator('.me-renderer-error[data-language="mermaid"]')).toBeVisible();
    await expect(preview.locator('table')).toContainText('Expected behavior');
    await expect(preview.locator('.me-renderer-callout')).toContainText('Renderer contract');

    await expect(diagnostics).toContainText('renderer.code.language.unsupported');
    await expect(diagnostics).toContainText('renderer.mermaid.failed');
  });

  test('read-only source fixture remains non-editable while renderer failures stay inline', async ({ page }) => {
    const source = page.getByLabel('Renderer fixture Markdown source').locator('.cm-content');
    const preview = page.getByLabel('Renderer preview harness').locator('.me-preview');

    await expect(source).toHaveAttribute('contenteditable', 'false');
    await expect(source).toContainText('Renderer fixture');
    await expect(preview.locator('.me-renderer-error[data-language="mermaid"]')).toBeVisible();
    await expect(preview).toContainText('Renderer fixture');
  });
});

test.describe('responsive hardening routes', () => {
  for (const route of ['/modes', '/renderers']) {
    test(`${route} has no document-level horizontal overflow at phone, tablet, and desktop widths`, async ({ page }) => {
      for (const width of [390, 768, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await expect(page.getByRole('heading').first()).toBeVisible();

        const metrics = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));

        expect(metrics.scrollWidth, `${route} overflowed at ${width}px`).toBeLessThanOrEqual(
          metrics.clientWidth + 1,
        );
      }
    });
  }
});

test.describe('accessibility and performance smoke gates', () => {
  test('mode controls and WYSIWYG toolbar are keyboard reachable with stateful labels', async ({ page }) => {
    await page.goto('/modes');
    await expect(page.getByRole('heading', { name: 'Mode Matrix' })).toBeVisible();

    const card = page.getByTestId('mode-card-all-modes');
    const editorToolbar = card.getByRole('toolbar', { name: 'Editor controls' });

    await expect(editorToolbar.getByRole('button', { name: 'Hybrid' })).toHaveAttribute('aria-pressed', 'true');
    await editorToolbar.getByRole('button', { name: 'WYSIWYG' }).focus();
    await page.keyboard.press('Enter');

    const wysiwygToolbar = card.getByRole('toolbar', { name: 'WYSIWYG formatting controls' });
    await expect(wysiwygToolbar).toBeVisible();
    await expect(wysiwygToolbar.getByRole('button', { name: 'Bulleted list' })).toHaveAttribute('aria-pressed');
    await expect(wysiwygToolbar.getByLabel('Current block style')).toBeVisible();
    await expect(wysiwygToolbar.getByLabel('Insert block', { exact: true })).toBeVisible();
  });

  test('reduced-motion preference is accepted and core routes remain stable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/examples');
    await expect(page.getByTestId('examples-gallery')).toBeVisible();

    const motion = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(motion).toBe(true);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test('mode switch and typing smoke stay within MVP latency bounds', async ({ page }) => {
    await page.goto('/modes');
    await expect(page.getByRole('heading', { name: 'Mode Matrix' })).toBeVisible();

    const card = page.getByTestId('mode-card-all-modes');
    const toolbar = card.locator('.me-toolbar').first();
    const switchStart = performance.now();

    await toolbar.getByRole('button', { name: 'Preview' }).click();
    await expect(card.locator('.me-preview')).toContainText('Markdown editor harness');
    const switchMs = performance.now() - switchStart;

    await toolbar.getByRole('button', { name: 'Markdown' }).click();
    const editor = card.locator('.cm-content').first();
    await expect(editor).toBeVisible();

    const typingStart = performance.now();
    await editor.fill('# Performance smoke\n\nTyping latency gate.');
    await expect(editor).toContainText('Typing latency gate.');
    const typingMs = performance.now() - typingStart;

    expect(switchMs).toBeLessThan(5000);
    expect(typingMs).toBeLessThan(5000);
  });
});
