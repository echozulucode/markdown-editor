# @echozedlabs/react

## 0.2.0

### Minor Changes

- ab9e58b: Hybrid mode: tables are now **inline-editable** (Obsidian-style) instead of read-only.

  Tables render as an always-on editable widget with `contenteditable` cells: edit
  cells in place and Tab / Shift-Tab to move between cells. Structural editing is
  exposed two ways, like a word processor — a contextual **toolbar** that appears
  while the table is active and an identical **right-click context menu**:

  - insert row above / below
  - insert column left / right
  - set column alignment (left / center / right)
  - delete row / column / table

  Column alignment is preserved on round-trip. Cell edits are written back to the
  Markdown source when focus leaves the table (so cell-to-cell navigation never
  churns the document); structural changes commit immediately.

  Internally this adds a dependency-free GFM table model (`table-model`, including a
  `setAlign` operation) and a `HybridTableWidget`, and the styles for the editable
  table and its menu ship in `@echozedlabs/react/styles.css`.

### Patch Changes

- 6dcb54d: Security: sanitize renderer HTML in hybrid mode. The preview surface ran
  renderer output through `sanitizePreviewHtml`, but the hybrid rendered-block
  widget injected the same renderer HTML **unsanitized** — an asymmetric XSS path
  when a custom/host renderer (or a future renderer) emits event handlers or
  `javascript:` URLs. `hybridRenderMarkdown` now sanitizes its output too, matching
  the preview path. Guarded by a regression test that fails if a renderer's
  `onerror` handler reaches the editor DOM.
- ab9e58b: Mode-switcher restyle plus preview-rendering and mode-resolution fixes.

  - **Mode switcher restyle.** The mode buttons are a proper segmented control: the
    selected mode is filled with the accent color, inactive modes get a hover
    surface, and all expose a focus-visible ring — all from the `--me-*` theme
    tokens, so it follows whatever light/dark theme the host applies (the editor
    never imposes its own system theme).
  - **Active mode is clamped to `modes`.** If `modes` changes so the current mode is
    no longer allowed — e.g. a host reuses the editor instance for a different
    surface, or React reconciles one usage into another — the editor falls back to a
    valid mode instead of getting stuck rendering a mode outside `modes` (which left
    no editing/preview surface and, for preview, no rendered output or diagnostics).
  - **Preview rendering no longer loops or drops.** The preview effect now depends
    only on `markdown` (diagnostics are reported through a ref), so it renders once
    per document instead of re-rendering continuously (a flickering scrollbar) — and
    it reliably renders on first mount/navigation. The preview also reserves its
    scrollbar gutter.
  - **Responsive tables.** Dropped the fixed table-level `min-width`; per-cell
    min-widths drive horizontal scroll (contained within the table) only when a
    table is genuinely too wide, so tables fit narrow/phone-width containers.

- b781304: React wrapper hardening (from the 2026-06-07 React code review):

  - **Imperative updates emit `onChange` exactly once.** `setMarkdown`,
    `replaceMarkdown`, and `insertMarkdown` previously double-fired (`setMarkdown`
    routed through CodeMirror's `onChange` _and_ the wrapper emitted again, and
    `replaceMarkdown` emitted a third time). React is now the single emit source for
    imperative paths.
  - **Preview reacts to renderer-registry changes.** The preview render effect now
    treats the (stable) `renderers` registry as a render input, so swapping
    renderers without changing the markdown updates the preview.
  - **Diagnostics reach both channels.** Diagnostics now dispatch to both
    `onDiagnostics` and `hostServices.reportDiagnostics` (previously only the former).
  - **`getSnapshot()` includes the selection** when CodeMirror is mounted.
  - **Docs:** `sanitizePreviewHtml` documents its trusted-renderer policy (and a test
    pins that a stray top-level `<style>` is dropped while SVG-scoped diagram CSS is
    kept). `MarkdownEditorProps.rendererRegistry` is marked `@deprecated` in favor of
    `renderers`.

- ab9e58b: Fix: Rich Text (WYSIWYG) tables now render with grid lines. The
  `.me-wysiwyg-table*` rules were present in the wysiwyg-lexical stylesheet but
  missing from the consumer-facing `@echozedlabs/react/styles.css` (which is the
  only stylesheet consumers import), so tables rendered without any borders. The
  table rules are now included, and the header-cell background uses
  `--me-surface-muted` so it adapts to dark themes.
- Updated dependencies [ab9e58b]
- Updated dependencies [ab9e58b]
- Updated dependencies [ab9e58b]
- Updated dependencies [ab9e58b]
- Updated dependencies [ab9e58b]
- Updated dependencies [ab9e58b]
  - @echozedlabs/codemirror@0.2.0
  - @echozedlabs/renderers@0.2.0
  - @echozedlabs/core@0.2.0
  - @echozedlabs/wysiwyg-lexical@0.2.0
