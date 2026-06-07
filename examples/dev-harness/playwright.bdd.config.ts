import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Phase 2 of docs/bdd-coverage-and-test-plan.md: make the feature files
// executable. `bddgen` turns features/*.feature into Playwright tests that run
// through the step definitions in bdd-steps/ against the dev harness.
//
// Executable features. Add more globs here as their step definitions land.
// `@performance` scenarios (e.g. the diagram render-timeout) have no browser
// fixture and are covered at unit level, so they are excluded from this lane.
const testDir = defineBddConfig({
  featuresRoot: '../../features',
  features: [
    '../../features/inline_table_editing.feature',
    '../../features/diagram_rendering.feature',
  ],
  steps: ['bdd-steps/**/*.ts'],
  tags: 'not @performance',
});

// Setting BASE_URL points the run at an already-running server and disables the
// managed one — used to validate against a fresh server without touching :5173.
const externalServer = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Pilot runs on desktop only (validated). Add chromium-mobile once the table
  // steps are confirmed under touch emulation.
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: externalServer
    ? undefined
    : {
        command: 'pnpm dev -- --host 127.0.0.1 --port 5173',
        url: 'http://localhost:5173/examples',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
