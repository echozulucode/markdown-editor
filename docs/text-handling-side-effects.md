# Text-handling & mode-interface side-effects

**Date:** 2026-05-30
**Why:** Two reported issues — (1) backspace/delete corrupting YAML frontmatter in hybrid mode, (2) a checkbox in rich-text (WYSIWYG) mode producing "weird blank lines" — prompted a review of where text edits and mode switches can have surprising side-effects, plus regression tests around them.

## How edits flow (the surfaces that can have side-effects)

- **Codec (`core`)** owns canonical bytes; a body edit must never rewrite frontmatter bytes (`replaceBody` keeps `rawFrontmatter` verbatim).
- **CodeMirror (`codemirror`)** renders source/hybrid. In hybrid with hidden/collapsed/table frontmatter, the YAML envelope is **non-editable** and protected by a `transactionFilter` + a `beforeinput`/keymap guard (`preventHiddenFrontmatterDelete`). The active mode is now reconfigured in place (`setMode`) rather than recreated.
- **Lexical (`wysiwyg-lexical`)** imports the Markdown **body** into a rich-text state and exports it back through `WYSIWYG_TRANSFORMERS`. Round-trip fidelity depends entirely on those transformers.
- **React (`react`)** selects the mode, owns/forwards the Markdown value, and routes shortcuts.

## Potential side-effects (and current status)

### A. Hybrid mode — hidden YAML frontmatter (reported issue #1)
| # | Side-effect | Status | Test |
|---|---|---|---|
| A1 | Backspace at the first body position deletes into the frontmatter fence | **Guarded** | `codemirror` "prevents destructive keyboard and beforeinput …" |
| A2 | A range delete that crosses the frontmatter↔body boundary corrupts YAML | **Guarded + tested** | "a range delete that crosses the frontmatter boundary is filtered" |
| A3 | Select-all → delete wipes the hidden frontmatter | **Guarded + tested** | "select-all delete cannot wipe hidden frontmatter" |
| A4 | Over-protection blocks legitimate body edits near the boundary | **Verified not over-protected** | "a body-only edit is NOT over-protected" |
| A5 | `source` frontmatter mode wrongly blocks editing the visible YAML | **Verified editable** | "hybrid source mode: frontmatter IS editable" |
| A6 | Switching modes loses protection state (protect in markdown, or fail to protect in hybrid) | **Tested across `setMode`** | "frontmatter protection follows setMode" |
| A7 | Mode switch destroys selection/scroll/undo | **Fixed (in-place `setMode`)** | "setMode switches markdown<->hybrid in place, preserving selection and document" |

### B. Rich-text (WYSIWYG) — lists/checkboxes (reported issue #2)
| # | Side-effect | Status | Test |
|---|---|---|---|
| B1 | A homogeneous checklist gains blank lines between items on round-trip | **Verified clean** | `wysiwyg` list-side-effects "homogeneous checklist round-trips with NO inserted blank lines" |
| B2 | **A checkbox item adjacent to a plain bullet splits into two lists with a blank line** | **Fixed** (serialization merges adjacent unordered lists) | "does NOT insert a blank line when a checkbox item is followed by a plain bullet (B2 fix)" |
| B3 | Nested list at 2-space indent is flattened on round-trip | **Limitation, pinned** (Lexical needs 4-space/tab; 4-space/tab works) | "preserves nested lists at 4-space / tab indentation" + pinned "2-space …flattened" |
| B4 | Empty checklist items are dropped | **Verified preserved** | "preserves empty checklist items" |
| B5 | Checklist adjacent to a paragraph doubles blank lines | **Verified clean** | "keeps a checklist adjacent to a paragraph without doubling blank lines" |
| B6 | Checked/unchecked state lost | **Verified preserved** | "preserves checked vs unchecked state" |

**B2 was the source of the reported "weird blank lines"** and is now **fixed**: mixing a checkbox item with a normal bullet (which GFM treats as one list) yielded two Lexical lists separated by a blank line. A transformer can't change Lexical's block-join behavior, so the fix is a serialization step (`mergeAdjacentUnorderedLists`) applied to every export path that drops the blank line between adjacent unordered (bullet/check) list items — fenced code is skipped so a code line that looks like a list item is never touched. Same-type lists were already merged by Lexical; this only affects the check↔bullet boundary.

### D. Renderer output (diagrams)
| # | Side-effect | Status | Test |
|---|---|---|---|
| D1 | Mermaid diagram text invisible in **preview** (sanitizer strips `<foreignObject>` HTML labels) | **Fixed** — Mermaid `htmlLabels:false` (top-level) emits SVG `<text>` that survives sanitization | e2e `mermaid-rendering.spec.ts` (preview + hybrid show label text) |
| D2 | Small **PlantUML** diagram renders huge on wide screens (host SVG has only a `viewBox`) | **Fixed** — the PlantUML renderer caps a viewBox-only SVG at its intrinsic width (`max-width:<W>px`), responsive down | unit `constrainDiagramSvgWidth`; e2e `diagram-sizing.spec.ts` |

Notes: the preview pipeline sanitizes renderer HTML with DOMPurify, which **categorically strips HTML inside SVG `<foreignObject>`** (verified across 6 configs in a real browser) — so diagram labels must be SVG `<text>`, not foreignObject. Mermaid v11 only honors the **top-level** `htmlLabels` flag for flowcharts (`flowchart.htmlLabels` alone is not enough). For arbitrary host diagrams, prefer SVGs that declare a `width`/`height` or a `max-width`; the PlantUML renderer adds an intrinsic-width cap for SVGs that don't.

### C. Mode-switch content fidelity (cross-cutting)
- WYSIWYG import/export is lossy for **callouts** (`> [!note]` → plain quote), **inline/raw HTML**, **nested lists** (B3), and **table cell inline formatting/alignment** (see `docs/repo-review-2026-05-30.md` §3 P1-5). These are documented limitations; round-trip behavior is partially pinned by `roundtrip.test.ts`.
- `markdown`↔`hybrid` preserves selection/scroll/undo via the in-place `setMode` reconfigure (A7).

## Tests added in this pass
- `codemirror/test/markdown-editor-view.test.ts` — A2–A6 frontmatter delete-protection edge cases + the A7 in-place mode-switch test.
- `wysiwyg-lexical/test/list-side-effects.test.ts` — B1–B6 checklist/list round-trip guards and pinned limitations.

## Recommended follow-ups
1. **B2 — done** (serialization merge of adjacent unordered lists). **B3** — Lexical needs 4-space/tab for nesting; a future enhancement could normalize 2-space input indentation to 4-space before import so shallow nesting survives.
2. **C** — callout + raw-HTML transformers (P1-5 in the main review).
3. Promote the input-rule typing path (`# `, `- `, `[ ] `, `**`) to component/e2e tests so the *interactive* creation of these structures — not just round-trip — is covered.
