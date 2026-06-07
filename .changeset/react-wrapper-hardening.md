---
"@echozedlabs/react": patch
---

React wrapper hardening (from the 2026-06-07 React code review):

- **Imperative updates emit `onChange` exactly once.** `setMarkdown`,
  `replaceMarkdown`, and `insertMarkdown` previously double-fired (`setMarkdown`
  routed through CodeMirror's `onChange` *and* the wrapper emitted again, and
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
