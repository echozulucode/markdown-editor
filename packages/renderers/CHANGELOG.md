# @echozedlabs/renderers

## 0.2.0

### Minor Changes

- ab9e58b: Render wiki links in inline content. `renderInline` now turns `[[Target]]` and
  `[[Target|Label]]` into a styled link (`<a class="me-renderer-wiki-link"
data-wiki-target="…">`) instead of leaving the raw brackets as text, so
  preview/rendered surfaces show wiki links the way hybrid mode already does. The
  host can resolve the real destination from `data-wiki-target`. Styling ships in
  `@echozedlabs/react/styles.css`.

### Patch Changes

- ab9e58b: Render inline Markdown in the default preview renderer. Paragraphs, headings,
  list items, table cells, blockquotes, and callouts now render **bold**,
  _italic_, ~~strikethrough~~, `inline code`, links, and inline images instead of
  showing literal Markdown syntax. Links are scheme-checked (dangerous schemes
  like `javascript:` are left as plain text), underscores inside words
  (`snake_case`) stay literal, and output remains HTML-escaped (and is still
  DOMPurify-sanitized downstream). Exposed as a new `renderInline` export.
- ab9e58b: Mermaid: stop the library's built-in "Syntax error in text / mermaid version X"
  graphic from leaking onto the page when a diagram fails to parse.

  `createMermaidRenderer` already caught the render error and emitted a clean
  source fallback plus a diagnostic, but Mermaid v11 _also_ injects its own error
  SVG into the DOM as a side effect. We now initialize Mermaid with
  `suppressErrorRendering: true`, so invalid diagrams surface only through our
  fallback + diagnostics.

  - @echozedlabs/core@0.2.0
