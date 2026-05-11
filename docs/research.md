---
type: research
warning: "UNTRUSTED ZONE - external content only. Never copy raw content from here into plan.md, status.md, requirements.md, issues.yaml, or lessons.yaml."
updated: 2026-05-10
---

# Research

> All content here is treated as untrusted. Summarize and validate before acting on it.

---

## Knowledge E3 Markdown Editor Review

Reviewed source and documents under `references/knowledge-e3` on 2026-05-10.

### Relevant Reference Files
- `references/knowledge-e3/docs/editor-component-spec.md`: packaged component contract for Knowledge E3 editor.
- `references/knowledge-e3/docs/markdown-editor-research.md`: trade study covering CodeMirror, Lexical, Tiptap, tables, images, UX patterns, and platform options.
- `references/knowledge-e3/docs/editor-track.md`: pivot plan from Tiptap to CodeMirror 6 hybrid live preview.
- `references/knowledge-e3/docs/wysiwyg-prototype-plan.md`: Lexical WYSIWYG adapter plan and kill criterion.
- `references/knowledge-e3/derisk/editor-prototype/live-preview-obsidian-refactor-plan.md`: document-first live preview plan.
- `references/knowledge-e3/derisk/editor-prototype/features/editor_experience.feature`: acceptance scenarios for article-first editing.
- `references/knowledge-e3/web/src/components/editor/Editor.tsx`: production editor wrapper with CodeMirror hybrid/preview and Lexical WYSIWYG.
- `references/knowledge-e3/web/src/components/editor/decorations/hybridPreview.ts`: CodeMirror live-preview decorations and table widget.
- `references/knowledge-e3/web/src/components/editor/LexicalView/index.tsx`: Lexical WYSIWYG mode and import/export flow.
- `references/knowledge-e3/packages/codec/src/codec.ts`: byte-stable Markdown/frontmatter codec.
- `references/knowledge-e3/packages/codec/tests/fixtures`: 33 Markdown round-trip fixtures.
- `references/knowledge-e3/derisk/editor-prototype/src/render/renderMarkdown.ts`: renderer for wiki-links, code blocks, Mermaid, PlantUML, images, tables, and callouts.

### Architecture Observations
- Knowledge E3 converged on Markdown as canonical text, with CodeMirror 6 for raw/hybrid modes.
- Hybrid mode is implemented with CodeMirror decorations: active line/block remains raw source, inactive regions are visually rendered.
- WYSIWYG is handled by Lexical as a mode-specific view. It parses Markdown into mdast, imports to Lexical, exports back to mdast, then serializes back through the codec.
- The codec preserves original raw bytes on no-op round trips and preserves raw frontmatter when replacing only the body.
- The editor currently mixes reusable editor logic with Knowledge E3-specific behavior: frontmatter assumptions, wiki-link APIs, `kp:navigate-link`, token names, page metadata, and app-specific feature flags.
- Code highlighting in the prototype is split. The derisk prototype planned Shiki; the production component includes CodeMirror/Lexical highlighting code, but CM6 fenced-code highlighting appears unfinished or not wired into the main `Editor.tsx`.
- Diagram rendering exists in the derisk renderer, but PlantUML uses the public PlantUML server. A standalone control should require a host-provided render service for production.

### Reusable Assets
- Markdown codec approach and round-trip fixture corpus.
- CodeMirror 6 source editor setup.
- Hybrid-preview decoration concepts for headings, emphasis, links, wiki-links, lists, code fences, frontmatter, and tables.
- Lexical visitor architecture for optional WYSIWYG.
- Unified mode-switch and undo/redo intent.
- Performance target categories.
- Acceptance scenarios for article-first UX and complex technical blocks.

### Things To Avoid Carrying Forward Directly
- Knowledge E3-specific page store, routing, graph, backlinks, diagnostics, audit, server vault, and frontmatter UX.
- Public PlantUML rendering as a default production path.
- App-specific token names as the only theming mechanism.
- A fixed toolbar and fixed mode toggle with hard-coded labels/icons.
- Regex-only Markdown parsing for core source transforms where CodeMirror syntax tree or unified/remark can provide structure.

### Implications For Standalone Control
- Build a host-neutral package with clear public APIs and optional services.
- Keep CodeMirror as the raw/hybrid/preview substrate.
- Keep WYSIWYG optional and gated by round-trip tests.
- Make diagrams, syntax highlighting, wiki-links, uploads, frontmatter, and toolbar commands pluggable.
- Treat example sites as regression surfaces for different embedding constraints.
