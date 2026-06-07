import { undo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
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

  it('renders an editable table widget and routes image/callout blocks through the markdown renderer', async () => {
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

    // Tables now render as the always-on editable widget (not via the renderer).
    expect(parent.querySelector('.cm-me-table')).toBeInstanceOf(HTMLTableElement);
    expect(parent.querySelectorAll('.cm-me-table [contenteditable="true"]').length).toBeGreaterThan(0);
    // Images and callouts still render through the markdown renderer.
    expect(parent.querySelector('.rendered-image')).toBeInstanceOf(HTMLImageElement);
    expect(parent.querySelector('.rendered-callout')).toBeInstanceOf(HTMLElement);
    // The table is handled by the editable widget, so it is NOT sent to the renderer.
    expect(renderedBlocks).not.toContain('| Name | Status |\n| --- | --- |\n| Hybrid | Ready |');
    expect(renderedBlocks.some((block) => block.startsWith('!['))).toBe(true);

    editor.destroy();
    parent.remove();
  });

  it('exposes table tools via a toolbar and a right-click context menu', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = ['# T', '| Name | Status |', '| --- | --- |', '| Hybrid | Ready |'].join('\n');
    const editor = createMarkdownEditorView({ parent, markdown, mode: 'hybrid' });
    editor.setSelection({ anchor: 1, head: 1 });
    await flushPromises();

    // The contextual toolbar surfaces the structural operations.
    expect(parent.querySelector('.cm-me-table-toolbar')).toBeInstanceOf(HTMLElement);
    expect(parent.querySelector('button[aria-label="Insert column right"]')).toBeInstanceOf(HTMLButtonElement);
    expect(parent.querySelector('button[aria-label="Align center"]')).toBeInstanceOf(HTMLButtonElement);
    expect(parent.querySelector('button[aria-label="Delete table"]')).toBeInstanceOf(HTMLButtonElement);

    // Right-clicking a cell opens an identical context menu (appended to <body>).
    const cell = parent.querySelector<HTMLElement>('.cm-me-table [contenteditable="true"]')!;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 5, clientY: 5 }));
    const menu = document.body.querySelector('.cm-me-table-menu');
    expect(menu).toBeInstanceOf(HTMLElement);
    const itemLabels = Array.from(menu!.querySelectorAll('.cm-me-table-menu-item')).map((i) => i.textContent);
    expect(itemLabels).toContain('Insert row above');
    expect(itemLabels).toContain('Delete table');

    // Escape dismisses the menu.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.querySelector('.cm-me-table-menu')).toBeNull();

    // A toolbar op edits the Markdown source (inserts a column).
    parent.querySelector<HTMLElement>('button[aria-label="Insert column right"]')!.click();
    expect(editor.getMarkdown()).toContain('| Name |  | Status |');

    editor.destroy();
    parent.remove();
  });

  it('removes the whole table from the source via the context menu', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = ['# T', '| Name | Status |', '| --- | --- |', '| Hybrid | Ready |'].join('\n');
    const editor = createMarkdownEditorView({ parent, markdown, mode: 'hybrid' });
    editor.setSelection({ anchor: 1, head: 1 });
    await flushPromises();

    const cell = parent.querySelector<HTMLElement>('.cm-me-table [contenteditable="true"]')!;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 5, clientY: 5 }));
    const deleteItem = Array.from(document.body.querySelectorAll<HTMLElement>('.cm-me-table-menu-item')).find(
      (item) => item.textContent === 'Delete table',
    )!;
    expect(deleteItem).toBeInstanceOf(HTMLElement);
    deleteItem.click();

    expect(editor.getMarkdown()).not.toContain('| Name | Status |');
    expect(editor.getMarkdown()).not.toContain('| Hybrid | Ready |');
    expect(editor.getMarkdown()).toContain('# T');

    editor.destroy();
    parent.remove();
  });

  it('undoes a change, restoring the previous text', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    let view: EditorView | null = null;
    const editor = createMarkdownEditorView({
      parent,
      markdown: 'Hello',
      mode: 'markdown',
      extensions: [EditorView.updateListener.of((update) => { view = update.view; })],
    });
    // Force one update so the listener captures the view.
    editor.setSelection({ anchor: 0, head: 0 });
    const captured = view as EditorView | null;
    expect(captured).not.toBeNull();

    captured!.dispatch({ changes: { from: 5, insert: ' world' }, userEvent: 'input' });
    expect(editor.getMarkdown()).toBe('Hello world');

    undo(captured!);
    expect(editor.getMarkdown()).toBe('Hello');

    editor.destroy();
    parent.remove();
  });

  it('detects center-aligned and single-column tables as editable widgets in hybrid', async () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const markdown = [
      '# T',
      '| A | B |',
      '| :--: | --- |',
      '| 1 | 2 |',
      '',
      '| Solo |',
      '| --- |',
      '| x |',
    ].join('\n');
    const editor = createMarkdownEditorView({ parent, markdown, mode: 'hybrid' });
    editor.setSelection({ anchor: 1, head: 1 });
    await flushPromises();

    // Both the center-aligned (`:--:`) and the single-column table must render as
    // editable widgets, not fall back to source.
    expect(parent.querySelectorAll('.cm-me-table')).toHaveLength(2);

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

  it('renders inactive frontmatter as properties and can collapse or hide it', () => {
    const markdown = ['---', 'title: Hybrid notes', 'topic: Research', 'tags: editor, mvp', '---', '# Title'].join('\n');
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
    expect(parent.querySelector<HTMLDetailsElement>('.cm-me-properties-details')?.open).toBe(true);
    expect(parent.querySelector<HTMLInputElement>('.cm-me-property-input')?.value).toBe('Hybrid notes');

    editor.destroy();
    parent.remove();

    const collapsedParent = document.createElement('section');
    document.body.appendChild(collapsedParent);
    const collapsedEditor = createMarkdownEditorView({
      parent: collapsedParent,
      markdown,
      mode: 'hybrid',
      hybridFrontmatterMode: 'collapsed',
    });

    collapsedEditor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    const collapsedDetails = collapsedParent.querySelector<HTMLDetailsElement>('.cm-me-properties-details');
    expect(collapsedDetails).toBeInstanceOf(HTMLDetailsElement);
    expect(collapsedDetails?.open).toBe(false);
    expect(collapsedParent.querySelector('[data-property-key="topic"]')?.textContent).toBe('topic: Research');
    expect(collapsedParent.querySelector<HTMLInputElement>('.cm-me-property-input')?.value).toBe('Hybrid notes');

    collapsedParent.querySelector<HTMLElement>('.cm-me-properties-heading')?.click();
    expect(collapsedDetails?.open).toBe(true);
    expect(collapsedParent.querySelector('.cm-me-properties-table')).toBeInstanceOf(HTMLElement);

    collapsedEditor.destroy();
    collapsedParent.remove();

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

  it('prevents destructive keyboard and beforeinput events at the first body position from deleting hidden frontmatter', async () => {
    const markdown = ['---', 'title: Hybrid notes', 'status: draft', '---', '# Title'].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    let capturedView: EditorView | null = null;

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      extensions: [EditorView.updateListener.of((update) => {
        capturedView = update.view;
      })],
    });

    const bodyPosition = markdown.indexOf('# Title');
    const content = parent.querySelector('.cm-content');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });
    content?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
    );
    await flushPromises();

    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'deleteContentBackward',
    });
    const allowed = content?.dispatchEvent(beforeInput);
    await flushPromises();

    expect(allowed).toBe(false);
    expect(beforeInput.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe(markdown);

    // Regression for the actual CodeMirror mutation path: even if a command or
    // browser edit attempts to remove the hidden closing-delimiter newline, the
    // protected frontmatter transaction is filtered before it can corrupt YAML.
    expect(capturedView).toBeInstanceOf(EditorView);
    capturedView!.dispatch({
      changes: { from: bodyPosition - 1, to: bodyPosition, insert: '' },
      userEvent: 'delete.backward',
    });
    expect(editor.getMarkdown()).toBe(markdown);

    expect(parent.querySelector('.cm-me-properties-table')).toBeInstanceOf(HTMLElement);

    editor.destroy();
    parent.remove();
  });

  function hybridWithCapturedView(markdown: string, hybridFrontmatterMode?: 'table' | 'collapsed' | 'hidden' | 'source') {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    let view: EditorView | null = null;
    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      hybridFrontmatterMode,
      extensions: [EditorView.updateListener.of((update) => { view = update.view; })],
    });
    // The updateListener only fires on updates; trigger one to capture the view.
    editor.setSelection({ anchor: 0, head: 0 });
    return { editor, parent, getView: () => view as unknown as EditorView };
  }

  const FM = ['---', 'title: Hybrid', 'status: draft', '---', '# Body', '', 'text'].join('\n');

  it('hybrid: a range delete that crosses the frontmatter boundary is filtered (YAML preserved)', () => {
    const { editor, parent, getView } = hybridWithCapturedView(FM);
    const bodyStart = FM.indexOf('# Body');
    getView().dispatch({ changes: { from: 6, to: bodyStart, insert: '' }, userEvent: 'delete' });
    expect(editor.getMarkdown()).toBe(FM);
    editor.destroy();
    parent.remove();
  });

  it('hybrid: select-all delete cannot wipe hidden frontmatter', () => {
    const { editor, parent, getView } = hybridWithCapturedView(FM);
    const view = getView();
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' }, userEvent: 'delete' });
    expect(editor.getMarkdown()).toBe(FM);
    editor.destroy();
    parent.remove();
  });

  it('hybrid: a body-only edit is NOT over-protected (still editable)', () => {
    const { editor, parent, getView } = hybridWithCapturedView(FM);
    const textPos = FM.indexOf('text');
    getView().dispatch({ changes: { from: textPos, to: textPos, insert: 'X' }, userEvent: 'input' });
    expect(editor.getMarkdown()).toBe(FM.replace('text', 'Xtext'));
    editor.destroy();
    parent.remove();
  });

  it('hybrid source mode: frontmatter IS editable (protection only applies when hidden)', () => {
    const { editor, parent, getView } = hybridWithCapturedView(FM, 'source');
    getView().dispatch({ changes: { from: 6, to: 7, insert: '' }, userEvent: 'delete' });
    expect(editor.getMarkdown()).not.toBe(FM);
    editor.destroy();
    parent.remove();
  });

  it('frontmatter protection follows setMode: editable in markdown, protected after switching to hybrid', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    let view: EditorView | null = null;
    const editor = createMarkdownEditorView({
      parent,
      markdown: FM,
      mode: 'markdown',
      extensions: [EditorView.updateListener.of((update) => { view = update.view; })],
    });
    editor.setSelection({ anchor: 0, head: 0 });
    const v = view as unknown as EditorView;
    v.dispatch({ changes: { from: 6, to: 7, insert: '' }, userEvent: 'delete' });
    expect(editor.getMarkdown()).not.toBe(FM);
    editor.setMode('hybrid');
    const baseline = editor.getMarkdown();
    v.dispatch({ changes: { from: 6, to: 7, insert: '' }, userEvent: 'delete' });
    expect(editor.getMarkdown()).toBe(baseline);
    editor.destroy();
    parent.remove();
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

    parent.querySelector<HTMLButtonElement>('.cm-me-property-drag-handle')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
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

    const removeButton = parent.querySelector<HTMLButtonElement>('[aria-label="Remove title property"]');
    expect(removeButton?.querySelector('svg')).toBeInstanceOf(SVGElement);
    expect(removeButton?.textContent).toBe('');
    removeButton?.click();
    expect(editor.getMarkdown()).toBe(['---', 'tags: editor, mvp', 'status: Ready', '---', '# Title'].join('\n'));
    expect(parent.querySelectorAll('.cm-me-property-row')).toHaveLength(2);

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

    expect(parent.querySelector('[data-property-type="boolean"] .cm-me-property-type-icon')?.textContent).toBe('✓');
    expect(parent.querySelector('[data-property-type="date"] .cm-me-property-type-icon')?.textContent).toBe('◷');
    expect(parent.querySelector('[data-property-type="time"] .cm-me-property-type-icon')?.textContent).toBe('◴');
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

    const tagsInput = parent.querySelector<HTMLInputElement>('[aria-label="tags tag entry"]');
    tagsInput!.value = 'release';
    tagsInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.getMarkdown()).toContain('tags: editor, mvp, release');

    parent.querySelector<HTMLButtonElement>('[aria-label="Remove editor tag"]')?.click();
    expect(editor.getMarkdown()).toContain('tags: mvp, release');

    const statusDetails = parent.querySelector<HTMLElement>('[aria-label="status property settings"]');
    statusDetails!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const statusType = parent.querySelector<HTMLButtonElement>('[aria-label="Set status property type to Boolean"]');
    statusType!.click();
    expect(editor.getMarkdown()).toContain('status: false');

    editor.destroy();
    parent.remove();
  });

  it('uses allowed schema values as frontmatter property pickers', () => {
    const markdown = ['---', 'title: Hybrid notes', 'status: draft', 'tags: editor, mvp', '---', '# Title'].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      frontmatterSchema: [
        { key: 'status', label: 'Status', type: 'text', allowedValues: ['draft', 'published'] },
        { key: 'tags', label: 'Tags', type: 'tags', allowedValues: ['agent', 'editor', 'mvp', 'runbook'] },
      ],
    });

    const bodyPosition = markdown.indexOf('# Title');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    const statusInput = parent.querySelector<HTMLInputElement>('[aria-label="status property value"]');
    expect(statusInput?.getAttribute('list')).toBeTruthy();
    const statusValues = Array.from(parent.querySelectorAll<HTMLOptionElement>(`#${statusInput!.getAttribute('list')} option`)).map((option) => option.value);
    expect(statusValues).toEqual(['draft', 'published']);

    const tagsInput = parent.querySelector<HTMLInputElement>('[aria-label="tags tag entry"]');
    expect(tagsInput?.getAttribute('list')).toBeTruthy();
    const tagValues = Array.from(parent.querySelectorAll<HTMLOptionElement>(`#${tagsInput!.getAttribute('list')} option`)).map((option) => option.value);
    expect(tagValues).toEqual(['agent', 'runbook']);

    tagsInput!.value = 'runbook';
    tagsInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor.getMarkdown()).toContain('tags: editor, mvp, runbook');

    editor.destroy();
    parent.remove();
  });

  it('uses host property schema for labels type suggestions and default values', () => {
    const markdown = ['---', 'title: Hybrid notes', '---', '# Title'].join('\n');
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown,
      mode: 'hybrid',
      frontmatterSchema: [
        { key: 'title', label: 'Document title', type: 'text', icon: 'T', order: 1 },
        { key: 'published', label: 'Published', type: 'boolean', icon: 'B', defaultValue: true, order: 2 },
      ],
    });

    const bodyPosition = markdown.indexOf('# Title');
    editor.setSelection({ anchor: bodyPosition, head: bodyPosition });

    expect(parent.querySelector('[data-property-key="title"] .cm-me-property-name')?.textContent).toBe('Document title');

    parent.querySelector<HTMLButtonElement>('.cm-me-property-add')?.click();
    expect(editor.getMarkdown()).toContain('published: true');
    expect(parent.querySelector('[data-property-key="published"] .cm-me-property-type-icon')?.textContent).toBe('✓');

    editor.destroy();
    parent.remove();
  });

  it('setMode switches markdown<->hybrid in place, preserving selection and document (P1-2)', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);

    const editor = createMarkdownEditorView({
      parent,
      markdown: '# Title\n\nbody text here\n',
      mode: 'markdown',
    });

    editor.setSelection({ anchor: 10, head: 14 });
    const before = editor.getSelection();

    editor.setMode('hybrid');
    // A reconfigure (not a destroy/recreate) keeps the selection and document.
    expect(editor.getSelection()).toEqual(before);
    expect(editor.getMarkdown()).toBe('# Title\n\nbody text here\n');
    // Hybrid decorations are now active (heading marker hidden off the active line).
    expect(parent.querySelector('.cm-content')).not.toBeNull();

    editor.setMode('markdown');
    expect(editor.getSelection()).toEqual(before);
    expect(editor.getMarkdown()).toBe('# Title\n\nbody text here\n');

    editor.destroy();
    parent.remove();
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
