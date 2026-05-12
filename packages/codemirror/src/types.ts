import type { Extension } from "@codemirror/state";
import type { ChangeMeta, EditorMode } from "@markdown-editor/core";

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

export interface MarkdownEditorViewOptions {
  parent: HTMLElement;
  markdown?: string;
  mode?: CodeMirrorEditorMode;
  readOnly?: boolean;
  autofocus?: boolean;
  placeholder?: string;
  attributes?: Record<string, string>;
  extensions?: Extension[];
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
}

export type { ChangeMeta, EditorMode };
