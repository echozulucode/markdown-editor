import type {
  MarkdownDiagnostic,
  RenderResult as CoreRenderResult,
} from '@echozedlabs/core';

export type RendererBlockKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'code'
  | 'table'
  | 'image'
  | 'callout'
  | 'mermaid'
  | 'plantuml'
  | 'html';

export interface RendererDiagnostic extends Omit<MarkdownDiagnostic, 'severity'> {
  severity: 'error' | 'warning';
  blockId?: string;
  cause?: unknown;
}

export type RendererResult =
  | {
      ok: true;
      html: CoreRenderResult['html'];
      diagnostics?: RendererDiagnostic[];
    }
  | {
      ok: false;
      html: CoreRenderResult['html'];
      error: RendererDiagnostic;
      diagnostics?: RendererDiagnostic[];
    };

export interface RendererContext {
  blockId: string;
  signal?: AbortSignal;
}

export interface MarkdownBlockBase {
  id: string;
  kind: RendererBlockKind;
  raw: string;
}

export interface ParagraphBlock extends MarkdownBlockBase {
  kind: 'paragraph';
  text: string;
}

export interface HeadingBlock extends MarkdownBlockBase {
  kind: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface CodeBlock extends MarkdownBlockBase {
  kind: 'code' | 'mermaid' | 'plantuml';
  language?: string;
  source: string;
}

export interface TableBlock extends MarkdownBlockBase {
  kind: 'table';
  rows: string[][];
}

export interface ImageBlock extends MarkdownBlockBase {
  kind: 'image';
  alt: string;
  url: string;
  title?: string;
}

export interface CalloutBlock extends MarkdownBlockBase {
  kind: 'callout';
  calloutType: string;
  title?: string;
  body: string;
}

export interface ListItem {
  text: string;
  checked?: boolean;
}

export interface ListBlock extends MarkdownBlockBase {
  kind: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface SimpleBlock extends MarkdownBlockBase {
  kind: 'blockquote' | 'html';
  text: string;
}

export type MarkdownBlock =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | TableBlock
  | ImageBlock
  | CalloutBlock
  | ListBlock
  | SimpleBlock;

export type BlockRenderer<TBlock extends MarkdownBlock = MarkdownBlock> = (
  block: TBlock,
  context: RendererContext
) => RendererResult | Promise<RendererResult>;

export interface CodeRendererOptions {
  language?: string;
  source: string;
  blockId: string;
  signal?: AbortSignal;
}

export interface DiagramRendererOptions {
  source: string;
  blockId: string;
  signal?: AbortSignal;
}

export type AsyncCodeRenderer = (options: CodeRendererOptions) => Promise<RendererResult>;
export type AsyncDiagramRenderer = (options: DiagramRendererOptions) => Promise<RendererResult>;

export interface PlantUmlHostRenderer {
  renderPlantUml(
    source: string,
    options?: Record<string, unknown>
  ): Promise<CoreRenderResult | RendererResult>;
}

export interface RendererRegistryOptions {
  shiki?: AsyncCodeRenderer;
  mermaid?: AsyncDiagramRenderer;
  plantUml?: PlantUmlHostRenderer | AsyncDiagramRenderer;
}
