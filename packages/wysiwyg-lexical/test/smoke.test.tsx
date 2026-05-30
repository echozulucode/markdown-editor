import { describe, it, expect } from 'vitest';
import { WysiwygLexicalEditor } from '../src/index.js';
import { mount } from './mount.js';

describe('WysiwygLexicalEditor infra smoke', () => {
  it('mounts the live editor and renders the formatting toolbar', () => {
    const { container, unmount } = mount(<WysiwygLexicalEditor markdown={'hello world\n'} />);
    // The live contenteditable mounted.
    expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
    // Representative controls from each toolbar group are present and labeled.
    expect(container.querySelector('button[title="Bold"]')).not.toBeNull();
    expect(container.querySelector('button[title="Italic"]')).not.toBeNull();
    expect(container.querySelector('button[title="Inline code"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Bulleted list"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Insert block"]')).not.toBeNull();
    unmount();
  });

  it('hides the toolbar in read-only mode', () => {
    const { container, unmount } = mount(<WysiwygLexicalEditor markdown={'hello\n'} readOnly />);
    expect(container.querySelector('button[title="Bold"]')).toBeNull();
    unmount();
  });
});
