import { describe, it, expect } from 'vitest';
import React from 'react';
import { MarkdownEditor } from '../src/index.js';
import { mount, run, flush } from './mount.js';

interface LinkSuggestion {
  id: string;
  label: string;
  insertText: string;
}

/** Set a controlled input's value the way React's onChange expects. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  run(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('MarkdownEditor — host page search', () => {
  it('discards results from a superseded search', async () => {
    // searchLinks resolves only when the test chooses to, keyed by query, so we
    // can resolve an earlier (aborted) search after a later one.
    const resolvers: Record<string, (value: LinkSuggestion[]) => void> = {};
    const hostServices = {
      searchLinks: (query: string) =>
        new Promise<LinkSuggestion[]>((resolve) => {
          resolvers[query] = resolve;
        }),
    };

    const { container, unmount } = mount(
      <MarkdownEditor defaultValue={'note'} modes={['markdown']} hostServices={hostServices} />,
    );

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search pages"]')!;
    expect(input).not.toBeNull();

    // Start a search, then supersede it before it resolves.
    typeInto(input, 'alpha');
    typeInto(input, 'beta');

    // The later search resolves first and is shown.
    run(() => resolvers.beta?.([{ id: 'b', label: 'Beta Page', insertText: '[[Beta Page]]' }]));
    await flush();

    const optionText = () =>
      Array.from(container.querySelectorAll('[role="option"]')).map((o) => o.textContent ?? '');
    expect(optionText().some((t) => t.includes('Beta Page'))).toBe(true);

    // The earlier search resolves late — it must be ignored, not rendered.
    run(() => resolvers.alpha?.([{ id: 'a', label: 'Alpha Page', insertText: '[[Alpha Page]]' }]));
    await flush();

    expect(optionText().some((t) => t.includes('Alpha Page'))).toBe(false);
    expect(optionText().some((t) => t.includes('Beta Page'))).toBe(true);

    unmount();
  });
});
