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
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
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
  $isListItemNode,
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
  CHECK_LIST,
  TRANSFORMERS,
  type ElementTransformer,
  type MultilineElementTransformer,
} from '@lexical/markdown';
import { $setBlocksType } from '@lexical/selection';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import type { ChangeMeta, MarkdownDiagnostic } from '@markdown-editor/core';

const INSERT_MERMAID_COMMAND: LexicalCommand<string> = createCommand('INSERT_MERMAID_COMMAND');
const INSERT_PLANTUML_COMMAND: LexicalCommand<string> = createCommand('INSERT_PLANTUML_COMMAND');
const INSERT_IMAGE_COMMAND: LexicalCommand<WysiwygImagePayload> = createCommand('INSERT_IMAGE_COMMAND');
const INSERT_TABLE_COMMAND: LexicalCommand<void> = createCommand('INSERT_TABLE_COMMAND');

type WysiwygBlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'code' | 'bullet' | 'number' | 'check';
type InsertBlockType = 'code' | 'table' | 'image' | 'mermaid' | 'plantuml';
type WysiwygDiagramKind = 'mermaid' | 'plantuml';

interface WysiwygImagePayload {
  src: string;
  alt?: string;
  title?: string;
}

interface WysiwygRenderServices {
  renderPlantUml?: (
    source: string,
    context: { signal?: AbortSignal },
  ) => Promise<{ html: string; diagnostics?: MarkdownDiagnostic[] }> | { html: string; diagnostics?: MarkdownDiagnostic[] };
  reportDiagnostics?: (diagnostics: MarkdownDiagnostic[]) => void;
}

const DEFAULT_MERMAID_SOURCE = 'graph TD\n  A[Start] --> B[Done]';
const DEFAULT_PLANTUML_SOURCE = '@startuml\nAlice -> Bob: Hello\n@enduml';
const DEFAULT_IMAGE: WysiwygImagePayload = {
  src: 'https://placehold.co/960x540?text=Image',
  alt: 'Image',
};
const DEFAULT_TABLE_ROWS = [
  ['Name', 'Owner', 'Status'],
  ['Runbook', 'Platform', 'Draft'],
  ['Release notes', 'Docs', 'Ready'],
];
const WysiwygRenderServicesContext = React.createContext<WysiwygRenderServices>({});

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

interface SerializedPlantUmlNode extends SerializedLexicalNode {
  source: string;
}

interface SerializedImageNode extends SerializedLexicalNode {
  src: string;
  alt: string;
  title?: string;
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

class PlantUmlNode extends DecoratorNode<React.ReactElement> {
  __source: string;

  static override getType(): string {
    return 'plantuml';
  }

  static override clone(node: PlantUmlNode): PlantUmlNode {
    return new PlantUmlNode(node.__source, node.__key);
  }

  static override importJSON(serializedNode: SerializedPlantUmlNode): PlantUmlNode {
    return $createPlantUmlNode(serializedNode.source);
  }

  constructor(source: string, key?: NodeKey) {
    super(key);
    this.__source = source;
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'me-wysiwyg-plantuml-node';
    return element;
  }

  override updateDOM(): false {
    return false;
  }

  override exportJSON(): SerializedPlantUmlNode {
    return {
      ...super.exportJSON(),
      type: 'plantuml',
      version: 1,
      source: this.__source,
    };
  }

  override getTextContent(): string {
    return `\`\`\`plantuml\n${this.__source}\n\`\`\``;
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
    return <PlantUmlBlock source={this.__source} nodeKey={this.__key} editor={editor} />;
  }
}

class ImageNode extends DecoratorNode<React.ReactElement> {
  __src: string;
  __alt: string;
  __title?: string;

  static override getType(): string {
    return 'image';
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(
      { src: node.__src, alt: node.__alt, title: node.__title },
      node.__key,
    );
  }

  static override importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      alt: serializedNode.alt,
      title: serializedNode.title,
    });
  }

  constructor(payload: WysiwygImagePayload, key?: NodeKey) {
    super(key);
    this.__src = payload.src;
    this.__alt = payload.alt ?? '';
    this.__title = payload.title;
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'me-wysiwyg-image-node';
    return element;
  }

  override updateDOM(): false {
    return false;
  }

  override exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      version: 1,
      src: this.__src,
      alt: this.__alt,
      title: this.__title,
    };
  }

  override getTextContent(): string {
    return formatImageMarkdown(this.getImage());
  }

  setImage(payload: WysiwygImagePayload): void {
    const writable = this.getWritable();
    writable.__src = payload.src;
    writable.__alt = payload.alt ?? '';
    writable.__title = payload.title;
  }

  getImage(): Required<Pick<WysiwygImagePayload, 'src' | 'alt'>> & Pick<WysiwygImagePayload, 'title'> {
    const latest = this.getLatest();
    return {
      src: latest.__src,
      alt: latest.__alt,
      title: latest.__title,
    };
  }

  override isInline(): false {
    return false;
  }

  override isIsolated(): true {
    return true;
  }

  override decorate(editor: LexicalEditor): React.ReactElement {
    return <ImageBlock image={this.getImage()} nodeKey={this.__key} editor={editor} />;
  }
}

function $createMermaidNode(source: string): MermaidNode {
  return $applyNodeReplacement(new MermaidNode(source));
}

function $isMermaidNode(node: LexicalNode | null | undefined): node is MermaidNode {
  return node instanceof MermaidNode;
}

function $createPlantUmlNode(source: string): PlantUmlNode {
  return $applyNodeReplacement(new PlantUmlNode(source));
}

function $isPlantUmlNode(node: LexicalNode | null | undefined): node is PlantUmlNode {
  return node instanceof PlantUmlNode;
}

function $createImageNode(payload: WysiwygImagePayload): ImageNode {
  return $applyNodeReplacement(new ImageNode(payload));
}

function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
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

const PLANTUML_TRANSFORMER: MultilineElementTransformer = {
  type: 'multiline-element',
  dependencies: [PlantUmlNode],
  regExpStart: /^```(?:plantuml|puml)\s*$/,
  regExpEnd: /^```\s*$/,
  replace(rootNode, _children, _startMatch, _endMatch, linesInBetween) {
    rootNode.append($createPlantUmlNode((linesInBetween ?? []).join('\n')));
  },
  export(node) {
    if (!$isPlantUmlNode(node)) {
      return null;
    }

    return `\`\`\`plantuml\n${node.getSource()}\n\`\`\``;
  },
};

const IMAGE_TRANSFORMER: ElementTransformer = {
  type: 'element',
  dependencies: [ImageNode],
  regExp: /^!\[([^\]]*)\]\((\S+?)(?:\s+"((?:[^"\\]|\\.)*)")?\)\s*$/,
  replace(parentNode, _children, match) {
    const [, alt, src, title] = match;
    parentNode.replace($createImageNode({
      src: unescapeMarkdownAttribute(src ?? ''),
      alt: unescapeMarkdownAttribute(alt ?? ''),
      title: title ? unescapeMarkdownAttribute(title) : undefined,
    }));
  },
  export(node) {
    if (!$isImageNode(node)) {
      return null;
    }

    return formatImageMarkdown(node.getImage());
  },
};

const TABLE_TRANSFORMER: MultilineElementTransformer = {
  type: 'multiline-element',
  dependencies: [TableNode, TableRowNode, TableCellNode],
  regExpStart: /^ {0,3}\|.*\|\s*$/,
  handleImportAfterStartMatch({ lines, rootNode, startLineIndex }) {
    const headerLine = lines[startLineIndex] ?? '';
    const separatorLine = lines[startLineIndex + 1] ?? '';

    if (!isMarkdownTableRowLine(headerLine) || !isMarkdownTableSeparatorLine(separatorLine)) {
      return null;
    }

    const headerCells = parseMarkdownTableRow(headerLine);
    const separatorCells = parseMarkdownTableRow(separatorLine);
    if (headerCells.length === 0 || separatorCells.length !== headerCells.length) {
      return null;
    }

    let endLineIndex = startLineIndex + 1;
    const rows = [headerCells];
    for (let lineIndex = startLineIndex + 2; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex] ?? '';
      if (!isMarkdownTableRowLine(line)) {
        break;
      }

      rows.push(normalizeMarkdownTableRow(parseMarkdownTableRow(line), headerCells.length));
      endLineIndex = lineIndex;
    }

    rootNode.append($createMarkdownTableNode(rows));
    return [true, endLineIndex];
  },
  replace() {
    return false;
  },
  export(node) {
    if (!$isTableNode(node)) {
      return null;
    }

    return formatMarkdownTableNode(node);
  },
};

const WYSIWYG_TRANSFORMERS = [
  IMAGE_TRANSFORMER,
  TABLE_TRANSFORMER,
  MERMAID_TRANSFORMER,
  PLANTUML_TRANSFORMER,
  CHECK_LIST,
  ...TRANSFORMERS,
];
const WYSIWYG_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  ImageNode,
  MermaidNode,
  PlantUmlNode,
];

export type WysiwygToolbarIconKey =
  | 'bold'
  | 'italic'
  | 'inlineCode'
  | 'bulletedList'
  | 'numberedList'
  | 'checkboxList';

export type WysiwygToolbarIcons = Partial<Record<WysiwygToolbarIconKey, React.ReactNode>>;

export interface WysiwygLexicalEditorProps {
  markdown: string;
  readOnly?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  renderServices?: WysiwygRenderServices;
  toolbarIcons?: WysiwygToolbarIcons;
  onChange?: (markdown: string, meta: ChangeMeta) => void;
  onDiagnostics?: (diagnostics: MarkdownDiagnostic[]) => void;
}

export function WysiwygLexicalEditor({
  markdown,
  readOnly = false,
  ariaLabel = 'WYSIWYG Markdown editor',
  placeholder = 'Start typing...',
  renderServices,
  toolbarIcons,
  onChange,
  onDiagnostics,
}: WysiwygLexicalEditorProps): React.ReactElement {
  const lastEmittedMarkdown = React.useRef<string | null>(null);
  const renderServiceValue = React.useMemo<WysiwygRenderServices>(
    () => ({
      ...renderServices,
      reportDiagnostics: onDiagnostics,
    }),
    [onDiagnostics, renderServices],
  );
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
      <WysiwygRenderServicesContext.Provider value={renderServiceValue}>
        <LexicalComposer initialConfig={editorConfig}>
          <EditableStatePlugin readOnly={readOnly} />
          <ExternalMarkdownPlugin markdown={markdown} lastEmittedMarkdown={lastEmittedMarkdown} />
          <WysiwygCommandPlugin />
          {!readOnly ? <WysiwygToolbar icons={toolbarIcons} /> : null}
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
          <TablePlugin
            hasCellMerge={false}
            hasCellBackgroundColor={false}
            hasHorizontalScroll
          />
          <WysiwygChangePlugin
            sourceMarkdown={markdown}
            lastEmittedMarkdown={lastEmittedMarkdown}
            onChange={onChange}
          />
        </LexicalComposer>
      </WysiwygRenderServicesContext.Provider>
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

export interface WysiwygMarkdownListSummary {
  type: 'list';
  listType: 'number' | 'bullet' | 'check';
  items: Array<{
    checked: boolean | undefined;
    text: string;
  }>;
}

export interface WysiwygMarkdownTableSummary {
  type: 'table';
  rows: string[][];
}

/** @internal Test-only semantic inspection helper; not part of the stable package API. */
export function inspectWysiwygMarkdownForTests(markdown: string): WysiwygMarkdownListSummary[] {
  const editor = createEditor({
    namespace: 'MarkdownEditorWysiwygHeadlessInspect',
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

  const lists: WysiwygMarkdownListSummary[] = [];
  editor.getEditorState().read(() => {
    for (const node of $getRoot().getChildren()) {
      if (!$isListNode(node)) {
        continue;
      }

      lists.push({
        type: 'list',
        listType: node.getListType(),
        items: node.getChildren().map((child) => ({
          checked: $isListItemNode(child) ? child.getChecked() : undefined,
          text: child.getTextContent(),
        })),
      });
    }
  });

  return lists;
}

/** @internal Test-only semantic inspection helper; not part of the stable package API. */
export function inspectWysiwygMarkdownTablesForTests(markdown: string): WysiwygMarkdownTableSummary[] {
  const editor = createEditor({
    namespace: 'MarkdownEditorWysiwygHeadlessInspectTables',
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

  const tables: WysiwygMarkdownTableSummary[] = [];
  editor.getEditorState().read(() => {
    for (const node of $getRoot().getChildren()) {
      if (!$isTableNode(node)) {
        continue;
      }

      tables.push({
        type: 'table',
        rows: getTableNodeRows(node),
      });
    }
  });

  return tables;
}

function WysiwygCommandPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(
    () => {
      const removeMermaidCommand = editor.registerCommand(
        INSERT_MERMAID_COMMAND,
        (source) => {
          $insertNodes([$createMermaidNode(source), $createParagraphNode()]);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      );
      const removePlantUmlCommand = editor.registerCommand(
        INSERT_PLANTUML_COMMAND,
        (source) => {
          $insertNodes([$createPlantUmlNode(source), $createParagraphNode()]);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      );
      const removeImageCommand = editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          $insertNodes([$createImageNode(payload), $createParagraphNode()]);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      );
      const removeTableCommand = editor.registerCommand(
        INSERT_TABLE_COMMAND,
        () => {
          const tableNode = $createMarkdownTableNode(DEFAULT_TABLE_ROWS);
          $insertNodes([tableNode, $createParagraphNode()]);
          tableNode.selectStart();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      );

      return () => {
        removeMermaidCommand();
        removePlantUmlCommand();
        removeImageCommand();
        removeTableCommand();
      };
    },
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

function WysiwygToolbar({ icons = {} }: { icons?: WysiwygToolbarIcons }): React.ReactElement {
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

      if (block === 'table') {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, undefined);
        return;
      }

      if (block === 'image') {
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, DEFAULT_IMAGE);
        return;
      }

      if (block === 'mermaid') {
        editor.dispatchCommand(INSERT_MERMAID_COMMAND, DEFAULT_MERMAID_SOURCE);
        return;
      }

      editor.dispatchCommand(INSERT_PLANTUML_COMMAND, DEFAULT_PLANTUML_SOURCE);
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
          {icons.bold ?? 'B'}
        </button>
        <button
          type="button"
          title="Italic"
          aria-pressed={isItalic}
          data-active={isItalic ? 'true' : 'false'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        >
          {icons.italic ?? 'I'}
        </button>
        <button
          type="button"
          title="Inline code"
          aria-pressed={isCode}
          data-active={isCode ? 'true' : 'false'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        >
          {icons.inlineCode ?? '</>'}
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
          {icons.bulletedList ?? '•'}
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          aria-pressed={activeBlock === 'number'}
          data-active={activeBlock === 'number' ? 'true' : 'false'}
          onClick={() => setBlock('number')}
        >
          {icons.numberedList ?? '1.'}
        </button>
        <button
          type="button"
          aria-label="Checkbox list"
          title="Checkbox list"
          aria-pressed={activeBlock === 'check'}
          data-active={activeBlock === 'check' ? 'true' : 'false'}
          onClick={() => setBlock('check')}
        >
          {icons.checkboxList ?? '☑'}
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
          <option value="table">Table</option>
          <option value="image">Image</option>
          <option value="mermaid">Mermaid diagram</option>
          <option value="plantuml">PlantUML diagram</option>
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

function PlantUmlBlock({
  source,
  nodeKey,
  editor,
}: {
  source: string;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}): React.ReactElement {
  const services = React.useContext(WysiwygRenderServicesContext);
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

    if (!services.renderPlantUml) {
      setHtml('');
      setError('PlantUML rendering requires a host renderer.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    setHtml('');

    Promise.resolve(services.renderPlantUml(source, { signal: controller.signal }))
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setHtml(result.html);
        if (result.diagnostics && result.diagnostics.length > 0) {
          services.reportDiagnostics?.(result.diagnostics);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      controller.abort();
    };
  }, [isEditing, services, source]);

  function saveSource() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isPlantUmlNode(node)) {
        node.setSource(draft);
      }
    });
    setIsEditing(false);
  }

  return (
    <figure className="me-wysiwyg-plantuml">
      <figcaption>
        <span>PlantUML</span>
        <button type="button" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </figcaption>
      {isEditing ? (
        <div className="me-wysiwyg-diagram-editor">
          <textarea
            aria-label="PlantUML diagram source"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            rows={7}
          />
          <button type="button" onClick={saveSource}>Apply</button>
        </div>
      ) : error ? (
        <pre className="me-wysiwyg-diagram-error">{error}</pre>
      ) : html ? (
        <div className="me-wysiwyg-diagram-rendered" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="me-wysiwyg-diagram-loading">Rendering diagram...</div>
      )}
    </figure>
  );
}

function ImageBlock({
  image,
  nodeKey,
  editor,
}: {
  image: Required<Pick<WysiwygImagePayload, 'src' | 'alt'>> & Pick<WysiwygImagePayload, 'title'>;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}): React.ReactElement {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(image);

  React.useEffect(() => {
    setDraft(image);
  }, [image]);

  function saveImage() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) {
        node.setImage({
          src: draft.src.trim(),
          alt: draft.alt,
          title: draft.title?.trim() ? draft.title : undefined,
        });
      }
    });
    setIsEditing(false);
  }

  return (
    <figure className="me-wysiwyg-image">
      <figcaption>
        <span>Image</span>
        <button type="button" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </figcaption>
      {isEditing ? (
        <div className="me-wysiwyg-image-editor">
          <label>
            <span>URL</span>
            <input
              type="url"
              value={draft.src}
              onChange={(event) => setDraft((current) => ({ ...current, src: event.currentTarget.value }))}
            />
          </label>
          <label>
            <span>Alt text</span>
            <input
              type="text"
              value={draft.alt}
              onChange={(event) => setDraft((current) => ({ ...current, alt: event.currentTarget.value }))}
            />
          </label>
          <label>
            <span>Title</span>
            <input
              type="text"
              value={draft.title ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.currentTarget.value }))}
            />
          </label>
          <button type="button" onClick={saveImage}>Apply</button>
        </div>
      ) : image.src ? (
        <>
          <img src={image.src} alt={image.alt} title={image.title} />
          {image.alt || image.title ? (
            <p>{image.title || image.alt}</p>
          ) : null}
        </>
      ) : (
        <pre className="me-wysiwyg-diagram-error">Image URL is empty.</pre>
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

function $createMarkdownTableNode(rows: string[][]): TableNode {
  const columnCount = Math.max(1, rows[0]?.length ?? 1);
  const tableNode = $createTableNode();

  rows.forEach((row, rowIndex) => {
    const rowNode = $createTableRowNode();
    const normalizedRow = normalizeMarkdownTableRow(row, columnCount);

    normalizedRow.forEach((cellText) => {
      const cellNode = $createTableCellNode(
        rowIndex === 0 ? TableCellHeaderStates.COLUMN : TableCellHeaderStates.NO_STATUS,
      );
      const paragraphNode = $createParagraphNode();
      paragraphNode.append($createTextNode(cellText));
      cellNode.append(paragraphNode);
      rowNode.append(cellNode);
    });

    tableNode.append(rowNode);
  });

  return tableNode;
}

function isMarkdownTableRowLine(line: string): boolean {
  return /^ {0,3}\|.*\|\s*$/.test(line);
}

function isMarkdownTableSeparatorLine(line: string): boolean {
  if (!isMarkdownTableRowLine(line)) {
    return false;
  }

  const cells = parseMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function parseMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') && trimmed.endsWith('|')
    ? trimmed.slice(1, -1)
    : trimmed;
  const cells: string[] = [];
  let current = '';
  let escaped = false;

  for (const character of inner) {
    if (escaped) {
      current += character === '|' ? character : `\\${character}`;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '|') {
      cells.push(normalizeMarkdownTableCell(current));
      current = '';
      continue;
    }

    current += character;
  }

  if (escaped) {
    current += '\\';
  }
  cells.push(normalizeMarkdownTableCell(current));
  return cells;
}

function normalizeMarkdownTableRow(row: string[], columnCount: number): string[] {
  if (row.length === columnCount) {
    return row;
  }

  if (row.length > columnCount) {
    return row.slice(0, columnCount);
  }

  return [...row, ...Array.from({ length: columnCount - row.length }, () => '')];
}

function normalizeMarkdownTableCell(cell: string): string {
  return cell.trim().replace(/\s+/g, ' ');
}

function formatMarkdownTableNode(tableNode: TableNode): string {
  const rows = getTableNodeRows(tableNode);
  if (rows.length === 0) {
    return '';
  }

  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const normalizedRows = rows.map((row) => normalizeMarkdownTableRow(row, columnCount));
  const [headerRow = []] = normalizedRows;
  const delimiterRow = Array.from({ length: columnCount }, () => '---');

  return [
    formatMarkdownTableRow(headerRow),
    formatMarkdownTableRow(delimiterRow),
    ...normalizedRows.slice(1).map(formatMarkdownTableRow),
  ].join('\n');
}

function getTableNodeRows(tableNode: TableNode): string[][] {
  return tableNode.getChildren().flatMap((rowNode) => {
    if (!$isTableRowNode(rowNode)) {
      return [];
    }

    return [
      rowNode.getChildren().flatMap((cellNode) => {
        if (!$isTableCellNode(cellNode)) {
          return [];
        }

        return [formatMarkdownTableCellText(cellNode)];
      }),
    ];
  });
}

function formatMarkdownTableRow(cells: string[]): string {
  return `| ${cells.map(escapeMarkdownTableCell).join(' | ')} |`;
}

function formatMarkdownTableCellText(cellNode: TableCellNode): string {
  return cellNode
    .getChildren()
    .map((child) => child.getTextContent())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeMarkdownTableCell(cell: string): string {
  return cell.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function formatImageMarkdown(image: WysiwygImagePayload): string {
  const alt = escapeMarkdownAttribute(image.alt ?? '');
  const src = escapeMarkdownAttribute(image.src);
  const title = image.title?.trim();
  return title ? `![${alt}](${src} "${escapeMarkdownAttribute(title)}")` : `![${alt}](${src})`;
}

function escapeMarkdownAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\]/g, '\\]');
}

function unescapeMarkdownAttribute(value: string): string {
  return value.replace(/\\(["\\\]])/g, '$1');
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
  table: 'me-wysiwyg-table',
  tableCell: 'me-wysiwyg-table-cell',
  tableCellHeader: 'me-wysiwyg-table-cell-header',
  tableCellSelected: 'me-wysiwyg-table-cell-selected',
  tableRow: 'me-wysiwyg-table-row',
  tableScrollableWrapper: 'me-wysiwyg-table-scroll',
  tableSelection: 'me-wysiwyg-table-selection',
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
