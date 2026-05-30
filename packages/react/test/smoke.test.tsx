import { describe, it, expect } from 'vitest';
import { MarkdownEditor } from '../src/index.js';
import { mount, run } from './mount.js';

describe('MarkdownEditor infra smoke', () => {
  it('mounts CodeMirror in markdown mode and renders the mode toolbar', () => {
    const { container, unmount } = mount(
      <MarkdownEditor value={'# Hi\n'} modes={['markdown', 'hybrid', 'preview']} initialMode="markdown" />,
    );
    const section = container.querySelector('section.me-editor');
    expect(section).not.toBeNull();
    expect(section!.getAttribute('data-mode')).toBe('markdown');
    // One button per configured mode.
    expect(container.querySelectorAll('button.me-mode-button').length).toBe(3);
    // CodeMirror actually mounted.
    expect(container.querySelector('.cm-content')).not.toBeNull();
    unmount();
  });

  it('switches mode when a mode button is clicked and reports it', () => {
    let lastMode: string | undefined;
    const { container, unmount } = mount(
      <MarkdownEditor
        value={'# Hi\n'}
        modes={['markdown', 'hybrid', 'preview']}
        initialMode="markdown"
        onModeChange={(mode) => {
          lastMode = mode;
        }}
      />,
    );
    const section = container.querySelector('section.me-editor')!;
    const buttons = container.querySelectorAll<HTMLButtonElement>('button.me-mode-button');
    // Button order follows the `modes` prop: index 1 === 'hybrid'.
    run(() => buttons[1]!.click());
    expect(section.getAttribute('data-mode')).toBe('hybrid');
    expect(lastMode).toBe('hybrid');
    unmount();
  });
});
