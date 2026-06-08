import { expect, test } from '@playwright/test';

/**
 * Regression for the Mermaid "no text in the diagram" bug: the preview pipeline
 * runs renderer HTML through DOMPurify, which strips Mermaid's <foreignObject>
 * HTML labels. The fix configures Mermaid with top-level htmlLabels:false so it
 * emits SVG <text> labels that survive sanitization. The hybrid mode (which does
 * not sanitize) always showed text; this guards that preview now matches.
 */
test.describe('Mermaid renders visible label text', () => {
  test('preview mode shows Mermaid node label text (not stripped by sanitization)', async ({ page }) => {
    await page.goto('/renderers');
    const mermaid = page.locator('.me-preview .me-renderer-mermaid svg').first();
    await expect(mermaid).toBeVisible({ timeout: 15_000 });

    // The renderer fixture's flowchart has nodes Markdown -> Renderer -> Preview.
    await expect(mermaid).toContainText('Renderer');
    // Labels must be SVG <text>, not empty <foreignObject> wrappers.
    await expect(mermaid.locator('text', { hasText: 'Renderer' }).first()).toHaveCount(1);
    const emptyForeignObjects = await mermaid.evaluate((svg) =>
      Array.from(svg.querySelectorAll('foreignObject')).filter((fo) => (fo.textContent || '').trim() === '').length,
    );
    expect(emptyForeignObjects).toBe(0);
  });

  test('hybrid mode shows Mermaid node label text', async ({ page }) => {
    await page.goto('/modes');
    const card = page.getByTestId('mode-card-hybrid-only');
    const mermaid = card.locator('.me-renderer-mermaid svg').first();
    await expect(mermaid).toBeVisible({ timeout: 15_000 });
    await expect(mermaid).toContainText('Plan');
  });

  test('an invalid diagram fails soft without leaking Mermaid\'s error graphic', async ({ page }) => {
    await page.goto('/renderers');
    // The fixture has an intentionally invalid Mermaid block. It must surface as
    // our inline source fallback + a diagnostic, NOT Mermaid's own injected
    // "Syntax error in text / mermaid version X" graphic (suppressErrorRendering).
    await expect(page.locator('.me-renderer-error[data-language="mermaid"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Syntax error in text')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Diagnostics' }).locator('..')).toContainText(
      'renderer.mermaid.failed',
    );
  });
});
