---
type: plan
project: "markdown-editor"
status: active
version: 1
updated: 2026-05-11
phases:
  - id: 1
    name: "Reference Extraction & Product Contract"
    status: completed
  - id: 2
    name: "Standalone Package Architecture"
    status: completed
  - id: 3
    name: "Core Editor Implementation"
    status: in_progress
  - id: 4
    name: "Example Sites & Integration Gallery"
    status: pending
  - id: 5
    name: "Hardening, Docs, and Release"
    status: pending
current_phase: 3
---

# Plan: Standalone Markdown Editor Control

## Goal
Build an independent, embeddable React/TypeScript Markdown editor control that can be used in multiple applications with any combination of raw Markdown, hybrid live preview, WYSIWYG, and read-only preview modes. Markdown remains the canonical source, and the control must scale from compact mobile embeds to full-page technical-document editing.

## Reference Findings
- The strongest foundation from `references/knowledge-e3` is the CodeMirror 6 hybrid/source editor plus the byte-stable Markdown codec and fixture corpus.
- The WYSIWYG path is useful but should remain a mode adapter, not the canonical state model. Knowledge E3 used Lexical for WYSIWYG while preserving Markdown as the source.
- The standalone control should avoid Knowledge E3 page-store, routing, auth, graph, backlinks, audit, server, and app-shell concerns.
- The current Knowledge E3 implementation is application-shaped. The new package needs a cleaner public API, mode configuration, extension registry, theming contract, and optional feature modules.

## Product Principles
- Markdown text is the single source of truth.
- Modes are explicit and host-configurable: `markdown`, `hybrid`, `preview`, `wysiwyg`.
- The host owns persistence, routing, page metadata, uploads, telemetry transport, and app chrome.
- The editor owns editing state, keyboard behavior, rendering widgets, syntax highlighting, mode switching, selection restoration, and accessibility inside the editor surface.
- Complex blocks render by default but always expose a source-edit escape hatch.
- Small-screen behavior is first-class, not a later CSS pass.

## Target Package Shape
- `@markdown-editor/core`: Markdown codec, document model, parser helpers, mode state, extension contracts.
- `@markdown-editor/react`: React editor component, mode switcher, toolbar slots, hooks, and imperative handle.
- `@markdown-editor/codemirror`: raw Markdown and hybrid live-preview engine.
- `@markdown-editor/wysiwyg-lexical`: optional WYSIWYG adapter loaded only when enabled.
- `@markdown-editor/renderers`: Shiki code highlighting, Mermaid renderer, PlantUML renderer interface, image/table/callout renderers.
- `@markdown-editor/examples`: example sites and host shells.

## Public Component Contract
- `value: string`: full Markdown or body Markdown, based on `documentMode`.
- `onChange(markdown: string, meta: ChangeMeta): void`.
- `modes: EditorMode[]`: allowed modes per host, for example `['hybrid']`, `['markdown', 'preview']`, `['wysiwyg']`, or all modes.
- `initialMode?: EditorMode`.
- `readOnly?: boolean`.
- `extensions?: MarkdownEditorExtension[]`.
- `renderers?: RendererRegistry`.
- `theme?: 'light' | 'dark' | 'system' | ThemeTokens`.
- `features?: FeatureFlags`: diagrams, syntaxHighlighting, tables, images, slashMenu, wikiLinks, frontmatter, toolbar, minimap.
- `hostServices?: HostServices`: upload, link lookup, PlantUML render endpoint, telemetry sink, asset resolver.
- `onModeChange`, `onSaveShortcut`, `onCancelShortcut`, `onNavigateLink`, `onDiagnostics`.
- Imperative handle: `focus`, `getMarkdown`, `setMarkdown`, `getMode`, `setMode`, `getSelection`, `setSelection`, `insertMarkdown`, `clearHistory`.

## Phase 1: Reference Extraction & Product Contract
- [x] Review Knowledge E3 editor specs, plans, tests, and source.
- [x] Identify reusable code paths and app-specific code to avoid carrying forward.
- [x] Define standalone package boundaries and public component contract.
- [x] Convert this plan into an implementation-ready technical design with file layout and API types.

## Phase 2: Standalone Package Architecture
- [x] Initialize package workspace, build system, lint/typecheck/test stack, and visual harness placeholder.
- [x] Extract and adapt the Markdown codec plus fixture corpus.
- [x] Define extension interfaces for block renderers, commands, completion sources, and host services.
- [ ] Build design-token CSS contract and responsive layout primitives in `packages/react`.
- [x] Decide PlantUML strategy: default to host/server renderer, with public PlantUML server only as an explicit demo fallback.

## Phase 3: Core Editor Implementation
- [x] Build CodeMirror 6 raw Markdown mode foundation with search, line wrapping, read-only control, and selection APIs.
- [ ] Create `@markdown-editor/react` public component shell and imperative handle.
- [ ] Wire `examples/dev-harness` to consume public package APIs instead of placeholders.
- [ ] Build hybrid mode on the same CodeMirror state using syntax-tree/decorations, active-range reveal, and rendered inactive blocks.
- [ ] Build preview/read-only mode with the same renderer pipeline and no editing chrome.
- [ ] Port WYSIWYG as an optional Lexical adapter with strict Markdown import/export gates.
- [ ] Integrate Shiki for broad language syntax highlighting with lazy-loaded grammars/themes.
- [ ] Integrate Mermaid rendering with async execution, timeout, error panels, and no page crashes.
- [ ] Integrate PlantUML through a renderer interface so hosts can provide a secure server endpoint.
- [ ] Build table, image, code block, callout, link, wiki-link, and diagram widgets with source-edit affordances.

## Phase 4: Example Sites & Integration Gallery
- [ ] Full-page docs editor using all modes.
- [ ] Markdown plus preview split or toggle workflow.
- [ ] Hybrid-only knowledge-base editor.
- [ ] WYSIWYG-only nontechnical contributor editor.
- [ ] Read-only published documentation site.
- [ ] Compact comment composer.
- [ ] Side-pane review editor.
- [ ] Modal quick-edit editor.
- [ ] Technical runbook editor with diagrams and code-heavy samples.
- [ ] Mobile-first note editor.
- [ ] AI prompt composer using Markdown and page mentions.
- [ ] Conflict/diff resolver embedding multiple editor instances.

## Phase 5: Hardening, Docs, and Release
- [ ] Round-trip fixture suite covering GFM, frontmatter, tables, callouts, inline HTML, wiki-links, diagrams, very long lines, and mixed line endings.
- [ ] WYSIWYG semantic and byte-stability gates with documented accepted normalizations.
- [ ] Playwright coverage across desktop, tablet, and phone viewports.
- [ ] Accessibility audit for keyboard navigation, screen reader semantics, focus restoration, contrast, and reduced motion.
- [ ] Performance gates for mount, typing latency, mode switch, autocomplete, diagram rendering, and very large documents.
- [ ] Security review for Markdown HTML, links, image URLs, Mermaid, PlantUML, and plugin APIs.
- [ ] Publish package docs, host integration recipes, migration guide from Knowledge E3, and example-site source links.

## Key Risks
- WYSIWYG mode can normalize Markdown in ways source-first users will reject.
- Hybrid rendering can produce cursor, selection, and layout-jump defects if decorations are too coarse.
- Diagram rendering can become a security and performance problem unless sandboxed and async.
- Broad syntax highlighting can bloat bundles unless grammars are lazy-loaded.
- A fixed toolbar or fixed frontmatter behavior will make the control less reusable.

## Decisions Made
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-10 | Use Markdown text as canonical state. | The reference codec and CodeMirror approach preserve source fidelity and reduce round-trip drift. |
| 2026-05-10 | Treat WYSIWYG as an optional adapter. | Useful for nontechnical hosts, but it should not own persistence or become the primary document model. |
| 2026-05-10 | Build example sites as product-grade host shells, not demos with placeholder chrome. | Reusability has to be proven across real layout constraints and mode combinations. |
| 2026-05-11 | Use pnpm as the only workspace package manager. | Mixed npm/pnpm artifacts created package-lock files and local node_modules drift during parallel work. |

## Errors Encountered
| Date | Error | Resolution |
|------|-------|------------|
| 2026-05-11 | Port `5173` was occupied when starting the dev harness. | Vite selected `5174`; use the reported URL for the current running harness. |
| 2026-05-11 | Subagents using npm created package-lock files inside a pnpm workspace. | Removed npm lockfiles and normalized packages under the root pnpm workspace. |

