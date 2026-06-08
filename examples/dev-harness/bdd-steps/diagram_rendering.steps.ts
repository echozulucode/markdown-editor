import { expect, type Locator, type Page } from '@playwright/test';
import { Given, Then } from './fixtures';

// The /renderers route shows a read-only preview built from a fixture that
// contains a valid Mermaid diagram, a host-rendered PlantUML diagram, and an
// intentionally invalid Mermaid block — covering every diagram scenario.
const preview = (page: Page): Locator => page.getByLabel('Renderer preview harness').locator('.me-preview');
const diagnostics = (page: Page): Locator => page.getByRole('heading', { name: 'Diagnostics' }).locator('..');

Given('a document is shown in a rendered view', async ({ page }) => {
  await page.goto('/renderers');
  await expect(page.getByRole('heading', { name: 'Renderers' })).toBeVisible();
  await expect(preview(page)).toContainText('Renderer fixture');
});

// The fixture already contains each diagram kind, so these context steps assert
// the precondition rather than build new state.
Given('the document contains a valid diagram', async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-mermaid svg').first()).toBeVisible({ timeout: 15_000 });
});

Given('the host provides its own renderer for a diagram type', async () => {
  // The harness wires a host PlantUML renderer on the /renderers route.
});

Given('the document contains a diagram of that type', async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-plantuml svg')).toBeVisible({ timeout: 15_000 });
});

Given('the document contains a diagram with invalid syntax', async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-error[data-language="mermaid"]')).toBeVisible({ timeout: 15_000 });
});

Given('the document contains a diagram smaller than the available width', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/renderers');
  await expect(preview(page).locator('.me-renderer-plantuml svg')).toBeVisible({ timeout: 15_000 });
});

Then('the diagram is shown as a rendered picture', async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-mermaid svg').first()).toBeVisible();
});

Then('its labels are readable', async ({ page }) => {
  // The fixture flowchart has nodes Markdown -> Renderer -> Preview.
  await expect(preview(page).locator('.me-renderer-mermaid svg').first()).toContainText('Renderer');
});

Then("the diagram is rendered through the host's service", async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-plantuml svg')).toBeVisible();
});

Then('the document shows the diagram source as a fallback', async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-error[data-language="mermaid"]')).toBeVisible();
});

Then('the reader is told the diagram could not be rendered', async ({ page }) => {
  await expect(diagnostics(page)).toContainText('renderer.mermaid.failed');
});

Then('no diagram error graphic leaks onto the page', async ({ page }) => {
  await expect(page.getByText('Syntax error in text')).toHaveCount(0);
});

Then('the rest of the document still renders', async ({ page }) => {
  await expect(preview(page).locator('.me-renderer-mermaid svg').first()).toBeVisible();
  await expect(preview(page)).toContainText('Renderer fixture');
});

Then('the diagram keeps its natural size rather than being enlarged', async ({ page }) => {
  const svg = preview(page).locator('.me-renderer-plantuml svg').first();
  // The renderer caps a viewBox-only SVG at its intrinsic width (fixture: 520).
  await expect(svg).toHaveAttribute('style', /max-width:\s*520px/);
  const width = await svg.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  expect(width).toBeLessThanOrEqual(560);
});
