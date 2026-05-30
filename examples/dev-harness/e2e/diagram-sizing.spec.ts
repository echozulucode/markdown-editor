import { expect, test } from '@playwright/test';

/**
 * Regression for "small PlantUML diagrams render too large on big screens".
 * A host SVG with only a viewBox (no width) is stretched to fill the container;
 * the PlantUML renderer now caps it at its intrinsic viewBox width so it never
 * upscales. The renderer fixture's diagram has viewBox width 520.
 */
test('PlantUML diagram does not upscale past its intrinsic width on a wide viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/renderers');

  const svg = page.locator('.me-preview .me-renderer-plantuml svg').first();
  await expect(svg).toBeVisible({ timeout: 15_000 });
  // The renderer applied the intrinsic-width cap (deterministic; auto-retries).
  await expect(svg).toHaveAttribute('style', /max-width:\s*520px/);

  // Measure the laid-out width; poll until the diagram has a real size, then
  // assert it is capped at intrinsic (~520) rather than stretched to the
  // >1000px container.
  const widthOf = () =>
    page.evaluate(() => {
      const el = document.querySelector('.me-preview .me-renderer-plantuml svg');
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
  await expect.poll(widthOf, { timeout: 8_000 }).toBeGreaterThan(100);
  expect(await widthOf()).toBeLessThanOrEqual(560);
});
