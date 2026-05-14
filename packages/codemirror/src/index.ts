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
}

function parseFrontmatter(raw: string): FrontmatterEntry[] {
  const entries: FrontmatterEntry[] = [];
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").slice(1, -1);

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    entries.push({ key: match[1], value: match[2] || "" });
  }

  return entries;
}

function updateFrontmatterValue(raw: string, key: string, value: string): string {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");

  for (let index = 1; index < lines.length - 1; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match?.[1] === key) {
      lines[index] = `${key}: ${value}`;
      break;
    }
  }

  return lines.join(newline);
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

    const table = document.createElement("table");
    table.className = "cm-me-properties-table";
    const tbody = document.createElement("tbody");
    const entries = parseFrontmatter(this.raw);

    for (const { key, value } of entries) {
      const row = document.createElement("tr");
      const keyCell = document.createElement("th");
      const valueCell = document.createElement("td");
      const input = document.createElement("input");

      keyCell.textContent = key;
      input.className = "cm-me-property-input";
      input.value = value;
      input.setAttribute("aria-label", `${key} property value`);
      input.addEventListener("change", () => {
        const nextRaw = updateFrontmatterValue(this.raw, key, input.value);
        if (nextRaw === this.raw || view.state.readOnly) {
          return;
        }

        view.dispatch({
          changes: { from: this.from, to: this.to, insert: nextRaw },
          userEvent: "input"
        });
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      valueCell.append(input);
      row.append(keyCell, valueCell);
      tbody.append(row);
    }

    if (entries.length === 0) {
      const row = document.createElement("tr");
      const valueCell = document.createElement("td");
      valueCell.colSpan = 2;
      valueCell.textContent = "No properties";
      row.append(valueCell);
      tbody.append(row);
    }

    table.append(tbody);
    wrapper.append(table);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
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

    const controller = new AbortController();
    this.controller = controller;
    const context: HybridRenderContext = {
      blockId: this.blockId,
      signal: controller.signal
    };
    Promise.resolve(this.renderMarkdown(this.markdown, context))
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
