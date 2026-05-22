---
type: api-design
project: "markdown-editor"
status: draft
updated: 2026-05-18
---

# API Design

## Package Boundary

The MVP package set is intentionally small:

- `@markdown-editor/core`: public types, Markdown parsing/serialization helpers, diagnostics, extension contracts.
- `@markdown-editor/codemirror`: CodeMirror-backed `markdown`, `hybrid`, and `preview` engines.
- `@markdown-editor/renderers`: default renderer registry and safe technical-block renderers.
- `@markdown-editor/react`: public React component that composes engines and renderers.
- `@markdown-editor/wysiwyg-lexical`: optional WYSIWYG mode adapter, loaded only when enabled.

The host application owns persistence, routing, authentication, uploads, page metadata, telemetry transport, and product chrome.

## Core Types

```ts
export type EditorMode = 'markdown' | 'hybrid' | 'preview' | 'wysiwyg';

export interface MarkdownDocument {
  raw: string;
  body: string;
  frontmatter: Record<string, unknown>;
  rawFrontmatter: string;
  hasFrontmatter: boolean;
  trailing: string;
}

export interface TextSelection {
  from: number;
  to: number;
}

export interface ChangeMeta {
  source: 'user' | 'api' | 'history' | 'mode-switch';
  mode: EditorMode;
  previousMarkdown?: string;
  selection?: TextSelection;
  timestamp: number;
}

export interface ModeChangeMeta {
  previousMode: EditorMode;
  nextMode: EditorMode;
  markdown: string;
  timestamp: number;
}

export interface EditorDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'error';
  source: 'markdown' | 'renderer' | 'mode' | 'host-service' | 'extension';
  message: string;
  range?: TextSelection;
  details?: unknown;
}
```

## Markdown Helpers

```ts
export function parseMarkdown(raw: string): MarkdownDocument;
export function serializeMarkdown(document: MarkdownDocument): string;
export function replaceBody(document: MarkdownDocument, body: string): string;
export function roundTripMarkdown(raw: string): string;
```

`serializeMarkdown(parseMarkdown(raw))` must return `raw` for no-op documents. `replaceBody` preserves the original frontmatter envelope byte-for-byte.

## Renderer Contracts

```ts
export interface RenderContext {
  mode: EditorMode;
  hostServices?: HostServices;
  signal?: AbortSignal;
}

export interface RenderResult {
  html: string;
  diagnostics?: EditorDiagnostic[];
}

export interface BlockRenderer {
  name: string;
  languages?: string[];
  render(source: string, context: RenderContext): RenderResult | Promise<RenderResult>;
}

export interface RendererRegistry {
  getBlockRenderer(language: string): BlockRenderer | undefined;
  renderCodeBlock(source: string, language: string, context: RenderContext): Promise<RenderResult>;
  renderDiagram(source: string, language: string, context: RenderContext): Promise<RenderResult>;
}
```

Renderer failures return diagnostics and fallback HTML. They must not throw past the editor boundary.

## Host Services

```ts
export interface LinkSuggestion {
  id: string;
  label: string;
  insertText: string;
  description?: string;
}

export interface HostServices {
  searchLinks?(query: string, signal?: AbortSignal): Promise<LinkSuggestion[]>;
  resolveLink?(href: string, signal?: AbortSignal): Promise<{ exists: boolean; title?: string }>;
  navigateLink?(href: string): void;
  resolveWikiLink?(target: string): string | Promise<string | undefined> | undefined;
  renderPlantUml?(source: string, options?: Record<string, unknown> | AbortSignal): Promise<RenderResult>;
  uploadAsset?(file: File, signal?: AbortSignal): Promise<{ url: string; alt?: string }>;
  reportDiagnostics?(diagnostics: EditorDiagnostic[]): void;
}
```

All host services are optional. Missing services produce disabled affordances or explicit fallback UI, not runtime failures.

## React Component

```ts
export interface MarkdownEditorProps {
  value?: string;
  defaultValue?: string;
  onChange?: (markdown: string, meta: ChangeMeta) => void;
  modes?: EditorMode[];
  mode?: EditorMode;
  defaultMode?: EditorMode;
  initialMode?: EditorMode;
  onModeChange?: (mode: EditorMode, meta: ModeChangeMeta) => void;
  readOnly?: boolean;
  propertySchema?: FrontmatterPropertySchema[];
  features?: Partial<EditorFeatureFlags>;
  renderers?: RendererRegistry;
  hostServices?: HostServices;
  theme?: 'light' | 'dark' | 'system' | Partial<EditorThemeTokens>;
  className?: string;
  ariaLabel?: string;
  onSaveShortcut?: () => void;
  onCancelShortcut?: () => void;
  onDiagnostics?: (diagnostics: EditorDiagnostic[]) => void;
}

export interface MarkdownEditorHandle {
  focus(): void;
  getMarkdown(): string;
  setMarkdown(markdown: string): void;
  getMode(): EditorMode;
  setMode(mode: EditorMode): void;
  getSelection(): TextSelection | null;
  setSelection(selection: TextSelection): void;
  insertMarkdown(markdown: string): void;
  clearHistory(): void;
  getSnapshot(): DocumentSnapshot;
  replaceMarkdown(markdown: string, meta?: ChangeMeta): void;
}

export interface MarkdownEditorComponentProps
  extends Omit<MarkdownEditorProps, 'extensions' | 'rendererRegistry' | 'renderers'> {
  renderers?: RendererRegistry;
  /** Host-supplied icons for the top-level mode switcher. Keep icon packs out of the reusable package. */
  modeIcons?: Partial<Record<EditorMode, React.ReactNode>>;
  /** Host-supplied icons for the optional WYSIWYG toolbar. */
  wysiwygToolbarIcons?: WysiwygToolbarIcons;
}
```

Default behavior:

- `modes` defaults to `['hybrid', 'markdown', 'preview']` until WYSIWYG is installed.
- `initialMode` defaults to `hybrid` when allowed, otherwise the first allowed mode.
- `readOnly` forces `preview` when available, otherwise disables editing in the current mode.
- WYSIWYG is enabled by including `wysiwyg` in `modes`; hosts should not import or configure Lexical internals directly.
- In editable WYSIWYG mode, Markdown typing shortcuts (`# ` headings, `- ` bullets, `1. ` numbered lists, `- [ ] ` tasks, `> ` quotes, and supported fenced/code shortcuts) are handled inside `@markdown-editor/wysiwyg-lexical` and exported as structural Markdown. The shortcut plugin is disabled when `readOnly` is true.

## Feature Flags

```ts
export interface EditorFeatureFlags {
  toolbar: boolean;
  modeSwitcher: boolean;
  syntaxHighlighting: boolean;
  diagrams: boolean;
  mermaid: boolean;
  plantUml: boolean;
  tables: boolean;
  images: boolean;
  callouts: boolean;
  wikiLinks: boolean;
  slashMenu: boolean;
}
```

Features only expose UI when the supporting renderer or host service exists.

## Stability Rules

- Public types live in `@markdown-editor/core`.
- Engine packages may add private adapter types but should not redefine public concepts.
- Contract changes require updating this file and downstream package tests.
- No package may import from `references/knowledge-e3`.
