import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MarkdownEditor } from '../src/index.js';
import type { MarkdownEditorHandle } from '@echozedlabs/core';
import { mount, run } from './mount.js';

function modeButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button.me-mode-button'));
}

describe('MarkdownEditor — mode switching control', () => {
  it('switches mode (uncontrolled) and reports previousMode + source', () => {
    const onModeChange = vi.fn();
    const { container, unmount } = mount(
      <MarkdownEditor
        defaultValue={'# Hi\n'}
        modes={['markdown', 'hybrid', 'preview']}
        initialMode="markdown"
        onModeChange={onModeChange}
      />,
    );
    const section = container.querySelector('section.me-editor')!;
    run(() => modeButtons(container)[1]!.click()); // 'hybrid'
    expect(section.getAttribute('data-mode')).toBe('hybrid');
    expect(onModeChange).toHaveBeenCalledWith(
      'hybrid',
      expect.objectContaining({ previousMode: 'markdown', nextMode: 'hybrid', source: 'user' }),
    );
    unmount();
  });

  it('controlled `mode`: clicking fires onModeChange but does NOT change the rendered mode', () => {
    const onModeChange = vi.fn();
    const { container, unmount } = mount(
      <MarkdownEditor
        defaultValue={'# Hi\n'}
        modes={['markdown', 'hybrid', 'preview']}
        mode="markdown"
        onModeChange={onModeChange}
      />,
    );
    const section = container.querySelector('section.me-editor')!;
    run(() => modeButtons(container)[1]!.click());
    expect(section.getAttribute('data-mode')).toBe('markdown'); // host owns the mode
    expect(onModeChange).toHaveBeenCalledWith('hybrid', expect.objectContaining({ source: 'user' }));
    unmount();
  });

  it('clicking the already-active mode is a no-op', () => {
    const onModeChange = vi.fn();
    const { container, unmount } = mount(
      <MarkdownEditor defaultValue={''} modes={['markdown', 'hybrid']} initialMode="markdown" onModeChange={onModeChange} />,
    );
    run(() => modeButtons(container)[0]!.click()); // 'markdown' already active
    expect(onModeChange).not.toHaveBeenCalled();
    unmount();
  });
});

describe('MarkdownEditor — keyboard shortcuts', () => {
  function surface(container: HTMLElement): HTMLElement {
    return container.querySelector('.me-editor-surface') as HTMLElement;
  }

  it('Ctrl+S and Cmd+S fire onSaveShortcut and preventDefault', () => {
    const onSaveShortcut = vi.fn();
    const { container, unmount } = mount(
      <MarkdownEditor defaultValue={'x'} modes={['markdown']} initialMode="markdown" onSaveShortcut={onSaveShortcut} />,
    );
    const ctrlS = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    run(() => surface(container).dispatchEvent(ctrlS));
    expect(onSaveShortcut).toHaveBeenCalledTimes(1);
    expect(ctrlS.defaultPrevented).toBe(true);

    const metaS = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true });
    run(() => surface(container).dispatchEvent(metaS));
    expect(onSaveShortcut).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('Escape fires onCancelShortcut; a plain "s" fires nothing', () => {
    const onSaveShortcut = vi.fn();
    const onCancelShortcut = vi.fn();
    const { container, unmount } = mount(
      <MarkdownEditor
        defaultValue={'x'}
        modes={['markdown']}
        initialMode="markdown"
        onSaveShortcut={onSaveShortcut}
        onCancelShortcut={onCancelShortcut}
      />,
    );
    run(() => surface(container).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onCancelShortcut).toHaveBeenCalledTimes(1);
    run(() => surface(container).dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true })));
    expect(onSaveShortcut).not.toHaveBeenCalled();
    unmount();
  });
});

describe('MarkdownEditor — imperative handle', () => {
  it('get/set markdown and mode, and getSnapshot reflect current state', () => {
    const ref = React.createRef<MarkdownEditorHandle>();
    const onChange = vi.fn();
    const { container, unmount } = mount(
      <MarkdownEditor ref={ref} defaultValue={'# A\n'} modes={['markdown', 'hybrid']} initialMode="markdown" onChange={onChange} />,
    );
    expect(ref.current!.getMarkdown()).toBe('# A\n');
    expect(ref.current!.getMode()).toBe('markdown');

    run(() => ref.current!.setMarkdown('# B\n'));
    expect(ref.current!.getMarkdown()).toBe('# B\n');
    expect(onChange).toHaveBeenCalledWith('# B\n', expect.objectContaining({ source: 'programmatic' }));

    run(() => ref.current!.setMode('hybrid'));
    expect(ref.current!.getMode()).toBe('hybrid');
    expect(container.querySelector('section.me-editor')!.getAttribute('data-mode')).toBe('hybrid');

    const snapshot = ref.current!.getSnapshot();
    expect(snapshot.markdown).toBe('# B\n');
    expect(snapshot.mode).toBe('hybrid');
    unmount();
  });

  it('insertMarkdown inserts into the document', () => {
    const ref = React.createRef<MarkdownEditorHandle>();
    const { unmount } = mount(
      <MarkdownEditor ref={ref} defaultValue={'hello'} modes={['markdown']} initialMode="markdown" />,
    );
    run(() => ref.current!.insertMarkdown(' world'));
    expect(ref.current!.getMarkdown()).toContain('world');
    unmount();
  });

  it('replaceMarkdown updates content and fires onChange', () => {
    const ref = React.createRef<MarkdownEditorHandle>();
    const onChange = vi.fn();
    const { unmount } = mount(
      <MarkdownEditor ref={ref} defaultValue={'x'} modes={['markdown']} initialMode="markdown" onChange={onChange} />,
    );
    run(() => ref.current!.replaceMarkdown('y'));
    expect(ref.current!.getMarkdown()).toBe('y');
    expect(onChange).toHaveBeenCalled();
    unmount();
  });
});
