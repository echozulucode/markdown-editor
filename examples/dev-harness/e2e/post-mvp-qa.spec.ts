import { expect, test, type Page } from '@playwright/test';

const screenshotRoutes = ['/examples', '/modes', '/renderers'] as const;
const representativeExampleShells = [
  'full-page-docs',
  'markdown-preview',
  'wysiwyg-contributor',
  'published-docs',
  'modal-quick-edit',
  'mobile-note',
  'conflict-resolver',
] as const;

test.describe('post-MVP visual QA artifacts', () => {
  for (const route of screenshotRoutes) {
    test(`${route} attaches screenshot artifact and avoids page-level horizontal overflow`, async ({
      page,
    }, testInfo) => {
      await page.goto(route);
      await expectRouteReady(page, route);
      await expectNoHorizontalOverflow(page, route);

      const screenshotName = `${route.replace('/', '')}-${testInfo.project.name}.png`;
      await testInfo.attach(screenshotName, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });
  }

  test('representative example shells have non-overlapping header and editor regions', async ({ page }) => {
    await page.goto('/examples');
    await expectRouteReady(page, '/examples');

    for (const shellId of representativeExampleShells) {
      const shell = page.getByTestId(`example-${shellId}`);
      const header = shell.locator(':scope > header');
      const firstEditor = shell.locator('.me-editor').first();

      await shell.scrollIntoViewIfNeeded();
      await expect(header).toBeVisible();
      await expect(firstEditor).toBeVisible();

      const [shellBox, headerBox, editorBox] = await Promise.all([
        shell.boundingBox(),
        header.boundingBox(),
        firstEditor.boundingBox(),
      ]);

      expect(shellBox, `${shellId} shell should have a rendered box`).not.toBeNull();
      expect(headerBox, `${shellId} header should have a rendered box`).not.toBeNull();
      expect(editorBox, `${shellId} editor should have a rendered box`).not.toBeNull();
      expect(headerBox!.width, `${shellId} header should not collapse`).toBeGreaterThan(200);
      expect(headerBox!.height, `${shellId} header should not collapse`).toBeGreaterThan(40);
      expect(editorBox!.width, `${shellId} editor should not collapse`).toBeGreaterThan(240);
      expect(editorBox!.height, `${shellId} editor should not collapse`).toBeGreaterThan(120);
      expect(
        editorBox!.y,
        `${shellId} editor should render after the shell header without overlap`,
      ).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
    }
  });
});

test.describe('post-MVP accessibility audit guards', () => {
  test('example buttons have accessible names and dialog shell exposes modal semantics', async ({ page }) => {
    await page.goto('/examples');
    await expectRouteReady(page, '/examples');

    const unlabeledButtons = await page.locator('button:visible').evaluateAll((buttons) =>
      buttons
        .map((button, index) => {
          const name =
            button.getAttribute('aria-label') ??
            button.getAttribute('title') ??
            button.textContent ??
            button.querySelector('svg title')?.textContent ??
            '';

          return {
            index,
            name: name.trim(),
            html: button.outerHTML.slice(0, 160),
          };
        })
        .filter((button) => button.name.length === 0),
    );

    expect(unlabeledButtons).toEqual([]);

    const dialog = page.getByRole('dialog', { name: 'API Rate Limits' });
    await dialog.scrollIntoViewIfNeeded();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('button', { name: 'Close quick edit' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Apply changes' })).toBeVisible();
  });

  test('stateful editor controls expose ARIA state during keyboard-oriented mode changes', async ({ page }) => {
    await page.goto('/modes');
    await expectRouteReady(page, '/modes');

    const card = page.getByTestId('mode-card-all-modes');
    const editorToolbar = card.getByRole('toolbar', { name: 'Editor controls' });

    await expect(editorToolbar.getByRole('button', { name: 'Hybrid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await editorToolbar.getByRole('button', { name: 'Rich Text' }).focus();
    await page.keyboard.press('Enter');

    const wysiwygToolbar = card.getByRole('toolbar', { name: 'Rich text formatting controls' });
    await expect(wysiwygToolbar).toBeVisible();
    await expect(wysiwygToolbar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed');
    await expect(wysiwygToolbar.getByRole('button', { name: 'Italic' })).toHaveAttribute(
      'aria-pressed',
    );
    await expect(wysiwygToolbar.getByLabel('Current block style')).toBeVisible();
    await expect(wysiwygToolbar.getByLabel('Insert block', { exact: true })).toBeVisible();
  });
});

test.describe('post-MVP performance budget smoke', () => {
  test('core QA routes become ready within draft local smoke budgets', async ({ page }, testInfo) => {
    for (const route of screenshotRoutes) {
      const start = performance.now();

      await page.goto(route);
      await expectRouteReady(page, route);

      const readyMs = Math.round(performance.now() - start);
      testInfo.annotations.push({
        type: 'route-ready-ms',
        description: `${route} ${readyMs}ms`,
      });

      expect(readyMs, `${route} should meet the draft route readiness budget`).toBeLessThan(8000);
    }
  });
});

async function expectRouteReady(page: Page, route: (typeof screenshotRoutes)[number]) {
  if (route === '/examples') {
    await expect(page.getByTestId('examples-gallery')).toBeVisible();
    await expect(page.getByTestId('example-full-page-docs')).toContainText(
      'Full-page technical docs editor',
    );
    return;
  }

  if (route === '/modes') {
    await expect(page.getByRole('heading', { name: 'Mode Matrix' })).toBeVisible();
    await expect(page.getByTestId('mode-card-all-modes')).toContainText('Markdown editor harness');
    return;
  }

  await expect(page.getByRole('heading', { name: 'Renderers' })).toBeVisible();
  await expect(page.getByLabel('Renderer preview harness').locator('.me-preview')).toContainText(
    'Renderer fixture',
  );
  await expect(page.locator('.me-renderer-plantuml svg')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth, `${label} should not overflow horizontally`).toBeLessThanOrEqual(
    metrics.clientWidth + 1,
  );
}
