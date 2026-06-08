import { test as base, createBdd } from 'playwright-bdd';

/**
 * Per-scenario scratch state shared across steps (e.g. text typed in a When,
 * counts captured before an action so a later Then can compare).
 */
export interface TableWorld {
  typedText?: string;
  rowsBefore?: number;
  colsBefore?: number;
  /** Which mode card the current scenario is talking about (modes feature). */
  cardId?: string;
  /** A captured source string for before/after comparisons. */
  sourceBefore?: string;
}

export const test = base.extend<{ world: TableWorld }>({
  world: async ({}, use) => {
    await use({});
  },
});

export const { Given, When, Then } = createBdd(test);
