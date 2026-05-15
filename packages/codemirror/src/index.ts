import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import {
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
    modeCompartment.of(modePlaceholder(mode ?? "markdown", options)),
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
          widget: new FrontmatterPropertiesWidget(frontmatter.raw, frontmatter.from, frontmatter.to)
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
  type: FrontmatterPropertyType;
}

type FrontmatterPropertyType = "text" | "date" | "time" | "tags" | "boolean";

const frontmatterPropertyTypes: FrontmatterPropertyType[] = ["text", "date", "time", "tags", "boolean"];

const frontmatterTypeLabels: Record<FrontmatterPropertyType, string> = {
  text: "Text",
  date: "Date",
  time: "Time",
  tags: "Tags",
  boolean: "Boolean"
};

const frontmatterTypeIcons: Record<FrontmatterPropertyType, string> = {
  text: "T",
  date: "D",
  time: "H",
  tags: "#",
  boolean: "B"
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

function addFrontmatterEntry(raw: string): string {
  const entries = parseFrontmatter(raw);
  entries.push({
    key: nextFrontmatterKey(entries),
    value: "",
    type: "text"
  });
  return serializeFrontmatter(raw, entries);
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

function inferFrontmatterType(key: string, value: string, fromList: boolean): FrontmatterPropertyType {
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

function coerceFrontmatterValue(value: string, type: FrontmatterPropertyType): string {
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
    private readonly to: number
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-me-properties";
    wrapper.setAttribute("aria-label", "Markdown properties");
    const readOnly = view.state.readOnly;

    const table = document.createElement("table");
    table.className = "cm-me-properties-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const label of ["Order", "Property", "Type", "Value", "Remove"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headerRow.append(cell);
    }
    thead.append(headerRow);
    const tbody = document.createElement("tbody");
    const entries = parseFrontmatter(this.raw);

    entries.forEach((entry, index) => {
      const row = document.createElement("tr");
      const orderCell = document.createElement("td");
      const keyCell = document.createElement("td");
      const typeCell = document.createElement("td");
      const valueCell = document.createElement("td");
      const removeCell = document.createElement("td");
      const keyInput = document.createElement("input");
      const typeIcon = document.createElement("span");
      const typeSelect = document.createElement("select");

      row.dataset.propertyType = entry.type;
      orderCell.className = "cm-me-property-order-cell";
      keyCell.className = "cm-me-property-key-cell";
      typeCell.className = "cm-me-property-type-cell";
      valueCell.className = "cm-me-property-value-cell";
      removeCell.className = "cm-me-property-remove-cell";

      const moveUpButton = this.createButton("Up", `Move ${entry.key} property up`, readOnly || index === 0, () => {
        this.commitRaw(view, moveFrontmatterEntry(this.raw, index, "up"));
      });
      moveUpButton.classList.add("cm-me-property-move-up");

      const moveDownButton = this.createButton(
        "Down",
        `Move ${entry.key} property down`,
        readOnly || index === entries.length - 1,
        () => {
          this.commitRaw(view, moveFrontmatterEntry(this.raw, index, "down"));
        }
      );
      moveDownButton.classList.add("cm-me-property-move-down");
      orderCell.append(moveUpButton, moveDownButton);

      keyInput.className = "cm-me-property-key-input";
      keyInput.value = entry.key;
      keyInput.disabled = readOnly;
      keyInput.setAttribute("aria-label", `Property name for ${entry.key}`);
      keyInput.addEventListener("change", () => {
        this.commitRaw(view, updateFrontmatterEntry(this.raw, index, { key: keyInput.value }));
      });
      this.blurOnEnter(keyInput);
      keyCell.append(keyInput);

      typeIcon.className = "cm-me-property-type-icon";
      typeIcon.textContent = frontmatterTypeIcons[entry.type];
      typeIcon.setAttribute("aria-hidden", "true");
      for (const type of frontmatterPropertyTypes) {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = frontmatterTypeLabels[type];
        typeSelect.append(option);
      }
      typeSelect.className = "cm-me-property-type-select";
      typeSelect.value = entry.type;
      typeSelect.disabled = readOnly;
      typeSelect.setAttribute("aria-label", `${entry.key} property type`);
      typeSelect.addEventListener("change", () => {
        const type = typeSelect.value as FrontmatterPropertyType;
        this.commitRaw(view, updateFrontmatterEntry(this.raw, index, {
          type,
          value: coerceFrontmatterValue(entry.value, type)
        }));
      });
      typeCell.append(typeIcon, typeSelect);

      valueCell.append(this.createValueControl(view, entry, index, readOnly));

      const removeButton = this.createButton("Remove", `Remove ${entry.key} property`, readOnly, () => {
        this.commitRaw(view, removeFrontmatterEntry(this.raw, index));
      });
      removeButton.classList.add("cm-me-property-remove");
      removeCell.append(removeButton);

      row.append(orderCell, keyCell, typeCell, valueCell, removeCell);
      tbody.append(row);
    });

    if (entries.length === 0) {
      const row = document.createElement("tr");
      const valueCell = document.createElement("td");
      valueCell.colSpan = 5;
      valueCell.textContent = "No properties";
      row.append(valueCell);
      tbody.append(row);
    }

    const addButton = this.createButton("Add property", "Add property", readOnly, () => {
      this.commitRaw(view, addFrontmatterEntry(this.raw));
    });
    addButton.classList.add("cm-me-property-add");

    table.append(thead, tbody);
    wrapper.append(table, addButton);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
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

    const input = document.createElement("input");
    input.className = "cm-me-property-input";
    input.value = entry.value;
    input.disabled = readOnly;
    input.setAttribute("aria-label", `${entry.key} property value`);

    if (entry.type === "date") {
      input.type = "date";
    } else if (entry.type === "time") {
      input.type = "time";
    } else {
      input.type = "text";
    }

    input.addEventListener("change", () => {
      this.commitRaw(view, updateFrontmatterEntry(this.raw, entryIndex, { value: input.value }));
    });
    this.blurOnEnter(input);

    return input;
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
      userEvent: "input"
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
