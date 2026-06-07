import { test as base, createBdd } from 'playwright-bdd';

/**
 * Per-scenario scratch state shared across steps (e.g. text typed in a When,
 * counts captured before an action so a later Then can compare).
 */
export interface TableWorld {
  typedText?: string;
  rowsBefore?: number;
  colsBefore?: number;
}

export const test = base.extend<{ world: TableWorld }>({
  world: async ({}, use) => {
    await use({});
  },
});

export const { Given, When, Then } = createBdd(test);
