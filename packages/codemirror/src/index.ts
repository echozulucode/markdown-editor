import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
  type Transaction
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as placeholderExtension
} from "@codemirror/view";

import type {
  ChangeMeta,
  MarkdownEditorViewHandle,
  MarkdownEditorViewOptions,
  SelectionSnapshot,
  SetMarkdownOptions
} from "./types.js";

export type {
  ChangeMeta,
  CodeMirrorEditorMode,
  EditorMode,
  MarkdownEditorViewHandle,
  MarkdownEditorViewOptions,
  SelectionSnapshot,
  SetMarkdownOptions
} from "./types.js";

const readOnlyCompartment = new Compartment();
const editableCompartment = new Compartment();
const modeCompartment = new Compartment();

export function createMarkdownEditorView(
  options: MarkdownEditorViewOptions
): MarkdownEditorViewHandle {
  const mode = options.mode ?? "markdown";
  let destroyed = false;
  let suppressChange = false;

  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.markdown ?? "",
      extensions: createExtensions(options, mode, (transaction) => {
        if (suppressChange || !transaction.docChanged) {
          return;
        }

        const meta: ChangeMeta = {
          source: transaction.isUserEvent("input") ? "user" : "programmatic",
          mode,
          timestamp: Date.now()
        };

        options.onChange?.(transaction.newDoc.toString(), meta);
      })
    })
  });

  if (options.autofocus) {
    view.focus();
  }

  return {
    focus() {
      assertLive();
      view.focus();
    },
    destroy() {
      if (!destroyed) {
        view.destroy();
        destroyed = true;
      }
    },
    getMarkdown() {
      assertLive();
      return view.state.doc.toString();
    },
    setMarkdown(markdownText: string, setOptions?: SetMarkdownOptions) {
      assertLive();
      const currentMarkdown = view.state.doc.toString();

      if (currentMarkdown === markdownText) {
        return;
      }

      suppressChange = setOptions?.emitChange !== true;
      try {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: markdownText
          }
        });
      } finally {
        suppressChange = false;
      }
    },
    getSelection() {
      assertLive();
      return selectionFromState(view.state);
    },
    setSelection(selection: SelectionSnapshot) {
      assertLive();
      const bounded = clampSelection(selection, view.state.doc.length);
      view.dispatch({
        selection: EditorSelection.range(bounded.anchor, bounded.head),
        scrollIntoView: true
      });
    },
    insertMarkdown(markdownText: string) {
      assertLive();
      view.dispatch(
        view.state.replaceSelection(markdownText),
        {
          scrollIntoView: true,
          userEvent: "input"
        }
      );
    },
    setReadOnly(readOnly: boolean) {
      assertLive();
      view.dispatch({
        effects: [
          readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
          editableCompartment.reconfigure(EditorView.editable.of(!readOnly))
        ]
      });
    }
  };

  function assertLive() {
    if (destroyed) {
      throw new Error("Markdown editor view has been destroyed.");
    }
  }
}

function createExtensions(
  options: MarkdownEditorViewOptions,
  mode: MarkdownEditorViewOptions["mode"],
  onTransaction: (transaction: Transaction) => void
): Extension[] {
  const extensions: Extension[] = [
    history(),
    markdown(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.updateListener.of((update) => {
      for (const transaction of update.transactions) {
        onTransaction(transaction);
      }
    }),
    readOnlyCompartment.of(EditorState.readOnly.of(options.readOnly === true)),
    editableCompartment.of(EditorView.editable.of(options.readOnly !== true)),
    modeCompartment.of(modePlaceholder(mode ?? "markdown")),
    EditorView.domEventHandlers({
      beforeinput(event, view) {
        if (view.state.readOnly) {
          event.preventDefault();
          return true;
        }

        return false;
      }
    })
  ];

  if (options.placeholder !== undefined) {
    extensions.push(placeholderExtension(options.placeholder));
  }

  if (options.attributes !== undefined) {
    extensions.push(EditorView.editorAttributes.of(options.attributes));
  }

  if (options.extensions !== undefined) {
    extensions.push(options.extensions);
  }

  return extensions;
}

function modePlaceholder(mode: NonNullable<MarkdownEditorViewOptions["mode"]>): Extension {
  // Phase 2 exposes the mode slot so hybrid/preview can attach decorations later.
  // For now all modes share the raw Markdown editor substrate.
  void mode;
  return [];
}

function selectionFromState(state: EditorState): SelectionSnapshot {
  const selection = state.selection.main;

  return {
    anchor: selection.anchor,
    head: selection.head
  };
}

function clampSelection(
  selection: SelectionSnapshot,
  documentLength: number
): SelectionSnapshot {
  return {
    anchor: clampPosition(selection.anchor, documentLength),
    head: clampPosition(selection.head, documentLength)
  };
}

function clampPosition(position: number, documentLength: number): number {
  if (!Number.isFinite(position)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(position), 0), documentLength);
}
