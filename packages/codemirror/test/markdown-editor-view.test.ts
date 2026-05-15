import { beforeAll, describe, expect, it } from 'vitest';
import { createMarkdownEditorView } from '../src/index.js';

beforeAll(() => {
  const range = document.createRange();
  const prototype = Object.getPrototypeOf(range) as Range & {
    getClientRects?: () => DOMRectList;
    getBoundingClientRect?: () => DOMRect;
  };

  prototype.getClientRects ??= () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterator() {},
  } as DOMRectList);
  prototype.getBoundingClientRect ??= () => new DOMRect();
});

describe('createMarkdownEditorView', () => {
  it('creates a markdown editor and exposes document operations', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const changes: string[] = [];
    const editor = createMarkdownEditorView({
      parent,
      markdown: '# Draft',
      mode: 'markdown',
      onChange(markdown) {
        changes.push(markdown);
      },
    });

    expect(editor.getMarkdown()).toBe('# Draft');

    editor.setSelection({ anchor: 0, head: 0 });
    editor.insertMarkdown('Updated ');

    expect(editor.getMarkdown()).toBe('Updated # Draft');
    expect(changes).toContain('Updated # Draft');

    editor.setMarkdown('Programmatic');
    expect(editor.getMarkdown()).toBe('Programmatic');
    expect(changes).not.toContain('Programmatic');

    editor.setMarkdown('Emitted', { emitChange: true });
    expect(changes).toContain('Emitted');

    editor.destroy();
    parent.remove();
  });

  it('clamps selection positions to the document bounds', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown: 'abc',
      mode: 'markdown',
    });

    editor.setSelection({ anchor: -50, head: 50 });

    expect(editor.getSelection()).toEqual({ anchor: 0, head: 3 });

    editor.destroy();
    parent.remove();
  });

  it('preserves selection through external value updates and read-only toggles', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown: 'alpha beta',
      mode: 'markdown',
    });

    editor.setSelection({ anchor: 6, head: 10 });
    editor.setReadOnly(true);
    expect(editor.getSelection()).toEqual({ anchor: 6, head: 10 });

    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: '!',
    });
    const allowed = parent.querySelector('.cm-content')?.dispatchEvent(beforeInput);

    expect(allowed).toBe(false);
    expect(beforeInput.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe('alpha beta');
    expect(editor.getSelection()).toEqual({ anchor: 6, head: 10 });

    editor.setMarkdown('short');
    expect(editor.getMarkdown()).toBe('short');
    expect(editor.getSelection()).toEqual({ anchor: 5, head: 5 });

    editor.setReadOnly(false);
    editor.insertMarkdown('!');
    expect(editor.getMarkdown()).toBe('short!');

    editor.destroy();
    parent.remove();
  });

  it('throws after the editor has been destroyed', () => {
    const parent = document.createElement('section');
    const editor = createMarkdownEditorView({
      parent,
      markdown: 'abc',
      mode: 'markdown',
    });

    editor.destroy();

    expect(() => editor.getMarkdown()).toThrow('destroyed');
  });

  it('renders inactive hybrid lines while leaving the selected line editable', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown: '# Title\n- [ ] Draft task\n- Bullet item',
      mode: 'hybrid',
    });

    expect(parent.querySelector('.cm-me-task-checkbox')).toBeInstanceOf(HTMLElement);
    expect(parent.querySelector('.cm-me-list-bullet')).toBeInstanceOf(HTMLElement);
    expect(parent.querySelector('.cm-me-hybrid-heading')).toBeNull();

    editor.setSelection({ anchor: 8, head: 8 });

    expect(parent.querySelector('.cm-me-hybrid-heading')).toBeInstanceOf(HTMLElement);
    expect(parent.querySelector('.cm-me-task-checkbox')).toBeNull();

    editor.destroy();
    parent.remove();
  });

  it('renders inactive hybrid fenced blocks while leaving the selected block editable', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = [
      '# Diagram',
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
    ].join('\n');

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridRenderMarkdown(blockMarkdown) {
        return {
          html: `<div class="rendered-fixture">${blockMarkdown.includes('mermaid') ? 'diagram' : 'block'}</div>`,
        };
      },
    });

    editor.setSelection({ anchor: 2, head: 2 });
    await flushPromises();

    expect(parent.querySelector('.rendered-fixture')?.textContent).toBe('diagram');

    parent.querySelector<HTMLElement>('.rendered-fixture')?.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    await flushPromises();

    expect(parent.querySelector('.rendered-fixture')).toBeNull();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('```mermaid'));

    editor.setSelection({ anchor: 2, head: 2 });
    await flushPromises();
    expect(parent.querySelector('.rendered-fixture')?.textContent).toBe('diagram');

    const insideFence = markdown.indexOf('graph TD');
    editor.setSelection({ anchor: insideFence, head: insideFence });
    await flushPromises();

    expect(parent.querySelector('.rendered-fixture')).toBeNull();

    editor.destroy();
    parent.remove();
  });

  it('contains rejected hybrid renderer failures inline without blocking source reveal', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = ['Before', '```mermaid', 'not valid', '```', 'After'].join('\n');

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridRenderMarkdown() {
        throw new Error('renderer failed');
      },
    });

    editor.setSelection({ anchor: markdown.indexOf('After'), head: markdown.indexOf('After') });
    await flushPromises();

    expect(parent.querySelector('.cm-me-rendered-block-error')?.textContent).toBe('renderer failed');
    expect(parent.textContent).toContain('After');

    parent.querySelector<HTMLElement>('.cm-me-rendered-block')?.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    await flushPromises();

    expect(parent.querySelector('.cm-me-rendered-block-error')).toBeNull();
    expect(parent.textContent).toContain('```mermaid');
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('```mermaid'));

    editor.destroy();
    parent.remove();
  });

  it('keeps adjacent active code and inactive Mermaid fences separated in hybrid mode', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = [
      '# Adjacent fences',
      '```ts',
      'const value = "---";',
      '```',
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      'After',
    ].join('\n');
    const renderedBlocks: string[] = [];

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridRenderMarkdown(blockMarkdown) {
        renderedBlocks.push(blockMarkdown);
        return {
          html: blockMarkdown.startsWith('```mermaid')
            ? '<div class="rendered-mermaid">diagram</div>'
            : '<div class="rendered-code">code</div>',
        };
      },
    });

    editor.setSelection({ anchor: markdown.indexOf('After'), head: markdown.indexOf('After') });
    await flushPromises();

    expect(parent.querySelector('.rendered-code')).toBeInstanceOf(HTMLElement);
    expect(parent.querySelector('.rendered-mermaid')).toBeInstanceOf(HTMLElement);

    parent.querySelector<HTMLElement>('.rendered-code')?.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    await flushPromises();

    expect(parent.querySelector('.rendered-code')).toBeNull();
    expect(parent.querySelector('.rendered-mermaid')).toBeInstanceOf(HTMLElement);
    expect(parent.textContent).toContain('const value = "---";');
    expect(parent.textContent).not.toContain('```mermaid');
    expect(renderedBlocks).not.toContain('```\n```mermaid');
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('```ts'));

    editor.destroy();
    parent.remove();
  });

  it('moves into inactive hybrid fenced blocks with arrow keys', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = ['Before', '```ts', 'const value = 1;', '```', 'After'].join('\n');

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridRenderMarkdown() {
        return { html: '<div class="rendered-fixture">code</div>' };
      },
    });

    editor.setSelection({ anchor: 0, head: 0 });
    parent.querySelector('.cm-content')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await flushPromises();

    expect(parent.querySelector('.rendered-fixture')).toBeNull();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('```ts'));

    const afterPosition = markdown.indexOf('After');
    editor.setSelection({ anchor: afterPosition, head: afterPosition });
    parent.querySelector('.cm-content')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    await flushPromises();

    expect(editor.getSelection().anchor).toBe(markdown.lastIndexOf('```', afterPosition));

    parent.querySelector('.cm-content')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    await flushPromises();

    expect(editor.getSelection().anchor).toBe(markdown.indexOf('const value = 1;'));

    editor.destroy();
    parent.remove();
  });

  it('renders inactive hybrid table image and callout blocks through the markdown renderer', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = [
      '# Blocks',
      '| Name | Status |',
      '| --- | --- |',
      '| Hybrid | Ready |',
      '',
      '![Alt text](data:image/svg+xml,%3Csvg%3E%3C/svg%3E)',
      '',
      '> [!note] Heads up',
      '> Render this callout',
    ].join('\n');

    const renderedBlocks: string[] = [];
    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridRenderMarkdown(blockMarkdown) {
        renderedBlocks.push(blockMarkdown);
        if (blockMarkdown.startsWith('|')) {
          return { html: '<table class="rendered-table"><tbody><tr><td>Hybrid</td></tr></tbody></table>' };
        }
        if (blockMarkdown.startsWith('![')) {
          return { html: '<img class="rendered-image" alt="Alt text">' };
        }
        return { html: '<aside class="rendered-callout">Heads up</aside>' };
      },
    });

    editor.setSelection({ anchor: 2, head: 2 });
    await flushPromises();

    expect(parent.querySelector('.rendered-table')).toBeInstanceOf(HTMLTableElement);
    expect(parent.querySelector('.rendered-image')).toBeInstanceOf(HTMLImageElement);
    expect(parent.querySelector('.rendered-callout')).toBeInstanceOf(HTMLElement);
    expect(renderedBlocks).toContain('| Name | Status |\n| --- | --- |\n| Hybrid | Ready |');

    parent.querySelector<HTMLElement>('.rendered-table')?.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    await flushPromises();

    expect(parent.querySelector('.rendered-table')).toBeNull();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('| Name | Status |'));

    editor.destroy();
    parent.remove();
  });

  it('renders inactive hybrid links and wiki-links while leaving the selected line editable', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = 'See [docs](https://example.test) and [[Page Name|page]].\nNext line';

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
    });

    editor.setSelection({ anchor: markdown.indexOf('Next line'), head: markdown.indexOf('Next line') });

    expect(parent.querySelector('.cm-me-hybrid-link')?.textContent).toBe('docs');
    expect(parent.querySelector('.cm-me-hybrid-wiki-link')?.textContent).toBe('page');

    parent.querySelector<HTMLElement>('.cm-me-hybrid-link')?.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );

    expect(parent.querySelector('.cm-me-hybrid-link')).toBeNull();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('[docs]'));

    editor.destroy();
    parent.remove();
  });

  it('moves into inactive hybrid table image and callout blocks with arrow keys', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = [
      'Before table',
      '| Name | Status |',
      '| --- | --- |',
      '| Hybrid | Ready |',
      'After table',
      '![Alt text](data:image/svg+xml,%3Csvg%3E%3C/svg%3E)',
      'After image',
      '> [!note] Heads up',
      '> Render this callout',
      'After callout',
    ].join('\n');

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridRenderMarkdown(blockMarkdown) {
        return { html: `<div class="rendered-fixture">${blockMarkdown.slice(0, 8)}</div>` };
      },
    });

    editor.setSelection({ anchor: 0, head: 0 });
    parent.querySelector('.cm-content')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await flushPromises();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('| Name | Status |'));

    const afterImage = markdown.indexOf('After image');
    editor.setSelection({ anchor: afterImage, head: afterImage });
    parent.querySelector('.cm-content')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    await flushPromises();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('![Alt text]'));

    const afterCallout = markdown.indexOf('After callout');
    editor.setSelection({ anchor: afterCallout, head: afterCallout });
    parent.querySelector('.cm-content')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    await flushPromises();
    expect(editor.getSelection().anchor).toBe(markdown.indexOf('> Render this callout'));

    editor.destroy();
    parent.remove();
  });

  it('renders inactive frontmatter as properties and can hide it', () => {
    const markdown = ['---', 'title: Hybrid notes', 'tags: editor, mvp', '---', '# Title'].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
    });

    const bodyPosition = markdown.indexOf('# Title');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    expect(parent.querySelector('.cm-me-properties-table')).toBeInstanceOf(HTMLElement);
    expect(parent.querySelector<HTMLInputElement>('.cm-me-property-input')?.value).toBe('Hybrid notes');

    editor.destroy();
    parent.remove();

    const hiddenParent = document.createElement('section');
    document.body.appendChild(hiddenParent);
    const hiddenEditor = createMarkdownEditorView({
      parent: hiddenParent,
      markdown,
      mode: 'hybrid',
      hybridFrontmatterMode: 'hidden',
    });

    hiddenEditor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    expect(hiddenParent.querySelector('.cm-me-properties-table')).toBeNull();
    expect(hiddenParent.querySelector('.cm-me-property-input')).toBeNull();

    hiddenEditor.destroy();
    hiddenParent.remove();
  });

  it('edits frontmatter values through the hybrid properties table', () => {
    const markdown = ['---', 'title: Hybrid notes', 'tags: editor, mvp', '---', '# Title'].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const changes: string[] = [];

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      onChange(nextMarkdown) {
        changes.push(nextMarkdown);
      },
    });

    const bodyPosition = markdown.indexOf('# Title');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    const titleInput = parent.querySelector<HTMLInputElement>('.cm-me-property-input');
    expect(titleInput).toBeInstanceOf(HTMLInputElement);

    titleInput!.value = 'Updated notes';
    titleInput!.dispatchEvent(new Event('change', { bubbles: true }));

    expect(editor.getMarkdown()).toContain('title: Updated notes');
    expect(changes.at(-1)).toContain('title: Updated notes');
    expect(parent.querySelector('.cm-me-properties-table')).toBeInstanceOf(HTMLElement);

    editor.destroy();
    parent.remove();
  });

  it('reorders adds and removes frontmatter properties through the hybrid panel', () => {
    const markdown = ['---', 'title: Hybrid notes', 'tags: editor, mvp', '---', '# Title'].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
    });

    const bodyPosition = markdown.indexOf('# Title');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    parent.querySelector<HTMLButtonElement>('.cm-me-property-move-down')?.click();
    expect(editor.getMarkdown()).toBe(['---', 'tags: editor, mvp', 'title: Hybrid notes', '---', '# Title'].join('\n'));

    parent.querySelector<HTMLButtonElement>('.cm-me-property-add')?.click();
    expect(editor.getMarkdown()).toContain('property: ');

    const keyInputs = parent.querySelectorAll<HTMLInputElement>('.cm-me-property-key-input');
    const valueInputs = parent.querySelectorAll<HTMLInputElement>('.cm-me-property-input');
    keyInputs[keyInputs.length - 1]!.value = 'status';
    keyInputs[keyInputs.length - 1]!.dispatchEvent(new Event('change', { bubbles: true }));

    const updatedValueInputs = parent.querySelectorAll<HTMLInputElement>('.cm-me-property-input');
    updatedValueInputs[updatedValueInputs.length - 1]!.value = 'Ready';
    updatedValueInputs[updatedValueInputs.length - 1]!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.getMarkdown()).toContain('status: Ready');

    parent.querySelector<HTMLButtonElement>('[aria-label="Remove title property"]')?.click();
    expect(editor.getMarkdown()).toBe(['---', 'tags: editor, mvp', 'status: Ready', '---', '# Title'].join('\n'));
    expect(parent.querySelectorAll('.cm-me-property-input')).toHaveLength(2);

    editor.destroy();
    parent.remove();
  });

  it('edits typed frontmatter values and type affordances through the hybrid panel', () => {
    const markdown = [
      '---',
      'published: true',
      'due: 2026-05-15',
      'alarm: 09:30',
      'tags:',
      '  - editor',
      '  - mvp',
      'status: Draft',
      '---',
      '# Title',
    ].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
    });

    const bodyPosition = markdown.indexOf('# Title');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    expect(parent.querySelector('[data-property-type="boolean"] .cm-me-property-type-icon')?.textContent).toBe('B');
    expect(parent.querySelector('[data-property-type="date"] .cm-me-property-type-icon')?.textContent).toBe('D');
    expect(parent.querySelector('[data-property-type="time"] .cm-me-property-type-icon')?.textContent).toBe('H');
    expect(parent.querySelector('[data-property-type="tags"] .cm-me-property-type-icon')?.textContent).toBe('#');

    const publishedInput = parent.querySelector<HTMLInputElement>('[aria-label="published property value"]');
    publishedInput!.checked = false;
    publishedInput!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.getMarkdown()).toContain('published: false');

    const dueInput = parent.querySelector<HTMLInputElement>('[aria-label="due property value"]');
    dueInput!.value = '2026-06-01';
    dueInput!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.getMarkdown()).toContain('due: 2026-06-01');

    const alarmInput = parent.querySelector<HTMLInputElement>('[aria-label="alarm property value"]');
    alarmInput!.value = '10:45';
    alarmInput!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.getMarkdown()).toContain('alarm: 10:45');

    const tagsInput = parent.querySelector<HTMLInputElement>('[aria-label="tags property value"]');
    tagsInput!.value = 'release, post-mvp';
    tagsInput!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.getMarkdown()).toContain('tags: release, post-mvp');

    const statusType = parent.querySelector<HTMLSelectElement>('[aria-label="status property type"]');
    statusType!.value = 'boolean';
    statusType!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.getMarkdown()).toContain('status: false');

    editor.destroy();
    parent.remove();
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
