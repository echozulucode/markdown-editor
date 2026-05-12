import { describe, expect, it } from 'vitest';
import type {
  ChangeMeta,
  DocumentSnapshot,
  EditorMode,
  HostServices,
  MarkdownDocument,
  MarkdownDiagnostic,
  MarkdownEditorHandle,
  MarkdownEditorProps,
  ModeChangeMeta,
  ParsedMarkdown,
  RendererRegistry,
  SelectionSnapshot,
} from '../src/index.js';

describe('public type exports', () => {
  it('are available to downstream packages', () => {
    const mode: EditorMode = 'markdown';
    const selection: SelectionSnapshot = { ranges: [{ anchor: 0, head: 0 }], mainIndex: 0 };
    const snapshot: DocumentSnapshot = { markdown: '# Title\n', version: 1, mode, selection };
    const change: ChangeMeta = { source: 'user', timestamp: 1, mode, selection };
    const modeChange: ModeChangeMeta = {
      previousMode: 'markdown',
      nextMode: 'preview',
      timestamp: 1,
      source: 'user',
    };
    const diagnostic: MarkdownDiagnostic = {
      code: 'frontmatter.invalid',
      message: 'Invalid frontmatter',
      severity: 'warning',
    };
    const services: HostServices = {};
    const registry: RendererRegistry = {
      register: () => undefined,
      resolve: () => undefined,
    };
    const props: MarkdownEditorProps = { value: snapshot.markdown, mode, hostServices: services };
    const handle: MarkdownEditorHandle = {
      focus: () => undefined,
      getMarkdown: () => snapshot.markdown,
      setMarkdown: () => undefined,
      getMode: () => mode,
      setMode: () => undefined,
      getSelection: () => ({ from: 0, to: 0 }),
      setSelection: () => undefined,
      insertMarkdown: () => undefined,
      clearHistory: () => undefined,
      getSnapshot: () => snapshot,
      replaceMarkdown: () => undefined,
    };
    const parsed = { raw: '', body: '', frontmatter: {}, hasFrontmatter: false } as ParsedMarkdown;
    const document = parsed as MarkdownDocument;

    expect({
      mode,
      snapshot,
      change,
      modeChange,
      diagnostic,
      registry,
      props,
      handle,
      parsed,
      document,
    }).toBeTruthy();
  });
});
