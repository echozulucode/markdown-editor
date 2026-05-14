---
type: status
updated: 2026-05-14
current_phase: "Phase 3 - Core Editor Implementation"
blockers: []
next_actions:
  - "Expand WYSIWYG adapter coverage for tables, images, PlantUML, and documented normalizations"
  - "Start the example gallery once WYSIWYG has a package boundary or explicit placeholder decision"
  - "Design post-MVP Obsidian-style properties editing with reorder, add/remove, and typed editors"
---

# Status Log

## Session: 2026-05-10
**Phase:** 1-2 - Reference Extraction and Package Architecture
**Actions taken:**
- Initialized project docs
- Reviewed Knowledge E3 editor documents, source, codec, fixtures, and derisk prototype
- Captured reference findings in `docs/research.md`
- Drafted high-level standalone editor plan in `docs/plan.md`
- Added detailed MVP implementation plan in `docs/mvp-implementation-plan.md`

**Outcome:** Ready to begin Phase 0/1: API design, workspace scaffold, codec extraction, and test matrix

---

## Session: 2026-05-11
**Phase:** 0-1 - Kickoff, Architecture Freeze, and Foundation
**Actions taken:**
- Created monorepo workspace with pnpm, TypeScript, Vitest, and package build scripts.
- Added `@markdown-editor/core` with public API types, Markdown parsing/serialization helpers, frontmatter-preserving body replacement, and 33 Markdown fixtures copied from Knowledge E3.
- Added `@markdown-editor/codemirror` skeleton with `createMarkdownEditorView`, markdown-mode lifecycle API, read-only controls, selection APIs, and public typecheck test.
- Added `@markdown-editor/renderers` skeleton with renderer registry, fallback block renderers, async diagram/code renderer contracts, and renderer failure tests.
- Added `examples/dev-harness` Vite React placeholder app for future QA surfaces.
- Added `docs/api-design.md` and `docs/test-matrix.md`.
- Integrated packages into the pnpm workspace and aligned CodeMirror with core public types.

**Verification:**
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.

**Outcome:** Phase 0 is effectively complete and Phase 1 foundation is in place. Next implementation should create `packages/react` and replace the harness placeholder with the public component.

**Carry-forward notes:**
- Dev harness was started at `http://127.0.0.1:5174/` because port `5173` was already occupied.
- Keep using pnpm from the workspace root; npm-generated package lockfiles were removed during integration.
- `docs/test-matrix.md` is now the working QA gate list for future phases.

---

## Session: 2026-05-12
**Phase:** 3 - Core Editor Implementation
**Actions taken:**
- Added `@markdown-editor/react` package with the public `MarkdownEditor` component shell, CSS token defaults, mode switcher, CodeMirror-backed markdown/hybrid/preview mounting, WYSIWYG placeholder, and imperative handle.
- Added React package typecheck/public API test.
- Wired `examples/dev-harness` to import `MarkdownEditor` and `@markdown-editor/react/styles.css` through public package exports.
- Updated dev harness mode matrix to exercise hybrid-only, markdown+preview, WYSIWYG-only placeholder, all modes, and read-only preview configurations.
- Expanded core public types with `initialMode`, `renderers`, text selection, diagnostics, host services, feature flags, and theme token shapes needed by the React shell.
- Removed generated JS/declaration artifacts from `packages/core/src`.
- Consolidated `@markdown-editor/renderers` diagnostics/render result contracts onto `@markdown-editor/core` types.

**Verification:**
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.
- Dev harness started at `http://127.0.0.1:5175/` and returned HTTP 200.

**Outcome:** Public React shell and harness wiring are in place. The next useful product step is real preview rendering, followed by markdown-mode behavior tests.

**Carry-forward notes:**
- Harness build reports a large JS chunk after CodeMirror enters the public route. Track this for code-splitting/manual chunking before the example gallery expands.
- `hybrid` and `preview` currently use the CodeMirror substrate without rendered decorations; they are mode-contract placeholders until Phase 4 work.

---

## Session: 2026-05-13
**Phase:** 3 - Core Editor Implementation
**Actions taken:**
- Wired `@markdown-editor/react` preview mode to `@markdown-editor/renderers` through `renderMarkdownToHtml`, with async cancellation, diagnostics forwarding, and fallback error rendering.
- Added preview-surface CSS for prose, tables, code blocks, callouts, and renderer error panels.
- Added jsdom-backed behavior tests for `@markdown-editor/codemirror` markdown mode covering construction, edits, change events, selection clamping, and destroyed-handle behavior.
- Converted the CodeMirror public API test into an executable Vitest suite while keeping the type contract assertions.
- Split the dev harness production bundle into React, CodeMirror, and Lezer chunks.
- Exported `RenderMarkdownToHtmlResult` from `@markdown-editor/renderers` and kept renderer result typing aligned with `@markdown-editor/core`.
- Added an opt-in Shiki code renderer factory with broad bundled-language support, safe plaintext fallback for unknown languages, and renderer-registry tests.
- Added a `/renderers` dev-harness route that uses public package APIs to exercise Shiki-highlighted code, unknown-language fallback diagnostics, Mermaid fallback, PlantUML fallback, tables, images, and callouts.
- Reworked the Shiki renderer factory from the full Shiki bundle to fine-grained core loading for the MVP language set so the harness build stays below Vite chunk-warning thresholds.

**Verification:**
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed with no Vite chunk warnings.
- Dev harness at `http://127.0.0.1:5175/renderers` returned HTTP 200.

**Outcome:** Preview mode now uses the shared renderer pipeline instead of a CodeMirror placeholder, CodeMirror behavior has real DOM test coverage, syntax highlighting has an opt-in Shiki implementation with a real fixture route, and the harness build has a cleaner chunk baseline for the coming gallery work.

**Carry-forward notes:**
- `hybrid` mode still needs CodeMirror syntax-tree decorations, active-range reveal, and rendered inactive blocks.
- Shiki is implemented as an opt-in fine-grained renderer factory; expanding supported languages should be deliberate because each language adds an async chunk.
- Mermaid and PlantUML integrations are still renderer-interface work, not complete feature implementations.
- WYSIWYG remains a placeholder until the optional Lexical package is added.

---

## Session: 2026-05-14
**Phase:** 3 - Core Editor Implementation
**Actions taken:**
- Added an exported `createPlantUmlRenderer` factory in `@markdown-editor/renderers`.
- Routed object-form PlantUML host services through the same timeout, abort, diagnostics, and source-fallback behavior.
- Added PlantUML renderer tests for host-rendered success and timeout fallback.
- Updated the dev harness renderer registry to use a local host-provided PlantUML demo renderer instead of showing only missing-renderer fallback.
- Extended hybrid mode to render inactive tables, images, and callouts through the shared Markdown renderer.
- Added source-edit affordances for the new rendered hybrid blocks by clicking the rendered block or arrowing into it.
- Added inactive inline link and wiki-link rendering with click-to-source behavior.
- Fixed hybrid active-block detection so selected multi-line blocks are skipped as a whole before line decorations are considered.
- Added regression coverage for adjacent code and Mermaid fences so a closing fence cannot be misread as a new opening fence.
- Adjusted `ArrowUp` into rendered blocks to land at the end of the source block, avoiding the feeling that keyboard navigation skipped the block's inner lines.
- Replaced block-boundary arrow handling with logical source-line movement in hybrid mode so arrow keys visit each Markdown row predictably while still revealing rendered blocks as source.
- Updated read-only preview rendering to convert leading YAML frontmatter into a read-only properties table instead of exposing raw YAML.
- Added `@markdown-editor/wysiwyg-lexical` as the first optional Lexical-backed WYSIWYG package.
- Wired React WYSIWYG mode to lazy-load the Lexical adapter instead of showing the raw Markdown placeholder.
- Added headless WYSIWYG import/export tests for frontmatter preservation and common prose constructs.
- Adjusted dev-harness manual chunks so Lexical stays in its own optional chunk and does not bloat the main React chunk.
- Removed the WYSIWYG adapter's runtime dependency on the core parser to avoid pulling `gray-matter` into browser builds.
- Added an initial WYSIWYG toolbar with paragraph, heading, bold, italic, inline code, list, quote, code-block, and Mermaid insertion controls.
- Added WYSIWYG code-block insertion with a language selector and a Markdown-backed export path.
- Added WYSIWYG Mermaid diagram nodes that render visually by default while exposing an edit/apply source workflow for diagram text.
- Added WYSIWYG Mermaid round-trip coverage so rendered diagram nodes continue exporting fenced Mermaid Markdown.
- Reworked the WYSIWYG toolbar away from one-off Mermaid insertion controls toward a scalable block-style selector plus generic insert menu.
- Added selection-aware WYSIWYG toolbar state so the current paragraph/heading/list/quote/code style and inline bold/italic/code states reflect the active selection.
- Moved WYSIWYG code-block language selection out of the global toolbar and onto the active code block surface.
- Enabled Lexical Prism highlighting for WYSIWYG code blocks with supported language selections.
- Added WYSIWYG checkbox-list insertion, Obsidian-style checkbox rendering, and click-to-toggle behavior through Lexical checklist support.
- Added WYSIWYG checkbox-list round-trip coverage.
- Captured the future requirement for an Obsidian-style properties panel in `docs/requirements.md`.
- Updated the MVP implementation plan to keep current properties editing scoped to simple scalar rows and defer advanced typed property editing.
- Updated the main plan decision log with the rationale for treating advanced properties as deliberate post-MVP UX/API work and for keeping PlantUML behind a host-renderer boundary.

**Verification:**
- `pnpm --filter @markdown-editor/renderers typecheck` passed.
- `pnpm --filter @markdown-editor/renderers test` passed.
- `pnpm --filter @markdown-editor/dev-harness typecheck` passed.
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.
- Dev harness at `http://127.0.0.1:5175/modes` returned HTTP 200.

**Outcome:** The advanced properties direction is documented without expanding the current MVP implementation scope. PlantUML now has a production-shaped host-renderer integration path with local fixture coverage. Hybrid mode now covers the initial MVP block-widget set. WYSIWYG now has a real lazy-loaded Lexical package boundary, a selection-aware editing toolbar, scalable block insertion, block-level code language controls with syntax highlighting, checkbox lists, and rendered source-backed Mermaid diagrams, but still needs broader technical-block coverage before it can be considered MVP-complete.

**Carry-forward notes:**
- Hybrid and diagram basics should now be treated as initial MVP-complete; remaining work is WYSIWYG hardening, examples, Playwright coverage, and release hardening.
- Current WYSIWYG coverage is intentionally narrow: headings, prose, inline formatting, links, ordered/bulleted/checkbox lists, blockquotes, highlighted fenced code, rendered Mermaid diagrams, and frontmatter envelope preservation.
- Future properties work should support reorder, add/remove, date/time/tag/boolean/link-aware editors, and host-defined property schemas.

---
