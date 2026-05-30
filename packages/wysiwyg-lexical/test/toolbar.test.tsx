import { describe, it, expect } from 'vitest';
import { mountEditor } from './harness.js';

/**
 * WYSIWYG toolbar control tests (backlog suites #1, #2, #7). Each test mounts a
 * real editor, performs the control as a user would, and asserts the exported
 * markdown + reflected control state.
 */
describe('WYSIWYG toolbar — inline formatting', () => {
  it('Bold wraps the selection in ** and toggles back off', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.click('button[title="Bold"]');
    expect(h.markdown().trim()).toBe('**hello**');
    await h.selectAll();
    await h.click('button[title="Bold"]');
    expect(h.markdown().trim()).toBe('hello');
    h.unmount();
  });

  it('Italic wraps the selection in *', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.click('button[title="Italic"]');
    expect(h.markdown().trim()).toBe('*hello*');
    h.unmount();
  });

  it('Inline code wraps the selection in backticks', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.click('button[title="Inline code"]');
    expect(h.markdown().trim()).toBe('`hello`');
    h.unmount();
  });

  it("reflects bold state in the button's aria-pressed after applying", async () => {
    const h = await mountEditor('hello\n');
    expect(h.pressed('button[title="Bold"]')).toBe(false);
    await h.selectAll();
    await h.click('button[title="Bold"]');
    await h.selectAll();
    expect(h.pressed('button[title="Bold"]')).toBe(true);
    h.unmount();
  });
});

describe('WYSIWYG toolbar — block style select', () => {
  it('turns a paragraph into a Heading 1', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.choose('select[aria-label="Current block style"]', 'h1');
    expect(h.markdown().trim()).toBe('# hello');
    h.unmount();
  });

  it('turns a paragraph into a Heading 2', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.choose('select[aria-label="Current block style"]', 'h2');
    expect(h.markdown().trim()).toBe('## hello');
    h.unmount();
  });

  it('turns a paragraph into a blockquote', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.choose('select[aria-label="Current block style"]', 'quote');
    expect(h.markdown().trim()).toBe('> hello');
    h.unmount();
  });

  it('turns a paragraph into a fenced code block', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.choose('select[aria-label="Current block style"]', 'code');
    expect(h.markdown()).toMatch(/^```[\s\S]*hello[\s\S]*```/m);
    h.unmount();
  });
});

describe('WYSIWYG toolbar — list buttons', () => {
  it('Bulleted list produces "- "', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.click('button[aria-label="Bulleted list"]');
    expect(h.markdown().trim()).toBe('- hello');
    h.unmount();
  });

  it('Numbered list produces "1. "', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.click('button[aria-label="Numbered list"]');
    expect(h.markdown().trim()).toBe('1. hello');
    h.unmount();
  });

  it('Checkbox list produces a task item', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.click('button[aria-label="Checkbox list"]');
    expect(h.markdown().trim()).toMatch(/^- \[ \] hello$/);
    h.unmount();
  });
});

describe('WYSIWYG toolbar — insert select', () => {
  it('inserts a table', async () => {
    const h = await mountEditor('hello\n');
    await h.caretToEnd();
    await h.choose('select[aria-label="Insert block"]', 'table');
    expect(h.markdown()).toMatch(/\|/);
    h.unmount();
  });

  it('inserts a fenced code block', async () => {
    const h = await mountEditor('hello\n');
    // insertCodeBlock uses $insertNodes, which needs a real RangeSelection;
    // selectAll provides one (a collapsed caret doesn't reliably sync in jsdom).
    await h.selectAll();
    await h.choose('select[aria-label="Insert block"]', 'code');
    expect(h.markdown()).toMatch(/```/);
    h.unmount();
  });

  it('inserts an image', async () => {
    const h = await mountEditor('hello\n');
    await h.caretToEnd();
    await h.choose('select[aria-label="Insert block"]', 'image');
    expect(h.markdown()).toMatch(/!\[/);
    h.unmount();
  });
});

describe('WYSIWYG toolbar — table operations gating (#7)', () => {
  it('hides the Table operations group when no table is active', async () => {
    const h = await mountEditor('hello\n');
    expect(h.container.querySelector('span[aria-label="Table operations"]')).toBeNull();
    h.unmount();
  });

  it('reveals row/column controls once a table is inserted and selected', async () => {
    const h = await mountEditor('hello\n');
    await h.selectAll();
    await h.choose('select[aria-label="Insert block"]', 'table');
    // INSERT_TABLE_COMMAND lands the selection inside the new table.
    expect(h.container.querySelector('span[aria-label="Table operations"]')).not.toBeNull();
    expect(h.container.querySelector('button[aria-label="Insert table row"]')).not.toBeNull();
    expect(h.container.querySelector('button[aria-label="Insert table column"]')).not.toBeNull();
    h.unmount();
  });
});

describe('WYSIWYG toolbar — accessibility baseline', () => {
  it('exposes labeled toolbar groups and named controls', async () => {
    const h = await mountEditor('hello\n');
    const toolbar = h.container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.getAttribute('aria-label')).toBe('Rich text formatting controls');
    for (const group of ['Block formatting', 'Inline formatting', 'List formatting', 'Insert blocks']) {
      expect(h.container.querySelector(`span[aria-label="${group}"]`)).not.toBeNull();
    }
    for (const name of ['Bulleted list', 'Numbered list', 'Checkbox list']) {
      expect(h.container.querySelector(`button[aria-label="${name}"]`)).not.toBeNull();
    }
    h.unmount();
  });
});
