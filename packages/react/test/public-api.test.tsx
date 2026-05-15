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

const controlledHostElement = (
  <MarkdownEditor
    ref={ref}
    ariaLabel="Controlled markdown editor"
    value="Initial controlled value"
    mode="markdown"
    modes={['markdown', 'preview']}
    readOnly={false}
    onChange={(markdown, meta) => {
      markdown.trim();
      meta.mode?.toUpperCase();
    }}
    onModeChange={(nextMode, meta) => {
      nextMode.toUpperCase();
      meta.source.toUpperCase();
    }}
    onSaveShortcut={() => undefined}
    onCancelShortcut={() => undefined}
    onDiagnostics={(diagnostics) => {
      diagnostics.map((diagnostic) => diagnostic.code);
    }}
  />
);

controlledHostElement.props.value.toUpperCase();

ref.current?.setMarkdown('Externally supplied update');
ref.current?.setMode('preview');
ref.current?.setSelection({ from: 0, to: 8 });
ref.current?.replaceMarkdown('Host replacement', {
  source: 'host',
  timestamp: Date.now(),
  mode: 'markdown',
});
