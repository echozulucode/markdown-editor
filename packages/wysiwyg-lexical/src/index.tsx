import React from 'react';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  createCommand,
  createEditor,
  type EditorState,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';
import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createCodeNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeNode,
  registerCodeHighlighting,
} from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from '@lexical/list';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
  type MultilineElementTransformer,
} from '@lexical/markdown';
import { $setBlocksType } from '@lexical/selection';
import type { ChangeMeta, MarkdownDiagnostic } from '@markdown-editor/core';

const INSERT_MERMAID_COMMAND: LexicalCommand<string> = createCommand('INSERT_MERMAID_COMMAND');

type WysiwygBlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'code' | 'bullet' | 'number' | 'check';
type InsertBlockType = 'code' | 'mermaid';

const DEFAULT_MERMAID_SOURCE = 'graph TD\n  A[Start] --> B[Done]';

const BLOCK_OPTIONS: Array<{ value: WysiwygBlockType; label: string }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'quote', label: 'Quote' },
  { value: 'code', label: 'Code block' },
  { value: 'bullet', label: 'Bulleted list' },
  { value: 'number', label: 'Numbered list' },
  { value: 'check', label: 'Checkbox list' },
];

const CODE_LANGUAGE_OPTIONS = [
  { value: 'plain', label: 'Plain text' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'markup', label: 'HTML/XML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'powershell', label: 'PowerShell' },
];

function normalizeCodeLanguageForControl(language: string | null | undefined): string {
  if (language === 'ts' || language === 'tsx') {
    return 'typescript';
  }

  if (language === 'js' || language === 'jsx') {
    return 'javascript';
  }

  if (language === 'html' || language === 'xml') {
    return 'markup';
  }

  if (language === 'py') {
    return 'python';
  }

  if (language === 'text' || language === 'plaintext') {
    return 'plain';
  }

  const normalized = language ?? 'plain';
  return CODE_LANGUAGE_OPTIONS.some((option) => option.value === normalized) ? normalized : 'plain';
}

interface SerializedMermaidNode extends SerializedLexicalNode {
  source: string;
}

class MermaidNode extends DecoratorNode<React.ReactElement> {
  __source: string;

  static override getType(): string {
    return 'mermaid';
  }

  static override clone(node: MermaidNode): MermaidNode {
    return new MermaidNode(node.__source, node.__key);
  }

  static override importJSON(serializedNode: SerializedMermaidNode): MermaidNode {
    return $createMermaidNode(serializedNode.source);
  }

  constructor(source: string, key?: NodeKey) {
    super(key);
    this.__source = source;
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'me-wysiwyg-mermaid-node';
    return element;
  }

  override updateDOM(): false {
    return false;
  }

  override exportJSON(): SerializedMermaidNode {
    return {
      ...super.exportJSON(),
      type: 'mermaid',
      version: 1,
      source: this.__source,
    };
  }

  override getTextContent(): string {
    return `\`\`\`mermaid\n${this.__source}\n\`\`\``;
  }

  setSource(source: string): void {
    const writable = this.getWritable();
    writable.__source = source;
  }

  getSource(): string {
    return this.getLatest().__source;
  }

  override isInline(): false {
    return false;
  }

  override isIsolated(): true {
    return true;
  }

  override decorate(editor: LexicalEditor): React.ReactElement {
    return <MermaidBlock source={this.__source} nodeKey={this.__key} editor={editor} />;
  }
}

function $createMermaidNode(source: string): MermaidNode {
  return $applyNodeReplacement(new MermaidNode(source));
}

function $isMermaidNode(node: LexicalNode | null | undefined): node is MermaidNode {
  return node instanceof MermaidNode;
}

const MERMAID_TRANSFORMER: MultilineElementTransformer = {
  type: 'multiline-element',
  dependencies: [MermaidNode],
  regExpStart: /^```mermaid\s*$/,
  regExpEnd: /^```\s*$/,
  replace(rootNode, _children, _startMatch, _endMatch, linesInBetween) {
    rootNode.append($createMermaidNode((linesInBetween ?? []).join('\n')));
  },
  export(node) {
    if (!$isMermaidNode(node)) {
      return null;
    }

    return `\`\`\`mermaid\n${node.getSource()}\n\`\`\``;
  },
};

const WYSIWYG_TRANSFORMERS = [MERMAID_TRANSFORMER, ...TRANSFORMERS];
const WYSIWYG_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  MermaidNode,
];

export interface WysiwygLexicalEditorProps {
  markdown: string;
  readOnly?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  onChange?: (markdown: string, meta: ChangeMeta) => void;
  onDiagnostics?: (diagnostics: MarkdownDiagnostic[]) => void;
}

export function WysiwygLexicalEditor({
  markdown,
  readOnly = false,
  ariaLabel = 'WYSIWYG Markdown editor',
  placeholder = 'Start typing...',
  onChange,
  onDiagnostics,
}: WysiwygLexicalEditorProps): React.ReactElement {
  const lastEmittedMarkdown = React.useRef<string | null>(null);
  const editorConfig = React.useMemo<InitialConfigType>(
    () => ({
      namespace: 'MarkdownEditorWysiwyg',
      nodes: WYSIWYG_NODES,
      editable: !readOnly,
      theme: lexicalTheme,
      onError(error) {
        onDiagnostics?.([
          {
            code: 'wysiwyg.lexical.error',
            message: error.message,
            severity: 'error',
            source: 'mode',
            details: error,
          },
        ]);
      },
      editorState: () => {
        importMarkdownBody(markdown);
      },
    }),
    [],
  );

  return (
    <div className="me-wysiwyg" data-readonly={readOnly ? 'true' : 'false'}>
      <LexicalComposer initialConfig={editorConfig}>
        <EditableStatePlugin readOnly={readOnly} />
        <ExternalMarkdownPlugin markdown={markdown} lastEmittedMarkdown={lastEmittedMarkdown} />
        <WysiwygCommandPlugin />
        {!readOnly ? <WysiwygToolbar /> : null}
        {!readOnly ? <WysiwygCodeLanguagePlugin /> : null}
        <WysiwygCodeHighlightPlugin />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="me-wysiwyg-input"
              aria-label={ariaLabel}
              spellCheck={false}
            />
          }
          placeholder={<div className="me-wysiwyg-placeholder-text">{placeholder}</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <WysiwygChangePlugin
          sourceMarkdown={markdown}
          lastEmittedMarkdown={lastEmittedMarkdown}
          onChange={onChange}
        />
      </LexicalComposer>
    </div>
  );
}

export function roundTripWysiwygMarkdown(markdown: string): string {
  const envelope = splitMarkdownEnvelope(markdown);
  const editor = createEditor({
    namespace: 'MarkdownEditorWysiwygHeadless',
    nodes: WYSIWYG_NODES,
    theme: lexicalTheme,
    onError(error) {
      throw error;
    },
  });

  editor.update(
    () => {
      importMarkdownBody(markdown);
    },
    { discrete: true },
  );

  let body = '';
  editor.getEditorState().read(() => {
    body = $convertToMarkdownString(WYSIWYG_TRANSFORMERS);
  });

  return replaceEnvelopeBody(envelope, body);
}

function WysiwygCommandPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(
    () =>
      editor.registerCommand(
        INSERT_MERMAID_COMMAND,
        (source) => {
          $insertNodes([$createMermaidNode(source), $createParagraphNode()]);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  );

  return null;
}

function WysiwygCodeHighlightPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => registerCodeHighlighting(editor), [editor]);

  return null;
}

function WysiwygCodeLanguagePlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [activeCode, setActiveCode] = React.useState<{
    key: NodeKey;
    language: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updateCodeLanguageState = React.useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      setActiveCode(null);
      return;
    }

    const topLevelNode = selection.anchor.getNode().getTopLevelElement();
    if (!$isCodeNode(topLevelNode)) {
      setActiveCode(null);
      return;
    }

    const codeKey = topLevelNode.getKey();
    const language = normalizeCodeLanguageForControl(topLevelNode.getLanguage());

    window.requestAnimationFrame(() => {
      const codeElement = editor.getElementByKey(codeKey);
      const rootElement = editor.getRootElement();
      const container = rootElement?.closest<HTMLElement>('.me-wysiwyg') ?? null;
      if (codeElement === null || container === null) {
        setActiveCode(null);
        return;
      }

      const codeRect = codeElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setActiveCode({
        key: codeKey,
        language,
        top: codeRect.top - containerRect.top + container.scrollTop + 6,
        left: codeRect.left - containerRect.left + container.scrollLeft + 6,
        width: Math.max(160, codeRect.width - 12),
      });
    });
  }, [editor]);

  React.useEffect(() => {
    editor.getEditorState().read(updateCodeLanguageState);

    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(updateCodeLanguageState);
    });
    const removeSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateCodeLanguageState();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const rootElement = editor.getRootElement();
    const container = rootElement?.closest<HTMLElement>('.me-wysiwyg');
    container?.addEventListener('scroll', updateCodeLanguageState);
    window.addEventListener('resize', updateCodeLanguageState);

    return () => {
      removeUpdateListener();
      removeSelectionListener();
      container?.removeEventListener('scroll', updateCodeLanguageState);
      window.removeEventListener('resize', updateCodeLanguageState);
    };
  }, [editor, updateCodeLanguageState]);

  if (activeCode === null) {
    return null;
  }

  return (
    <div
      className="me-wysiwyg-code-language-popover"
      style={{ top: activeCode.top, left: activeCode.left, width: activeCode.width }}
    >
      <span>Code</span>
      <select
        aria-label="Code block language"
        value={activeCode.language}
        onChange={(event) => {
          const nextLanguage = event.currentTarget.value;
          editor.update(() => {
            const node = $getNodeByKey(activeCode.key);
            if ($isCodeNode(node)) {
              node.setLanguage(nextLanguage);
            }
          });
          setActiveCode((current) =>
            current === null ? current : { ...current, language: nextLanguage },
          );
        }}
      >
        {CODE_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function WysiwygToolbar(): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const [activeBlock, setActiveBlock] = React.useState<WysiwygBlockType>('paragraph');
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isCode, setIsCode] = React.useState(false);

  const updateToolbarState = React.useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsCode(selection.hasFormat('code'));

    const anchorNode = selection.anchor.getNode();
    const topLevelNode = anchorNode.getTopLevelElement();
    if (topLevelNode === null) {
      setActiveBlock('paragraph');
      return;
    }

    if ($isHeadingNode(topLevelNode)) {
      const tag = topLevelNode.getTag();
      setActiveBlock(tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'paragraph');
      return;
    }

    if ($isQuoteNode(topLevelNode)) {
      setActiveBlock('quote');
      return;
    }

    if ($isCodeNode(topLevelNode)) {
      setActiveBlock('code');
      return;
    }

    if ($isListNode(topLevelNode)) {
      const listType = topLevelNode.getListType();
      setActiveBlock(listType === 'number' ? 'number' : listType === 'check' ? 'check' : 'bullet');
      return;
    }

    setActiveBlock('paragraph');
  }, []);

  React.useEffect(() => {
    editor.getEditorState().read(updateToolbarState);

    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(updateToolbarState);
    });
    const removeSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbarState();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      removeUpdateListener();
      removeSelectionListener();
    };
  }, [editor, updateToolbarState]);

  const setBlock = React.useCallback(
    (block: WysiwygBlockType) => {
      if (block === 'bullet') {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        return;
      }

      if (block === 'number') {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        return;
      }

      if (block === 'check') {
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        return;
      }

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        if (block === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
          return;
        }

        if (block === 'quote') {
          $setBlocksType(selection, () => $createQuoteNode());
          return;
        }

        if (block === 'code') {
          $setBlocksType(selection, () => $createCodeNode('typescript'));
          return;
        }

        $setBlocksType(selection, () => $createHeadingNode(block));
      });
    },
    [editor],
  );

  const insertCodeBlock = React.useCallback(() => {
    editor.update(() => {
      const codeNode = $createCodeNode('typescript');
      codeNode.append($createTextNode('const value = 1;'));
      $insertNodes([codeNode, $createParagraphNode()]);
      codeNode.selectStart();
    });
  }, [editor]);

  const insertBlock = React.useCallback(
    (block: InsertBlockType) => {
      if (block === 'code') {
        insertCodeBlock();
        return;
      }

      editor.dispatchCommand(INSERT_MERMAID_COMMAND, DEFAULT_MERMAID_SOURCE);
    },
    [editor, insertCodeBlock],
  );

  return (
    <div className="me-wysiwyg-toolbar" role="toolbar" aria-label="WYSIWYG formatting controls">
      <span className="me-wysiwyg-toolbar-group" aria-label="Block formatting">
        <select
          className="me-wysiwyg-block-select"
          aria-label="Current block style"
          value={activeBlock}
          onChange={(event) => setBlock(event.currentTarget.value as WysiwygBlockType)}
        >
          {BLOCK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      <span className="me-wysiwyg-toolbar-group" aria-label="Inline formatting">
        <button
          type="button"
          title="Bold"
          aria-pressed={isBold}
          data-active={isBold ? 'true' : 'false'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        >
          B
        </button>
        <button
          type="button"
          title="Italic"
          aria-pressed={isItalic}
          data-active={isItalic ? 'true' : 'false'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        >
          I
        </button>
        <button
          type="button"
          title="Inline code"
          aria-pressed={isCode}
          data-active={isCode ? 'true' : 'false'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        >
          &lt;/&gt;
        </button>
      </span>
      <span className="me-wysiwyg-toolbar-group" aria-label="List formatting">
        <button
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          aria-pressed={activeBlock === 'bullet'}
          data-active={activeBlock === 'bullet' ? 'true' : 'false'}
          onClick={() => setBlock('bullet')}
        >
          •
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          aria-pressed={activeBlock === 'number'}
          data-active={activeBlock === 'number' ? 'true' : 'false'}
          onClick={() => setBlock('number')}
        >
          1.
        </button>
        <button
          type="button"
          aria-label="Checkbox list"
          title="Checkbox list"
          aria-pressed={activeBlock === 'check'}
          data-active={activeBlock === 'check' ? 'true' : 'false'}
          onClick={() => setBlock('check')}
        >
          ☑
        </button>
      </span>
      <span className="me-wysiwyg-toolbar-group" aria-label="Insert blocks">
        <select
          className="me-wysiwyg-insert-select"
          aria-label="Insert block"
          value=""
          onChange={(event) => {
            insertBlock(event.currentTarget.value as InsertBlockType);
          }}
        >
          <option value="" disabled>
            Insert
          </option>
          <option value="code">Code block</option>
          <option value="mermaid">Mermaid diagram</option>
        </select>
      </span>
    </div>
  );
}

function MermaidBlock({
  source,
  nodeKey,
  editor,
}: {
  source: string;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}): React.ReactElement {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(source);
  const [html, setHtml] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(source);
  }, [source]);

  React.useEffect(() => {
    if (isEditing) {
      return;
    }

    let disposed = false;
    const diagramId = `me-wysiwyg-mermaid-${nodeKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    setError(null);
    setHtml('');

    import('mermaid')
      .then(async (module) => {
        const renderer = module.default;
        renderer.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
        const rendered = await renderer.render(diagramId, source);
        if (!disposed) {
          setHtml(rendered.svg);
        }
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      disposed = true;
    };
  }, [isEditing, nodeKey, source]);

  function saveSource() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMermaidNode(node)) {
        node.setSource(draft);
      }
    });
    setIsEditing(false);
  }

  return (
    <figure className="me-wysiwyg-mermaid">
      <figcaption>
        <span>Mermaid</span>
        <button type="button" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </figcaption>
      {isEditing ? (
        <div className="me-wysiwyg-mermaid-editor">
          <textarea
            aria-label="Mermaid diagram source"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            rows={7}
          />
          <button type="button" onClick={saveSource}>Apply</button>
        </div>
      ) : error ? (
        <pre className="me-wysiwyg-mermaid-error">{error}</pre>
      ) : html ? (
        <div className="me-wysiwyg-mermaid-rendered" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="me-wysiwyg-mermaid-loading">Rendering diagram...</div>
      )}
    </figure>
  );
}

function EditableStatePlugin({ readOnly }: { readOnly: boolean }): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return null;
}

function ExternalMarkdownPlugin({
  markdown,
  lastEmittedMarkdown,
}: {
  markdown: string;
  lastEmittedMarkdown: React.MutableRefObject<string | null>;
}): null {
  const [editor] = useLexicalComposerContext();
  const lastAppliedMarkdown = React.useRef(markdown);

  React.useEffect(() => {
    if (markdown === lastAppliedMarkdown.current || markdown === lastEmittedMarkdown.current) {
      return;
    }

    lastAppliedMarkdown.current = markdown;
    editor.update(
      () => {
        importMarkdownBody(markdown);
      },
      { discrete: true },
    );
  }, [editor, lastEmittedMarkdown, markdown]);

  return null;
}

function WysiwygChangePlugin({
  sourceMarkdown,
  lastEmittedMarkdown,
  onChange,
}: {
  sourceMarkdown: string;
  lastEmittedMarkdown: React.MutableRefObject<string | null>;
  onChange?: (markdown: string, meta: ChangeMeta) => void;
}): React.ReactElement {
  const sourceMarkdownRef = React.useRef(sourceMarkdown);
  sourceMarkdownRef.current = sourceMarkdown;

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState: EditorState) => {
        const nextMarkdown = exportEditorState(editorState, sourceMarkdownRef.current);
        if (nextMarkdown === lastEmittedMarkdown.current || nextMarkdown === sourceMarkdownRef.current) {
          return;
        }

        lastEmittedMarkdown.current = nextMarkdown;
        onChange?.(nextMarkdown, {
          source: 'user',
          mode: 'wysiwyg',
          timestamp: Date.now(),
        });
      }}
    />
  );
}

function importMarkdownBody(markdown: string): void {
  const envelope = splitMarkdownEnvelope(markdown);
  const root = $getRoot();
  root.clear();

  if (envelope.body.trim() === '') {
    root.append($createParagraphNode());
    return;
  }

  $convertFromMarkdownString(envelope.body, WYSIWYG_TRANSFORMERS);
}

function exportEditorState(editorState: EditorState, sourceMarkdown: string): string {
  let body = '';
  editorState.read(() => {
    body = $convertToMarkdownString(WYSIWYG_TRANSFORMERS);
  });

  return replaceEnvelopeBody(splitMarkdownEnvelope(sourceMarkdown), body);
}

interface MarkdownEnvelope {
  rawFrontmatter: string;
  body: string;
  trailing: string;
}

function splitMarkdownEnvelope(markdown: string): MarkdownEnvelope {
  if (!/^---\r?\n/.test(markdown)) {
    return { rawFrontmatter: '', body: markdown, trailing: '' };
  }

  const firstNewline = markdown.indexOf('\n');
  if (firstNewline === -1) {
    return { rawFrontmatter: '', body: markdown, trailing: '' };
  }

  let cursor = firstNewline + 1;
  while (cursor < markdown.length) {
    const lineEnd = markdown.indexOf('\n', cursor);
    const lineRawEnd = lineEnd === -1 ? markdown.length : lineEnd;
    const line = markdown.slice(cursor, lineRawEnd).replace(/\r$/, '');

    if (line === '---') {
      const frontmatterEnd = lineEnd === -1 ? markdown.length : lineEnd + 1;
      return {
        rawFrontmatter: markdown.slice(0, frontmatterEnd),
        body: markdown.slice(frontmatterEnd),
        trailing: '',
      };
    }

    if (lineEnd === -1) {
      break;
    }
    cursor = lineEnd + 1;
  }

  return { rawFrontmatter: '', body: markdown, trailing: '' };
}

function replaceEnvelopeBody(envelope: MarkdownEnvelope, body: string): string {
  return `${envelope.rawFrontmatter}${body}${envelope.trailing}`;
}

const lexicalTheme = {
  paragraph: 'me-wysiwyg-paragraph',
  heading: {
    h1: 'me-wysiwyg-heading me-wysiwyg-heading-1',
    h2: 'me-wysiwyg-heading me-wysiwyg-heading-2',
    h3: 'me-wysiwyg-heading me-wysiwyg-heading-3',
    h4: 'me-wysiwyg-heading me-wysiwyg-heading-4',
    h5: 'me-wysiwyg-heading me-wysiwyg-heading-5',
    h6: 'me-wysiwyg-heading me-wysiwyg-heading-6',
  },
  list: {
    ul: 'me-wysiwyg-list',
    ol: 'me-wysiwyg-list',
    checklist: 'me-wysiwyg-check-list',
    listitem: 'me-wysiwyg-list-item',
    listitemChecked: 'me-wysiwyg-list-item-checked',
    listitemUnchecked: 'me-wysiwyg-list-item-unchecked',
  },
  quote: 'me-wysiwyg-quote',
  code: 'me-wysiwyg-code',
  codeHighlight: {
    atrule: 'me-wysiwyg-token-atrule',
    attr: 'me-wysiwyg-token-attr-name',
    'attr-name': 'me-wysiwyg-token-attr-name',
    'attr-value': 'me-wysiwyg-token-attr-value',
    boolean: 'me-wysiwyg-token-boolean',
    builtin: 'me-wysiwyg-token-builtin',
    cdata: 'me-wysiwyg-token-cdata',
    char: 'me-wysiwyg-token-char',
    class: 'me-wysiwyg-token-class-name',
    'class-name': 'me-wysiwyg-token-class-name',
    comment: 'me-wysiwyg-token-comment',
    constant: 'me-wysiwyg-token-constant',
    deleted: 'me-wysiwyg-token-deleted',
    doctype: 'me-wysiwyg-token-doctype',
    entity: 'me-wysiwyg-token-entity',
    function: 'me-wysiwyg-token-function',
    important: 'me-wysiwyg-token-important',
    inserted: 'me-wysiwyg-token-inserted',
    keyword: 'me-wysiwyg-token-keyword',
    namespace: 'me-wysiwyg-token-namespace',
    number: 'me-wysiwyg-token-number',
    operator: 'me-wysiwyg-token-operator',
    prolog: 'me-wysiwyg-token-prolog',
    property: 'me-wysiwyg-token-property',
    punctuation: 'me-wysiwyg-token-punctuation',
    regex: 'me-wysiwyg-token-regex',
    selector: 'me-wysiwyg-token-selector',
    string: 'me-wysiwyg-token-string',
    symbol: 'me-wysiwyg-token-symbol',
    tag: 'me-wysiwyg-token-tag',
    url: 'me-wysiwyg-token-url',
    variable: 'me-wysiwyg-token-variable',
  },
  link: 'me-wysiwyg-link',
  text: {
    bold: 'me-wysiwyg-text-bold',
    italic: 'me-wysiwyg-text-italic',
    code: 'me-wysiwyg-text-code',
  },
};
