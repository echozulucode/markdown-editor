import React from 'react';
import type { MarkdownEditorHandle } from '@markdown-editor/core';
import { MarkdownEditor, type MarkdownEditorComponentProps } from '../src/index.js';

const ref = React.createRef<MarkdownEditorHandle>();

const props: MarkdownEditorComponentProps = {
  value: '# Draft\n',
  modes: ['hybrid', 'markdown', 'preview', 'wysiwyg'],
  initialMode: 'hybrid',
  onChange(markdown, meta) {
    markdown.toUpperCase();
    meta.timestamp.toFixed();
  },
  onModeChange(mode, meta) {
    mode.toUpperCase();
    meta.previousMode.toUpperCase();
  },
};

const element = <MarkdownEditor ref={ref} {...props} />;

element.type;
