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

    expect(editor.getSelection().anchor).toBe(markdown.indexOf('```ts'));

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
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
