import { beforeAll, describe, it, expect } from 'vitest';
import { MarkdownEditor } from '../src/index.js';
import { createDefaultRendererRegistry } from '@echozedlabs/renderers';
import { mount, flush } from './mount.js';

// CodeMirror block widgets need range geometry in jsdom.
beforeAll(() => {
  const range = document.createRange();
  const prototype = Object.getPrototypeOf(range) as Range & {
    getClientRects?: () => DOMRectList;
    getBoundingClientRect?: () => DOMRect;
  };
  prototype.getClientRects ??= () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: function* iterator() {} }) as DOMRectList;
  prototype.getBoundingClientRect ??= () => new DOMRect();
});

describe('MarkdownEditor — hybrid render sanitization', () => {
  it('sanitizes renderer HTML before the hybrid widget injects it (XSS parity with preview)', async () => {
    delete (globalThis as Record<string, unknown>).__xss;
    // A hostile/buggy renderer that returns an event handler in its HTML.
    const registry = createDefaultRendererRegistry({
      mermaid: async () => ({
        ok: true,
        html: '<div class="me-renderer-diagram"><img src="x" onerror="globalThis.__xss = true"></div>',
      }),
    });
    const doc = ['# Title', '', '```mermaid', 'graph TD', 'A --> B', '```', '', 'After'].join('\n');

    const { container, unmount } = mount(
      <MarkdownEditor value={doc} modes={['hybrid']} initialMode="hybrid" renderers={registry} />,
    );
    // Let the async hybrid block render settle.
    for (let i = 0; i < 6; i += 1) {
      await flush();
    }

    // The hybrid widget injected the renderer HTML — but the dangerous handler
    // must have been stripped (same sanitizer the preview surface uses).
    expect(container.innerHTML).not.toContain('onerror');
    expect((globalThis as Record<string, unknown>).__xss).toBeUndefined();
    // The benign diagram wrapper still rendered (sanitizer keeps safe markup).
    expect(container.querySelector('.me-renderer-diagram')).not.toBeNull();

    unmount();
  });
});
