import { describe, expect, it } from "vitest";
import type {
  ChangeMeta,
  MarkdownEditorViewHandle,
  MarkdownEditorViewOptions
} from "../src/index.js";
import { createMarkdownEditorView } from "../src/index.js";

describe("public API types", () => {
  it("allows downstream construction through exported types", () => {
    const parent = document.createElement("section");

    const options: MarkdownEditorViewOptions = {
      parent,
      markdown: "# Draft",
      mode: "markdown",
      readOnly: false,
      onChange(markdown: string, meta: ChangeMeta) {
        markdown.toUpperCase();
        meta.timestamp.toFixed();
      }
    };

    const handle: MarkdownEditorViewHandle = createMarkdownEditorView(options);

    handle.focus();
    handle.setMarkdown("Updated");
    handle.setSelection({ anchor: 0, head: 7 });
    handle.insertMarkdown(" document");
    handle.setReadOnly(true);
    handle.getMarkdown().toUpperCase();
    handle.getSelection().anchor.toFixed();
    handle.destroy();

    expect(parent).toBeInstanceOf(HTMLElement);
  });
});
