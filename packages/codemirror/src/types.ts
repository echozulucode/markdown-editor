import type { Extension } from "@codemirror/state";
import type {
  ChangeMeta,
  EditorMode,
  FrontmatterPropertySchema,
  FrontmatterPropertyType
} from "@echozedlabs/core";

export type CodeMirrorEditorMode = Extract<EditorMode, "markdown" | "hybrid" | "preview">;

export interface SelectionSnapshot {
  anchor: number;
  head: number;
}

export interface ChangeRangeMeta {
  from: number;
  to: number;
  inserted: string;
}

export type HybridFrontmatterMode = "table" | "collapsed" | "hidden" | "source";

export interface HybridRenderContext {
  blockId: string;
  signal?: AbortSignal;
}

export interface HybridRenderResult {
  html: string;
}

export type HybridMarkdownRenderer = (
  markdown: string,
  context: HybridRenderContext
) => HybridRenderResult | Promise<HybridRenderResult>;

export interface MarkdownEditorViewOptions {
  parent: HTMLElement;
  markdown?: string;
  mode?: CodeMirrorEditorMode;
  readOnly?: boolean;
  autofocus?: boolean;
  placeholder?: string;
  attributes?: Record<string, string>;
  extensions?: Extension[];
  hybridFrontmatterMode?: HybridFrontmatterMode;
  frontmatterSchema?: FrontmatterPropertySchema[];
  hybridRenderMarkdown?: HybridMarkdownRenderer;
  onChange?: (markdown: string, meta: ChangeMeta) => void;
}

export interface SetMarkdownOptions {
  emitChange?: boolean;
}

export interface MarkdownEditorViewHandle {
  focus(): void;
  destroy(): void;
  getMarkdown(): string;
  setMarkdown(markdown: string, options?: SetMarkdownOptions): void;
  getSelection(): SelectionSnapshot;
  setSelection(selection: SelectionSnapshot): void;
  insertMarkdown(markdown: string): void;
  setReadOnly(readOnly: boolean): void;
  /**
   * Switch the editor mode (markdown <-> hybrid) in place by reconfiguring the
   * existing view, preserving selection, scroll, and undo history. Optionally
   * also updates the hybrid frontmatter display. Avoids the destroy/recreate
   * that loses editor state.
   */
  setMode(mode: CodeMirrorEditorMode, hybridFrontmatterMode?: HybridFrontmatterMode): void;
}

export type { ChangeMeta, EditorMode, FrontmatterPropertySchema, FrontmatterPropertyType };
