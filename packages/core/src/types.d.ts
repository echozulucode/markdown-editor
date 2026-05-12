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
export interface FrontmatterSplit {
    rawFrontmatter: string;
    body: string;
    hasFrontmatter: boolean;
    frontmatter: Frontmatter;
    trailing: string;
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
    source: 'user' | 'programmatic' | 'host' | 'history';
    timestamp: number;
    mode?: EditorMode;
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
    code: string;
    message: string;
    severity: DiagnosticSeverity;
    range?: SelectionRangeSnapshot;
    source?: string;
}
export interface RenderContext {
    signal?: AbortSignal;
    services?: HostServices;
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
    resolveWikiLink?(target: string): string | Promise<string | undefined> | undefined;
    renderPlantUml?(source: string, options?: Record<string, unknown>): Promise<RenderResult>;
}
export interface MarkdownEditorExtension {
    name: string;
}
export interface MarkdownEditorHandle {
    focus(): void;
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
    onChange?: (markdown: string, meta: ChangeMeta) => void;
    onModeChange?: (mode: EditorMode, meta: ModeChangeMeta) => void;
}
//# sourceMappingURL=types.d.ts.map