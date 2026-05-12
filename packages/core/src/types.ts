import type { Root } from 'mdast';

export type EditorMode = 'markdown' | 'hybrid' | 'preview' | 'wysiwyg';

export interface Frontmatter {
  title?: string;
  status?: 'draft' | 'published';
  tags?: string[];
  owner?: string;
  created_at?: string;
  updated_at?: string;
  authors?: string[];
  slug?: string;
  [key: string]: unknown;
}

export interface ParsedMarkdown {
  raw: string;
  frontmatter: Frontmatter;
  body: string;
  ast: Root;
  hasFrontmatter: boolean;
  rawFrontmatter: string;
  trailing: string;
}

export type MarkdownDocument = ParsedMarkdown;

export interface FrontmatterSplit {
  rawFrontmatter: string;
  body: string;
  hasFrontmatter: boolean;
  frontmatter: Frontmatter;
  trailing: string;
}

export interface TextSelection {
  from: number;
  to: number;
}

export interface DocumentSnapshot {
  markdown: string;
  version: number;
  mode?: EditorMode;
  selection?: SelectionSnapshot;
}

export interface SelectionRangeSnapshot {
  anchor: number;
  head: number;
}

export interface SelectionSnapshot {
  ranges: SelectionRangeSnapshot[];
  mainIndex: number;
}

export interface ChangeMeta {
  source: 'user' | 'programmatic' | 'host' | 'history' | 'api' | 'mode-switch';
  timestamp: number;
  mode?: EditorMode;
  previousMarkdown?: string;
  selection?: SelectionSnapshot;
}

export interface ModeChangeMeta {
  previousMode: EditorMode;
  nextMode: EditorMode;
  timestamp: number;
  source: 'user' | 'programmatic' | 'host';
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface MarkdownDiagnostic {
  id?: string;
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  range?: SelectionRangeSnapshot;
  source?: 'markdown' | 'renderer' | 'mode' | 'host-service' | 'extension' | string;
  details?: unknown;
}

export type EditorDiagnostic = MarkdownDiagnostic;

export interface RenderContext {
  mode?: EditorMode;
  signal?: AbortSignal;
  services?: HostServices;
  hostServices?: HostServices;
}

export interface RenderResult {
  html: string;
  diagnostics?: MarkdownDiagnostic[];
}

export interface BlockRenderer {
  name: string;
  canRender(info: RendererBlockInfo): boolean;
  render(info: RendererBlockInfo, context: RenderContext): RenderResult | Promise<RenderResult>;
}

export interface RendererBlockInfo {
  type: string;
  source: string;
  language?: string;
  meta?: string;
}

export interface RendererRegistry {
  register(renderer: BlockRenderer): void;
  resolve(info: RendererBlockInfo): BlockRenderer | undefined;
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

export interface LinkSuggestion {
  id: string;
  label: string;
  insertText: string;
  description?: string;
}

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

export interface EditorThemeTokens {
  fontFamily: string;
  monoFontFamily: string;
  canvasColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  accentColor: string;
}

export interface MarkdownEditorExtension {
  name: string;
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

export interface MarkdownEditorProps {
  value?: string;
  defaultValue?: string;
  mode?: EditorMode;
  defaultMode?: EditorMode;
  modes?: EditorMode[];
  readOnly?: boolean;
  extensions?: MarkdownEditorExtension[];
  rendererRegistry?: RendererRegistry;
  hostServices?: HostServices;
  features?: Partial<EditorFeatureFlags>;
  theme?: 'light' | 'dark' | 'system' | Partial<EditorThemeTokens>;
  className?: string;
  ariaLabel?: string;
  onSaveShortcut?: () => void;
  onCancelShortcut?: () => void;
  onDiagnostics?: (diagnostics: EditorDiagnostic[]) => void;
  onChange?: (markdown: string, meta: ChangeMeta) => void;
  onModeChange?: (mode: EditorMode, meta: ModeChangeMeta) => void;
}
