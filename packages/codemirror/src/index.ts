import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  RangeSetBuilder,
  StateField,
  type Extension,
  type Transaction
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder as placeholderExtension,
  WidgetType
} from "@codemirror/view";

import type {
  ChangeMeta,
  FrontmatterPropertySchema,
  FrontmatterPropertyType,
  HybridMarkdownRenderer,
  HybridRenderContext,
  HybridRenderResult,
  MarkdownEditorViewHandle,
  MarkdownEditorViewOptions,
  SelectionSnapshot,
  SetMarkdownOptions
} from "./types.js";

export type {
  ChangeMeta,
  HybridFrontmatterMode,
  HybridMarkdownRenderer,
  CodeMirrorEditorMode,
  EditorMode,
  HybridRenderContext,
  HybridRenderResult,
  MarkdownEditorViewHandle,
  MarkdownEditorViewOptions,
  SelectionSnapshot,
  SetMarkdownOptions
} from "./types.js";

const readOnlyCompartment = new Compartment();
const editableCompartment = new Compartment();
const modeCompartment = new Compartment();
const allowFrontmatterEdit = Annotation.define<boolean>();

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
          },
          annotations: allowFrontmatterEdit.of(true)
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
    EditorState.transactionFilter.of((transaction) => {
      if (
        mode === "hybrid"
        && options.hybridFrontmatterMode !== "source"
        && transaction.docChanged
        && transaction.annotation(allowFrontmatterEdit) !== true
        && transactionTouchesHiddenFrontmatter(transaction)
      ) {
        return [];
      }

      return transaction;
    }),
    readOnlyCompartment.of(EditorState.readOnly.of(options.readOnly === true)),
    editableCompartment.of(EditorView.editable.of(options.readOnly !== true)),
    modeCompartment.of(modePlaceholder(mode ?? "markdown", options)),
    EditorView.domEventHandlers({
      beforeinput(event, view) {
        if (view.state.readOnly) {
          event.preventDefault();
          return true;
        }

        if (mode === "hybrid" && isDestructiveBeforeInput(event)) {
          const direction = event.inputType.includes("Forward") ? "forward" : "backward";
          if (preventHiddenFrontmatterDelete(view, direction, options)) {
            event.preventDefault();
            return true;
          }
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

function modePlaceholder(mode: NonNullable<MarkdownEditorViewOptions["mode"]>, options: MarkdownEditorViewOptions): Extension {
  return mode === "hybrid" ? hybridMarkdownExtension(options) : [];
}

function hybridMarkdownExtension(options: MarkdownEditorViewOptions): Extension {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildHybridDecorations(state, options);
    },
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection
        ? buildHybridDecorations(transaction.state, options)
        : decorations;
    }
  });

  return [
    Prec.high(keymap.of([
      {
        key: "ArrowDown",
        run: (view) => moveSelectionByLogicalLine(view, "down", options)
      },
      {
        key: "ArrowUp",
        run: (view) => moveSelectionByLogicalLine(view, "up", options)
      },
      {
        key: "Backspace",
        run: (view) => preventHiddenFrontmatterDelete(view, "backward", options)
      },
      {
        key: "Delete",
        run: (view) => preventHiddenFrontmatterDelete(view, "forward", options)
      }
    ])),
    field,
    EditorView.decorations.from(field)
  ];
}

function buildHybridDecorations(state: EditorState, options: MarkdownEditorViewOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLine = state.doc.lineAt(state.selection.main.head).number;
  let lineNumber = 1;

  const frontmatter = findFrontmatterRange(state);
  if (frontmatter && options.hybridFrontmatterMode !== "source") {
    if (options.hybridFrontmatterMode !== "hidden") {
      builder.add(
        frontmatter.from,
        frontmatter.to,
        Decoration.replace({
          block: true,
          widget: new FrontmatterPropertiesWidget(
            frontmatter.raw,
            frontmatter.from,
            frontmatter.to,
            options.frontmatterSchema
          )
        })
      );
    } else {
      builder.add(frontmatter.from, frontmatter.to, Decoration.replace({ block: true }));
    }
    lineNumber = frontmatter.endLine + 1;
  }

  while (lineNumber <= state.doc.lines) {
    const line = state.doc.line(lineNumber);
    const text = line.text;

    const renderedBlock = findHybridRenderedBlock(state, lineNumber);
    if (renderedBlock) {
      if (activeLine < renderedBlock.startLine || activeLine > renderedBlock.endLine) {
        builder.add(
          renderedBlock.from,
          renderedBlock.to,
          Decoration.replace({
            block: true,
            widget: new RenderedMarkdownBlockWidget(
              renderedBlock.raw,
              `hybrid-block-${renderedBlock.startLine}`,
              renderedBlock.from,
              options.hybridRenderMarkdown
            )
          })
        );
      }
      lineNumber = renderedBlock.endLine + 1;
      continue;
    }

    if (lineNumber === activeLine) {
      lineNumber += 1;
      continue;
    }

    const heading = text.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      const markerEnd = line.from + heading[1].length + 1;
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: `cm-me-hybrid-line cm-me-hybrid-heading cm-me-hybrid-heading-${heading[1].length}`
        })
      );
      builder.add(line.from, markerEnd, Decoration.replace({}));
      lineNumber += 1;
      continue;
    }

    const task = text.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+/);
    if (task) {
      const markerStart = line.from + task[1].length;
      const markerEnd = line.from + task[0].length;
      builder.add(line.from, line.from, Decoration.line({ class: "cm-me-hybrid-line cm-me-hybrid-task-line" }));
      builder.add(
        markerStart,
        markerEnd,
        Decoration.replace({ widget: new TaskCheckboxWidget(task[2].toLowerCase() === "x") })
      );
      lineNumber += 1;
      continue;
    }

    const unorderedList = text.match(/^(\s*)[-*+]\s+/);
    if (unorderedList) {
      const markerStart = line.from + unorderedList[1].length;
      const markerEnd = line.from + unorderedList[0].length;
      builder.add(line.from, line.from, Decoration.line({ class: "cm-me-hybrid-line cm-me-hybrid-list-line" }));
      builder.add(markerStart, markerEnd, Decoration.replace({ widget: new BulletWidget() }));
      lineNumber += 1;
      continue;
    }

    const orderedList = text.match(/^(\s*)(\d+[.)])\s+/);
    if (orderedList) {
      const markerStart = line.from + orderedList[1].length;
      const markerEnd = line.from + orderedList[0].length;
      builder.add(line.from, line.from, Decoration.line({ class: "cm-me-hybrid-line cm-me-hybrid-list-line" }));
      builder.add(markerStart, markerEnd, Decoration.replace({ widget: new OrderedMarkerWidget(orderedList[2]) }));
      lineNumber += 1;
      continue;
    }

    const blockquote = text.match(/^>\s+/);
    if (blockquote) {
      builder.add(line.from, line.from, Decoration.line({ class: "cm-me-hybrid-line cm-me-hybrid-blockquote" }));
      builder.add(line.from, line.from + blockquote[0].length, Decoration.replace({}));
    }

    addInlineLinkDecorations(builder, line.from, text);

    lineNumber += 1;
  }

  return builder.finish();
}

const TRASH_ICON_PATH = "M160 400c0 26.5 21.5 48 48 48h160c26.5 0 48-21.5 48-48V160H160v240zm64-192h32v176h-32V208zm96 0h32v176h-32V208zM352 96l-16-32h-96l-16 32h-80v32h288V96h-80z";

function setIconSvg(button: HTMLButtonElement, path: string): void {
  button.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 576 512");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("cm-me-inline-icon");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("fill", "currentColor");
  shape.setAttribute("d", path);
  svg.append(shape);
  button.append(svg);
}

function isDestructiveBeforeInput(event: InputEvent): boolean {
  return event.inputType === "deleteContentBackward"
    || event.inputType === "deleteContentForward"
    || event.inputType === "deleteWordBackward"
    || event.inputType === "deleteWordForward"
    || event.inputType === "deleteHardLineBackward"
    || event.inputType === "deleteHardLineForward"
    || event.inputType === "deleteSoftLineBackward"
    || event.inputType === "deleteSoftLineForward"
    || event.inputType === "deleteByCut"
    || event.inputType === "deleteByDrag";
}

function transactionTouchesHiddenFrontmatter(transaction: Transaction): boolean {
  const frontmatter = findFrontmatterRange(transaction.startState);
  if (!frontmatter) {
    return false;
  }

  const protectedFrom = frontmatter.from;
  const protectedTo = Math.min(transaction.startState.doc.length, frontmatter.to + 1);
  let touchesProtectedRange = false;

  transaction.changes.iterChanges((fromA, toA) => {
    if (fromA < protectedTo && toA > protectedFrom) {
      touchesProtectedRange = true;
    }
  });

  return touchesProtectedRange;
}

function preventHiddenFrontmatterDelete(
  view: EditorView,
  direction: "backward" | "forward",
  options: MarkdownEditorViewOptions
): boolean {
  if (options.hybridFrontmatterMode === "source") {
    return false;
  }

  const frontmatter = findFrontmatterRange(view.state);
  if (!frontmatter) {
    return false;
  }

  const selection = view.state.selection.main;
  if (!selection.empty) {
    // In table/hidden hybrid mode the YAML block is represented by a widget, not
    // editable text. If a selection reaches into that protected range, swallow
    // destructive keys so Backspace/Delete cannot remove the YAML envelope.
    return selection.from < frontmatter.to;
  }

  if (direction === "backward") {
    // Cursor can sit at the first visible body position immediately after the
    // replaced frontmatter block. Backspace there would delete the hidden YAML
    // terminator/newline, making the item lose required properties.
    return selection.head <= frontmatter.to + 1;
  }

  return selection.head < frontmatter.to;
}

function moveSelectionByLogicalLine(
  view: EditorView,
  direction: "up" | "down",
  options: MarkdownEditorViewOptions
): boolean {
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const currentLine = view.state.doc.lineAt(selection.head);
  let targetLineNumber = direction === "down" ? currentLine.number + 1 : currentLine.number - 1;

  if (targetLineNumber < 1 || targetLineNumber > view.state.doc.lines) {
    return false;
  }

  const frontmatter = options.hybridFrontmatterMode === "source" ? null : findFrontmatterRange(view.state);
  if (
    frontmatter &&
    targetLineNumber >= frontmatter.startLine &&
    targetLineNumber <= frontmatter.endLine
  ) {
    targetLineNumber = direction === "down" ? frontmatter.endLine + 1 : frontmatter.startLine - 1;
  }

  if (targetLineNumber < 1 || targetLineNumber > view.state.doc.lines) {
    return false;
  }

  const column = selection.head - currentLine.from;
  const targetLine = view.state.doc.line(targetLineNumber);
  const targetPosition = Math.min(targetLine.from + column, targetLine.to);

  view.dispatch({
    selection: EditorSelection.cursor(targetPosition)
  });
  return true;
}

interface LineRange {
  from: number;
  to: number;
  startLine: number;
  endLine: number;
  raw: string;
}

function findFrontmatterRange(state: EditorState): (LineRange & { entries: FrontmatterEntry[] }) | null {
  if (state.doc.lines < 3 || state.doc.line(1).text.trim() !== "---") {
    return null;
  }

  for (let lineNumber = 2; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (line.text.trim() === "---") {
      const from = state.doc.line(1).from;
      const to = line.to;
      const raw = state.sliceDoc(from, to);
      return {
        from,
        to,
        startLine: 1,
        endLine: lineNumber,
        raw,
        entries: parseFrontmatter(raw)
      };
    }
  }

  return null;
}

function findFencedBlock(state: EditorState, startLine: number): LineRange | null {
  if (startLine < 1 || startLine > state.doc.lines) {
    return null;
  }

  const firstLine = state.doc.line(startLine);
  if (!/^```[\w-]*\s*$/.test(firstLine.text)) {
    return null;
  }

  for (let lineNumber = startLine + 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (line.text.startsWith("```")) {
      return {
        from: firstLine.from,
        to: line.to,
        startLine,
        endLine: lineNumber,
        raw: state.sliceDoc(firstLine.from, line.to)
      };
    }
  }

  return null;
}

function findHybridRenderedBlock(state: EditorState, startLine: number): LineRange | null {
  return findFencedBlock(state, startLine)
    ?? findCalloutBlock(state, startLine)
    ?? findTableBlock(state, startLine)
    ?? findImageBlock(state, startLine);
}

function findCalloutBlock(state: EditorState, startLine: number): LineRange | null {
  if (startLine < 1 || startLine > state.doc.lines) {
    return null;
  }

  const firstLine = state.doc.line(startLine);
  if (!/^>\s?\[!\w+\]/.test(firstLine.text)) {
    return null;
  }

  let endLineNumber = startLine;
  while (endLineNumber + 1 <= state.doc.lines && state.doc.line(endLineNumber + 1).text.startsWith(">")) {
    endLineNumber += 1;
  }

  const endLine = state.doc.line(endLineNumber);
  return {
    from: firstLine.from,
    to: endLine.to,
    startLine,
    endLine: endLineNumber,
    raw: state.sliceDoc(firstLine.from, endLine.to)
  };
}

function findTableBlock(state: EditorState, startLine: number): LineRange | null {
  if (startLine < 1 || startLine + 1 > state.doc.lines) {
    return null;
  }

  const firstLine = state.doc.line(startLine);
  const separatorLine = state.doc.line(startLine + 1);
  if (!isTableLine(firstLine.text) || !isTableSeparator(separatorLine.text)) {
    return null;
  }

  let endLineNumber = startLine + 1;
  while (endLineNumber + 1 <= state.doc.lines && isTableLine(state.doc.line(endLineNumber + 1).text)) {
    endLineNumber += 1;
  }

  const endLine = state.doc.line(endLineNumber);
  return {
    from: firstLine.from,
    to: endLine.to,
    startLine,
    endLine: endLineNumber,
    raw: state.sliceDoc(firstLine.from, endLine.to)
  };
}

function findImageBlock(state: EditorState, startLine: number): LineRange | null {
  if (startLine < 1 || startLine > state.doc.lines) {
    return null;
  }

  const line = state.doc.line(startLine);
  if (!/^!\[[^\]]*]\([^)]+\)$/.test(line.text.trim())) {
    return null;
  }

  return {
    from: line.from,
    to: line.to,
    startLine,
    endLine: startLine,
    raw: line.text
  };
}

function isTableLine(text: string): boolean {
  return /^\|.*\|$/.test(text.trim());
}

function isTableSeparator(text: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(text.trim());
}

function addInlineLinkDecorations(builder: RangeSetBuilder<Decoration>, lineFrom: number, text: string): void {
  const inlineLinkPattern = /(!)?\[([^\]]+)]\(([^)]+)\)|\[\[([^\]|]+)(?:\|([^\]]+))?]]/g;

  for (const match of text.matchAll(inlineLinkPattern)) {
    if (match.index === undefined || match[1] === "!") {
      continue;
    }

    const from = lineFrom + match.index;
    const to = from + match[0].length;
    if (match[2] !== undefined) {
      builder.add(from, to, Decoration.replace({
        widget: new InlineLinkWidget(match[2], match[3], from, false)
      }));
      continue;
    }

    const target = match[4];
    const label = match[5] ?? target;
    builder.add(from, to, Decoration.replace({
      widget: new InlineLinkWidget(label, target, from, true)
    }));
  }
}

interface FrontmatterEntry {
  key: string;
  value: string;
  type: SupportedFrontmatterPropertyType;
}

type SupportedFrontmatterPropertyType = Extract<
  FrontmatterPropertyType,
  "text" | "date" | "time" | "datetime" | "tags" | "boolean" | "link"
>;

const frontmatterPropertyTypes: SupportedFrontmatterPropertyType[] = [
  "text",
  "date",
  "time",
  "datetime",
  "tags",
  "boolean",
  "link"
];

const frontmatterTypeLabels: Record<SupportedFrontmatterPropertyType, string> = {
  text: "Text",
  date: "Date",
  time: "Time",
  datetime: "Date and time",
  tags: "Tags",
  boolean: "Boolean",
  link: "Link"
};

const frontmatterTypeIcons: Record<SupportedFrontmatterPropertyType, string> = {
  text: "▭",
  date: "◷",
  time: "◴",
  datetime: "◷",
  tags: "#",
  boolean: "✓",
  link: "@"
};

function parseFrontmatter(raw: string): FrontmatterEntry[] {
  const entries: FrontmatterEntry[] = [];
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").slice(1, -1);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const listStart = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (listStart) {
      const items: string[] = [];
      let listIndex = index + 1;
      while (listIndex < lines.length) {
        const item = lines[listIndex].match(/^\s{2,}-\s*(.*)$/);
        if (!item) {
          break;
        }
        items.push(normalizeFrontmatterScalar(item[1]));
        listIndex += 1;
      }

      if (items.length > 0) {
        const value = items.join(", ");
        entries.push({ key: listStart[1], value, type: inferFrontmatterType(listStart[1], value, true) });
        index = listIndex - 1;
        continue;
      }
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const value = normalizeFrontmatterValue(match[2] || "");
    entries.push({ key: match[1], value, type: inferFrontmatterType(match[1], value, false) });
  }

  return entries;
}

function updateFrontmatterEntry(raw: string, entryIndex: number, patch: Partial<FrontmatterEntry>): string {
  const entries = parseFrontmatter(raw);
  const current = entries[entryIndex];
  if (!current) {
    return raw;
  }

  entries[entryIndex] = normalizeFrontmatterEntry({ ...current, ...patch });
  return serializeFrontmatter(raw, entries);
}

function addFrontmatterEntry(raw: string, schema?: readonly FrontmatterPropertySchema[]): string {
  const entries = parseFrontmatter(raw);
  const existingKeys = new Set(entries.map((entry) => entry.key.toLowerCase()));
  const schemaEntry = schema
    ?.slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .find((entry) => !existingKeys.has(entry.key.toLowerCase()));
  const type = supportedSchemaType(schemaEntry?.type);
  entries.push({
    key: schemaEntry?.key ?? nextFrontmatterKey(entries),
    value: normalizeDefaultFrontmatterValue(schemaEntry?.defaultValue, type),
    type
  });
  return serializeFrontmatter(raw, entries);
}

function normalizeDefaultFrontmatterValue(
  value: FrontmatterPropertySchema["defaultValue"] | undefined,
  type: SupportedFrontmatterPropertyType
): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return coerceFrontmatterValue(value ?? defaultValueForType(type), type);
}

function removeFrontmatterEntry(raw: string, entryIndex: number): string {
  const entries = parseFrontmatter(raw);
  if (!entries[entryIndex]) {
    return raw;
  }

  entries.splice(entryIndex, 1);
  return serializeFrontmatter(raw, entries);
}

function moveFrontmatterEntry(raw: string, entryIndex: number, direction: "up" | "down"): string {
  const entries = parseFrontmatter(raw);
  const targetIndex = direction === "up" ? entryIndex - 1 : entryIndex + 1;

  return moveFrontmatterEntryTo(raw, entryIndex, targetIndex, entries);
}

function moveFrontmatterEntryTo(
  raw: string,
  entryIndex: number,
  targetIndex: number,
  parsedEntries = parseFrontmatter(raw)
): string {
  const entries = parsedEntries.slice();
  if (!entries[entryIndex] || targetIndex < 0 || targetIndex >= entries.length) {
    return raw;
  }

  const [entry] = entries.splice(entryIndex, 1);
  entries.splice(targetIndex, 0, entry);
  return serializeFrontmatter(raw, entries);
}

function serializeFrontmatter(raw: string, entries: FrontmatterEntry[]): string {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = ["---"];

  for (const entry of entries.map(normalizeFrontmatterEntry)) {
    if (entry.type === "tags") {
      const items = splitFrontmatterTags(entry.value);
      lines.push(`${entry.key}: ${items.join(", ")}`);
      continue;
    }

    lines.push(`${entry.key}: ${serializeFrontmatterValue(entry)}`);
  }

  lines.push("---");
  return lines.join(newline);
}

function normalizeFrontmatterEntry(entry: FrontmatterEntry): FrontmatterEntry {
  const type = frontmatterPropertyTypes.includes(entry.type) ? entry.type : "text";
  return {
    key: sanitizeFrontmatterKey(entry.key),
    value: coerceFrontmatterValue(entry.value, type),
    type
  };
}

function normalizeFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  const inlineList = trimmed.match(/^\[(.*)]$/);
  if (inlineList) {
    return splitFrontmatterTags(inlineList[1]).join(", ");
  }

  return normalizeFrontmatterScalar(trimmed);
}

function normalizeFrontmatterScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function inferFrontmatterType(key: string, value: string, fromList: boolean): SupportedFrontmatterPropertyType {
  const normalizedKey = key.toLowerCase();
  const trimmed = value.trim();

  if (/^(true|false)$/i.test(trimmed)) {
    return "boolean";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "date";
  }

  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    return "time";
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    return "datetime";
  }

  if (/^https?:\/\//i.test(trimmed) || normalizedKey === "link" || normalizedKey === "url") {
    return "link";
  }

  if (
    fromList
    || normalizedKey === "tag"
    || normalizedKey === "tags"
    || normalizedKey === "category"
    || normalizedKey === "categories"
    || trimmed.includes(",")
  ) {
    return "tags";
  }

  return "text";
}

function serializeFrontmatterValue(entry: FrontmatterEntry): string {
  if (entry.type === "boolean") {
    return /^true$/i.test(entry.value) ? "true" : "false";
  }

  return entry.value;
}

function coerceFrontmatterValue(value: string, type: SupportedFrontmatterPropertyType): string {
  const trimmed = value.trim();
  if (type === "boolean") {
    return /^true$/i.test(trimmed) ? "true" : "false";
  }

  if (type === "tags") {
    return splitFrontmatterTags(trimmed).join(", ");
  }

  if (type === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
  }

  if (type === "time") {
    const time = trimmed.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
    return time ? time[1] : "";
  }

  if (type === "datetime") {
    const datetime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?$/);
    return datetime ? `${datetime[1]}T${datetime[2]}` : "";
  }

  return value.replace(/\r?\n/g, " ");
}

function splitFrontmatterTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => normalizeFrontmatterScalar(item))
    .filter((item) => item.length > 0);
}

function sanitizeFrontmatterKey(key: string): string {
  const sanitized = key.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "");
  return sanitized || "property";
}

function nextFrontmatterKey(entries: FrontmatterEntry[]): string {
  const keys = new Set(entries.map((entry) => entry.key));
  if (!keys.has("property")) {
    return "property";
  }

  for (let index = 2; ; index += 1) {
    const key = `property_${index}`;
    if (!keys.has(key)) {
      return key;
    }
  }
}

function getFrontmatterSchemaEntry(
  schema: readonly FrontmatterPropertySchema[] | undefined,
  key: string
): FrontmatterPropertySchema | undefined {
  return schema?.find((entry) => entry.key.toLowerCase() === key.toLowerCase());
}

function supportedSchemaType(type: FrontmatterPropertyType | undefined): SupportedFrontmatterPropertyType {
  return type !== undefined && frontmatterPropertyTypes.includes(type as SupportedFrontmatterPropertyType)
    ? type as SupportedFrontmatterPropertyType
    : "text";
}

function entryTypeWithSchema(
  entry: FrontmatterEntry,
  schema: readonly FrontmatterPropertySchema[] | undefined
): SupportedFrontmatterPropertyType {
  const schemaEntry = getFrontmatterSchemaEntry(schema, entry.key);
  return schemaEntry ? supportedSchemaType(schemaEntry.type) : entry.type;
}

function typeIconForEntry(
  type: SupportedFrontmatterPropertyType,
  _schemaEntry: FrontmatterPropertySchema | undefined
): string {
  // The schema `icon` field is intentionally ignored here: hosts often use
  // symbolic IDs such as "title" or "status", and rendering those strings as
  // visible text makes rows read as "title Title". Keep the reusable widget
  // graphical and type-oriented instead.
  return frontmatterTypeIcons[type];
}

function labelForEntry(entry: FrontmatterEntry, schema: readonly FrontmatterPropertySchema[] | undefined): string {
  const schemaEntry = getFrontmatterSchemaEntry(schema, entry.key);
  return schemaEntry?.label ?? entry.key;
}

function defaultValueForType(type: SupportedFrontmatterPropertyType): string {
  if (type === "boolean") {
    return "false";
  }

  return "";
}

class TaskCheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement("span");
    checkbox.className = this.checked ? "cm-me-task-checkbox cm-me-task-checkbox-checked" : "cm-me-task-checkbox";
    checkbox.setAttribute("aria-hidden", "true");
    return checkbox;
  }
}

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "cm-me-list-bullet";
    bullet.textContent = "•";
    return bullet;
  }
}

class OrderedMarkerWidget extends WidgetType {
  constructor(private readonly marker: string) {
    super();
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = "cm-me-ordered-marker";
    marker.textContent = `${this.marker} `;
    return marker;
  }
}

class InlineLinkWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly href: string,
    private readonly from: number,
    private readonly wikiLink: boolean
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const link = document.createElement("a");
    link.className = this.wikiLink ? "cm-me-hybrid-link cm-me-hybrid-wiki-link" : "cm-me-hybrid-link";
    link.href = this.wikiLink ? `#${this.href}` : this.href;
    link.textContent = this.label;
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
    link.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({
        selection: EditorSelection.cursor(this.from)
      });
    });
    return link;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class FrontmatterPropertiesWidget extends WidgetType {
  constructor(
    private readonly raw: string,
    private readonly from: number,
    private readonly to: number,
    private readonly schema?: readonly FrontmatterPropertySchema[]
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-me-properties";
    wrapper.setAttribute("aria-label", "Markdown properties");
    const readOnly = view.state.readOnly;
    const entries = parseFrontmatter(this.raw);

    const heading = document.createElement("div");
    heading.className = "cm-me-properties-heading";
    heading.textContent = "Properties";

    const list = document.createElement("div");
    list.className = "cm-me-properties-table";
    list.setAttribute("role", "list");
    entries.forEach((entry, index) => {
      const type = entryTypeWithSchema(entry, this.schema);
      const schemaEntry = getFrontmatterSchemaEntry(this.schema, entry.key);
      const normalizedEntry = type === entry.type ? entry : { ...entry, type };
      const row = document.createElement("div");
      const handleCell = document.createElement("div");
      const nameCell = document.createElement("div");
      const valueCell = document.createElement("div");
      const actionCell = document.createElement("div");

      row.className = "cm-me-property-row";
      row.dataset.propertyType = type;
      row.dataset.propertyKey = entry.key;
      row.setAttribute("role", "listitem");
      row.addEventListener("dragover", (event) => {
        if (!readOnly) {
          event.preventDefault();
        }
      });
      row.addEventListener("drop", (event) => {
        if (readOnly) {
          return;
        }
        event.preventDefault();
        const sourceIndex = Number(event.dataTransfer?.getData("text/plain"));
        if (Number.isInteger(sourceIndex)) {
          this.commitRaw(view, moveFrontmatterEntryTo(this.raw, sourceIndex, index, entries));
        }
      });

      handleCell.className = "cm-me-property-order-cell";
      nameCell.className = "cm-me-property-key-cell";
      valueCell.className = "cm-me-property-value-cell";
      actionCell.className = "cm-me-property-remove-cell";

      const dragHandle = this.createButton("", `Drag ${entry.key} property`, readOnly, () => undefined);
      dragHandle.className = "cm-me-property-drag-handle";
      dragHandle.draggable = !readOnly;
      dragHandle.title = `Drag ${entry.key} property`;
      dragHandle.addEventListener("dragstart", (event) => {
        if (readOnly || !event.dataTransfer) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      });
      dragHandle.addEventListener("keydown", (event) => {
        if (readOnly || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
          return;
        }
        event.preventDefault();
        this.commitRaw(
          view,
          moveFrontmatterEntry(this.raw, index, event.key === "ArrowUp" ? "up" : "down")
        );
      });
      handleCell.append(dragHandle);

      nameCell.append(this.createNameMenu(view, normalizedEntry, index, readOnly, schemaEntry));
      valueCell.append(this.createValueControl(view, normalizedEntry, index, readOnly));

      const removeButton = this.createButton("", `Remove ${entry.key} property`, readOnly, () => {
        this.commitRaw(view, removeFrontmatterEntry(this.raw, index));
      });
      removeButton.classList.add("cm-me-property-remove");
      setIconSvg(removeButton, TRASH_ICON_PATH);
      actionCell.append(removeButton);

      row.append(handleCell, nameCell, valueCell, actionCell);
      list.append(row);
    });

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cm-me-property-empty";
      empty.textContent = "No properties";
      list.append(empty);
    }

    const addButton = this.createButton("+ Add property", "Add property", readOnly, () => {
      this.commitRaw(view, addFrontmatterEntry(this.raw, this.schema));
    });
    addButton.classList.add("cm-me-property-add");

    wrapper.append(heading, list, addButton);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  private createNameMenu(
    view: EditorView,
    entry: FrontmatterEntry,
    entryIndex: number,
    readOnly: boolean,
    schemaEntry: FrontmatterPropertySchema | undefined
  ): HTMLElement {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const icon = document.createElement("span");
    const label = document.createElement("span");
    const menu = document.createElement("div");
    const keyLabel = document.createElement("label");
    const keyInput = document.createElement("input");
    const typeMenu = document.createElement("div");
    const suggestions = this.schema?.filter((schema) => schema.key.toLowerCase() !== entry.key.toLowerCase()) ?? [];

    details.className = "cm-me-property-menu-details";
    details.addEventListener("toggle", () => {
      if (details.open) {
        setTimeout(() => keyInput.focus(), 0);
      }
    });

    summary.className = "cm-me-property-summary";
    summary.setAttribute("aria-label", `${entry.key} property settings`);
    summary.title = `${frontmatterTypeLabels[entry.type]} property`;

    icon.className = "cm-me-property-type-icon";
    icon.textContent = typeIconForEntry(entry.type, schemaEntry);
    icon.setAttribute("aria-hidden", "true");

    label.className = "cm-me-property-name";
    label.textContent = labelForEntry(entry, this.schema);
    summary.append(icon, label);

    menu.className = "cm-me-property-menu";
    keyLabel.className = "cm-me-property-menu-label";
    keyLabel.textContent = "Name";
    keyInput.className = "cm-me-property-key-input";
    keyInput.value = entry.key;
    keyInput.disabled = readOnly;
    keyInput.setAttribute("aria-label", `Property name for ${entry.key}`);
    keyInput.addEventListener("change", () => {
      const schemaMatch = getFrontmatterSchemaEntry(this.schema, keyInput.value);
      const nextType = schemaMatch ? supportedSchemaType(schemaMatch.type) : entry.type;
      this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, {
        key: keyInput.value,
        type: nextType,
        value: schemaMatch?.defaultValue === undefined
          ? coerceFrontmatterValue(entry.value, nextType)
          : normalizeDefaultFrontmatterValue(schemaMatch.defaultValue, nextType)
      }));
    });
    this.blurOnEnter(keyInput);
    keyLabel.append(keyInput);
    menu.append(keyLabel);

    if (suggestions.length > 0) {
      const suggestionList = document.createElement("div");
      suggestionList.className = "cm-me-property-suggestions";
      for (const suggestion of suggestions) {
        const suggestionButton = this.createButton(
          suggestion.label ?? suggestion.key,
          `Use ${suggestion.label ?? suggestion.key} property`,
          readOnly,
          () => {
            const type = supportedSchemaType(suggestion.type);
            this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, {
              key: suggestion.key,
              type,
              value: normalizeDefaultFrontmatterValue(suggestion.defaultValue, type)
            }));
          }
        );
        suggestionButton.classList.add("cm-me-property-suggestion");
        suggestionList.append(suggestionButton);
      }
      menu.append(suggestionList);
    }

    typeMenu.className = "cm-me-property-type-menu";
    typeMenu.setAttribute("role", "menu");
    for (const type of frontmatterPropertyTypes) {
      const typeButton = this.createButton(
        `${frontmatterTypeIcons[type]} ${frontmatterTypeLabels[type]}`,
        `Set ${entry.key} property type to ${frontmatterTypeLabels[type]}`,
        readOnly,
        () => {
          this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, {
            type,
            value: coerceFrontmatterValue(entry.value, type)
          }));
        }
      );
      typeButton.classList.add("cm-me-property-type-option");
      typeButton.dataset.active = type === entry.type ? "true" : "false";
      typeButton.setAttribute("aria-pressed", type === entry.type ? "true" : "false");
      typeButton.setAttribute("role", "menuitemradio");
      typeButton.setAttribute("aria-checked", type === entry.type ? "true" : "false");
      typeMenu.append(typeButton);
    }
    menu.append(typeMenu);
    details.append(summary, menu);
    return details;
  }

  private createValueControl(
    view: EditorView,
    entry: FrontmatterEntry,
    entryIndex: number,
    readOnly: boolean
  ): HTMLElement {
    if (entry.type === "boolean") {
      const checkbox = document.createElement("input");
      checkbox.className = "cm-me-property-input cm-me-property-boolean-input";
      checkbox.type = "checkbox";
      checkbox.checked = /^true$/i.test(entry.value);
      checkbox.disabled = readOnly;
      checkbox.setAttribute("aria-label", `${entry.key} property value`);
      checkbox.addEventListener("change", () => {
        this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, {
          value: checkbox.checked ? "true" : "false"
        }));
      });
      return checkbox;
    }

    if (entry.type === "tags") {
      return this.createTagsControl(view, entry, entryIndex, readOnly);
    }

    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.className = "cm-me-property-input-wrap";
    input.className = "cm-me-property-input";
    input.value = entry.value;
    input.disabled = readOnly;
    input.setAttribute("aria-label", `${entry.key} property value`);

    if (entry.type === "date") {
      input.type = "date";
    } else if (entry.type === "time") {
      input.type = "time";
    } else if (entry.type === "datetime") {
      input.type = "datetime-local";
    } else if (entry.type === "link") {
      input.type = "url";
    } else {
      input.type = "text";
    }

    input.addEventListener("change", () => {
      this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, { value: input.value }));
    });
    this.blurOnEnter(input);
    wrapper.append(input);

    if (entry.type === "date" || entry.type === "time" || entry.type === "datetime") {
      const pickerButton = this.createButton("Pick", `Open ${entry.key} picker`, readOnly, () => {
        const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
        if (typeof pickerInput.showPicker === "function") {
          pickerInput.showPicker();
        } else {
          pickerInput.focus();
        }
      });
      pickerButton.classList.add("cm-me-property-picker");
      wrapper.append(pickerButton);
    }

    return wrapper;
  }

  private createTagsControl(
    view: EditorView,
    entry: FrontmatterEntry,
    entryIndex: number,
    readOnly: boolean
  ): HTMLElement {
    const tags = splitFrontmatterTags(entry.value);
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.className = "cm-me-property-tags";
    wrapper.setAttribute("aria-label", `${entry.key} property value`);

    const commitTags = (nextTags: string[]) => {
      this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, {
        value: nextTags.join(", ")
      }));
    };

    for (const tag of tags) {
      const token = document.createElement("span");
      const label = document.createElement("span");
      const remove = this.createButton("x", `Remove ${tag} tag`, readOnly, () => {
        commitTags(tags.filter((item) => item !== tag));
      });
      token.className = "cm-me-property-tag";
      label.textContent = tag;
      remove.className = "cm-me-property-tag-remove";
      token.append(label, remove);
      wrapper.append(token);
    }

    input.className = "cm-me-property-tag-input";
    input.disabled = readOnly;
    input.type = "text";
    input.placeholder = "Add tag";
    input.setAttribute("aria-label", `${entry.key} tag entry`);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const nextTag = input.value.trim();
        if (nextTag.length > 0) {
          commitTags([...tags, nextTag]);
        }
        return;
      }

      if (event.key === "Backspace" && input.value.length === 0 && tags.length > 0) {
        event.preventDefault();
        commitTags(tags.slice(0, -1));
      }
    });
    input.addEventListener("blur", () => {
      const nextTag = input.value.trim();
      if (nextTag.length > 0) {
        commitTags([...tags, nextTag]);
      }
    });
    wrapper.append(input);
    return wrapper;
  }

  private createButton(label: string, ariaLabel: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", () => {
      onClick();
    });
    return button;
  }

  private blurOnEnter(input: HTMLInputElement): void {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
  }

  private commitRaw(view: EditorView, nextRaw: string): void {
    if (nextRaw === this.raw || view.state.readOnly) {
      return;
    }

    view.dispatch({
      changes: { from: this.from, to: this.to, insert: nextRaw },
      userEvent: "input",
      annotations: allowFrontmatterEdit.of(true)
    });
  }
}

class RenderedMarkdownBlockWidget extends WidgetType {
  private controller?: AbortController;

  constructor(
    private readonly markdown: string,
    private readonly blockId: string,
    private readonly from: number,
    private readonly renderMarkdown?: HybridMarkdownRenderer
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return other instanceof RenderedMarkdownBlockWidget
      && this.markdown === other.markdown
      && this.from === other.from
      && this.renderMarkdown === other.renderMarkdown;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-me-rendered-block";
    wrapper.setAttribute("role", "button");
    wrapper.tabIndex = 0;
    wrapper.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({
        selection: EditorSelection.cursor(this.from)
      });
    });
    wrapper.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      view.dispatch({
        selection: EditorSelection.cursor(this.from)
      });
    });

    if (!this.renderMarkdown) {
      const fallback = document.createElement("pre");
      fallback.textContent = this.markdown;
      wrapper.append(fallback);
      return wrapper;
    }

    const renderMarkdown = this.renderMarkdown;
    const controller = new AbortController();
    this.controller = controller;
    const context: HybridRenderContext = {
      blockId: this.blockId,
      signal: controller.signal
    };
    Promise.resolve()
      .then(() => renderMarkdown(this.markdown, context))
      .then((result: HybridRenderResult) => {
        if (!controller.signal.aborted) {
          wrapper.innerHTML = result.html;
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const fallback = document.createElement("pre");
        fallback.className = "cm-me-rendered-block-error";
        fallback.textContent = error instanceof Error ? error.message : String(error);
        wrapper.replaceChildren(fallback);
      });

    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }

  destroy(): void {
    this.controller?.abort();
    this.controller = undefined;
  }
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
