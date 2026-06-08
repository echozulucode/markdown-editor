import { beforeAll, describe, it, expect } from 'vitest';
import React from 'react';
import { MarkdownEditor } from '../src/index.js';
import type { MarkdownEditorHandle } from '@echozedlabs/core';
import { mount, run } from './mount.js';

// CodeMirror block widgets (hybrid) need range geometry in jsdom.
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

describe('MarkdownEditor — CodeMirror stays stable across in-editor changes', () => {
  it('preserves selection across markdown<->hybrid switches (reconfigures in place)', () => {
    const ref = React.createRef<MarkdownEditorHandle>();
    const { unmount } = mount(
      <MarkdownEditor ref={ref} defaultValue={'# Hello world\nLine two\n'} modes={['markdown', 'hybrid']} initialMode="markdown" />,
    );
    run(() => ref.current!.setSelection({ from: 2, to: 7 }));

    run(() => ref.current!.setMode('hybrid'));
    expect(ref.current!.getSelection()).toEqual(expect.objectContaining({ from: 2, to: 7 }));

    run(() => ref.current!.setMode('markdown'));
    expect(ref.current!.getSelection()).toEqual(expect.objectContaining({ from: 2, to: 7 }));

    unmount();
  });

  it('preserves selection across a read-only toggle', () => {
    const ref = React.createRef<MarkdownEditorHandle>();
    const { rerender, unmount } = mount(
      <MarkdownEditor ref={ref} defaultValue={'# Hello world\n'} modes={['markdown', 'hybrid']} initialMode="markdown" />,
    );
    run(() => ref.current!.setSelection({ from: 2, to: 7 }));

    rerender(
      <MarkdownEditor ref={ref} defaultValue={'# Hello world\n'} modes={['markdown', 'hybrid']} initialMode="markdown" readOnly />,
    );
    expect(ref.current!.getSelection()).toEqual(expect.objectContaining({ from: 2, to: 7 }));

    unmount();
  });
});
