---
type: status
updated: 2026-06-07
current_phase: "Published to npm as @echozedlabs/*; BDD living docs + demo polish done; 0.2.0 release pending"
blockers: []
next_actions:
  - "Publish @echozedlabs/* 0.2.0 (bundles the pending changesets) via OIDC trusted publishing — user owns releases"
  - "After publish, bump knowledge-e3 + echozed-demo deps to ^0.2.0"
  - "Bind remaining interaction features as executable BDD (switching_editor_modes, document_properties, host_integration_services, rich_text_editing, editor_accessibility) and add chromium-mobile to the BDD project list"
  - "Investigate the controlled-editor blank-line churn (ISSUE-008)"
  - "Optional: add CODE_OF_CONDUCT.md + issue/PR templates to the open-source repo"
---

# Status Log

## Session: 2026-06-04 → 2026-06-07  Packaging, BDD living docs, demo polish, and bug-fix chain
**Phase:** Open-source publishing + post-MVP stabilization

Consolidated entry for a continuous multi-day batch (the editor was renamed and published to npm during it).

**Packaging & rename:**
- Renamed all packages `@markdown-editor/*` → `@echozedlabs/*` (npm org `echozedlabs`, brand echozed.com, MIT) and published `core`, `react`, `codemirror`, `renderers`, `wysiwyg-lexical` to npm.
- Set up Changesets (fixed versioning) + OIDC trusted publishing; switched knowledge-e3 to consume `@echozedlabs/react` / `@echozedlabs/wysiwyg-lexical` `^0.1.0` from npm; removed the workspace glob and the obsolete GitHub Actions checkout/token for the private editor repo.
- Built a standalone `echozed-demo` (Vite+React) consuming the published packages; wrote a brand blog post + PUBLISHING.md runbook.

**Editable tables (Obsidian-style, hybrid):**
- Added a dependency-free GFM `table-model` and a `HybridTableWidget`: contenteditable cells, Tab/Shift-Tab nav, commit-on-leave, alignment preserved.
- Replaced the simple toolbar with Word/Excel-style **icon toolbar + right-click context menu** (insert row above/below, insert col left/right, align L/C/R, delete row/col/table), plus a `setAlign` model op.

**BDD living documentation + CI gate (the /bdd-gherkin-feature-author work):**
- Authored 10 declarative Gherkin feature files in `features/` + interaction-contract YAML + README; tagged 0.1.0 baseline vs 0.2.0 additions.
- Built `features/coverage.yaml` (scenario→test manifest, 51 scenarios) and `docs/bdd-coverage-and-test-plan.md` (coverage report + 4-phase plan). Closed all gaps → **51/51 covered**.
- Made feature files executable with `playwright-bdd` (config + `bdd-steps/`): `inline_table_editing` and `diagram_rendering` run on chromium-desktop (`@performance` excluded, unit-covered).
- Added CI: `scripts/check-feature-coverage.mjs` (coverage gate) + `scripts/lint-feature-intent.mjs` (no units/selectors/HTML in scenarios) wired into `.github/workflows/ci.yml` (`pnpm verify:features`) plus a `bdd` job. Both gates proven to fail on drift.

**Demo polish + bug-fix chain (all verified live via Playwright, several via screenshot inspection):**
- Fixed real product bugs (see issues.yaml): Mermaid error-graphic leak (`suppressErrorRendering`), `isTableSeparator` dropping center-aligned/single-column tables, host-CSS bleed into the editor, preview infinite re-render loop, preview blank-on-navigation (`activeMode` not clamped to `modes`).
- Rendered wiki links in preview (`renderInline`), date property is an icon (only when native `showPicker` absent), preview table gridlines, responsive phone tables (dropped table `min-width`).
- Restyled the mode switcher (token-based segmented control); added a harness page-theme toggle (Light/Dark/Auto) after reverting an incorrect editor-level `prefers-color-scheme` dark mode — the editor follows the **page**, not the OS.
- Built real content for the Responsive / Accessibility / Performance harness routes (were placeholders).

**Verification:** unit suites green (core, codemirror 39, renderers 23, react 15, wysiwyg-lexical); typecheck/build clean; targeted Playwright + full hand-written e2e on chromium-desktop green; BDD pilot 14/14; `pnpm verify:features` green (51/51).

**Outcome:** Editor is published and consumable from npm, has executable living documentation with a CI coverage gate, and the demo is materially more polished with several latent bugs fixed.

**Carry-forward notes:**
- Pending changesets bundle into **0.2.0** (user handles the release); fixes reach knowledge-e3/echozed-demo only after that publish.
- Several fixes were latent bugs that an old preview **re-render loop masked**; removing the loop exposed them.
- Controlled editors (`value`+`onChange`) accumulate blank lines on repeated structural commits — open follow-up (ISSUE-008).
- The harness's broad element selectors must stay scoped (`>`/header/footer) so they never style embedded `.me-editor` internals.

## Session: 2026-05-15 WYSIWYG Runtime Error Fix
**Phase:** Post-MVP stabilization

**Actions taken:**
- Fixed a Lexical runtime error in the WYSIWYG code-language popover by ensuring selection reads triggered by resize, scroll, and selection-change paths run inside an editor state read scope.
- Added Playwright regression coverage that switches an example to WYSIWYG, activates the code-language popover, resizes/scrolls the editor, and asserts the active-editor-state runtime error does not occur.
- Changed WYSIWYG Mermaid render failures to show a concise editor-owned message and report diagnostics instead of exposing raw Mermaid version/error text directly in the block.

**Verification:**
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.
- `pnpm --filter @markdown-editor/dev-harness test:e2e` passed with 64 Playwright checks across desktop and mobile Chromium.

**Outcome:** The reported WYSIWYG runtime error is fixed and covered by browser regression tests.

**Carry-forward notes:**
- Mermaid syntax errors are still expected for invalid diagram source, but they now render as isolated diagram errors rather than uncaught runtime failures.
- The renderer route still intentionally contains an invalid Mermaid fixture for failure-isolation coverage.

## Session: 2026-05-15 Phase 6 Properties Refinement
**Phase:** Post-MVP properties refinement implementation

**Actions taken:**
- Replaced the hybrid properties table with compact rows: drag handle, type icon, property name/type popover, typed value editor, and subtle remove affordance.
- Added pointer drag/drop reordering and `Alt+ArrowUp` / `Alt+ArrowDown` keyboard reordering on the drag handle, removing the visible move up/down buttons.
- Added property type options through the name/type popover, including text, date, time, date-time, tags, boolean, and link/url.
- Added inline tag tokens with Enter-to-add, Backspace-from-empty-to-remove-last, and subtle per-token remove buttons.
- Added native date/time/date-time input types with compact picker buttons when the platform supports `showPicker`.
- Added `propertySchema` API support through core, React, and CodeMirror for labels, preferred types, icon hints, default values, and order-aware add-property behavior.
- Wired the examples gallery and `/modes` hybrid/all-mode examples to use the schema while keeping Font Awesome isolated to the example WYSIWYG toolbar icon adapter.
- Added unit and Playwright coverage for schema-backed property labels/defaults, keyboard reordering, type switching, tag editing, and mobile/desktop example behavior.

**Verification:**
- `pnpm --filter @markdown-editor/core build` passed.
- `pnpm --filter @markdown-editor/core typecheck` passed.
- `pnpm --filter @markdown-editor/codemirror test` passed with 18 checks.
- `pnpm --filter @markdown-editor/react typecheck` passed.
- `pnpm --filter @markdown-editor/react build` passed.
- `pnpm --filter @markdown-editor/dev-harness typecheck` passed.
- `pnpm --filter @markdown-editor/dev-harness build` passed.
- `pnpm --filter @markdown-editor/dev-harness test:e2e -- e2e/examples.spec.ts -g "schema-backed property"` passed on desktop and mobile Chromium.

**Outcome:** Phase 6 properties refinement is implemented and ready for review.

**Carry-forward notes:**
- The schema API currently guides labels, types, icons, defaults, and add order; it does not yet enforce validation or required fields.
- Complex YAML preservation remains the main source-fidelity gap for the structured properties editor.
- Host-service suggestions inside link/tag/property values remain future work.

## Session: 2026-05-15 Properties Plan Revision
**Phase:** Post-MVP properties refinement planning

**Actions taken:**
- Revised the main plan with Phase 6 for an Obsidian-class properties panel rather than treating the current implementation as the final advanced editor.
- Captured the desired row model: drag handle, compact type icon, property name/type popover, type-specific editor, inline token tags, and minimal always-visible chrome.
- Clarified that persistent up/down row buttons should be replaced by pointer drag reordering plus an accessible keyboard alternative.
- Preserved the Font Awesome direction for examples while keeping the reusable editor packages icon-library agnostic through slots/adapters.
- Expanded requirements around schema-driven property keys, preferred types, labels, defaults, validation, required fields, ordering, and complex YAML guardrails.

**Verification:**
- Documentation-only change; implementation tests were not run.

**Outcome:** The next implementation pass should target the refined properties UX/API rather than broad post-MVP exploration.

**Carry-forward notes:**
- The current structured properties editor remains useful as a functional baseline but should be visually and behaviorally refined before calling the advanced properties work complete.
- The screenshot/reference direction favors dense inline editing over bulky dialogs or management pages.

## Session: 2026-05-15 Post-MVP Options
**Phase:** Post-MVP options - properties, tables, host services, QA

**Actions taken:**
- Added an Obsidian-inspired hybrid properties panel with type affordances for text, date, time, tags, and boolean values.
- Added properties UI actions for editing keys/values, adding properties, removing properties, and keyboard-accessible move up/down reordering while preserving Markdown/YAML as the saved source.
- Added WYSIWYG table operation controls for simple GFM tables: insert row, insert column, delete row, and delete column, with guards against invalid empty tables.
- Added a host-service toolbar path in `@markdown-editor/react` for `searchLinks` suggestions and `uploadAsset` image insertion.
- Added a new `/examples` host-services shell showing page/wiki-link suggestions and host-backed image upload with rendered preview.
- Added post-MVP QA documentation and Playwright coverage for screenshot artifacts, layout invariants, accessibility guards, and route budget smoke checks.
- Exported `HostServices` and `LinkSuggestion` from `@markdown-editor/react` so hosts can type integration services from the React package.

**Verification:**
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.
- `pnpm --filter @markdown-editor/dev-harness test:e2e` passed with 60 Playwright checks across desktop and mobile Chromium.

**Outcome:** The first post-MVP options pass is implemented and ready for review.

**Carry-forward notes:**
- Advanced properties editing remains limited to top-level scalar, CSV, inline-list, and simple block-list values; nested YAML/comments are canonicalized by the structured editor.
- WYSIWYG table operations target simple unmerged GFM tables and retain the existing accepted Markdown normalizations.
- Host-service insertion is practical in Markdown/CodeMirror modes; selection-aware insertion for WYSIWYG is still future work.
- Screenshot artifacts are review aids, not committed pixel baselines.

## Session: 2026-05-15 Worker D Post-MVP QA Artifacts
**Phase:** Post-MVP QA/audit/docs

**Actions taken:**
- Added `docs/post-mvp-qa.md` with visual screenshot/layout review criteria, a manual accessibility audit checklist, and draft performance budget notes.
- Updated release-readiness notes with post-MVP visual/layout audit tracking, accessibility checklist references, performance budget references, and post-MVP QA source links.
- Updated the test matrix with post-MVP visual screenshot, layout invariant, accessibility audit, and route budget smoke entries.
- Added `examples/dev-harness/e2e/post-mvp-qa.spec.ts` to attach desktop/mobile screenshots for `/examples`, `/modes`, and `/renderers`, check representative example layout invariants, guard unlabeled buttons and ARIA states, and record route readiness against conservative draft budgets.
- Added the new QA note to `docs/index.yaml`.

**Verification:**
- `pnpm --filter @markdown-editor/dev-harness test:e2e -- e2e/post-mvp-qa.spec.ts` passed with 14 Playwright checks across desktop and mobile Chromium.
- `git diff --check` passed with line-ending normalization warnings only.

**Outcome:** Post-MVP QA artifacts are started and ready for main-agent review. This pass does not declare final release completion.

**Carry-forward notes:**
- Screenshot artifacts are review aids, not committed visual baselines.
- Accessibility remains an MVP smoke plus manual-audit track, not a certification claim.
- Performance budgets are intentionally draft and should not be tightened until large fixtures and trace collection are stable.

## Session: 2026-05-14 Phase 4/5 Completion
**Phase:** 4-5 - Examples, Hardening, Docs, and Release Readiness

**Actions taken:**
- Completed WYSIWYG MVP table support with editable Lexical table nodes, import/export transformers, insert-menu support, styling, semantic inspection helpers, and accepted-normalization tests.
- Completed the Phase 4 example gallery by adding side-pane review, modal quick-edit, technical runbook, mobile-first note, AI prompt composer, and conflict/diff resolver examples alongside the six required MVP shells.
- Expanded Playwright coverage for example shells, responsive dimensions, configured mode switching, renderer failures, controlled value propagation, read-only behavior, keyboard/ARIA toolbar semantics, reduced-motion behavior, and performance smoke.
- Added core hardening fixtures and tests for GFM/frontmatter/tables/callouts/inline HTML/wiki-links/diagrams/long lines/mixed line endings.
- Added CodeMirror resilience coverage and fixed synchronous hybrid renderer exceptions so failures render inline instead of escaping the editor.
- Added release-readiness documentation covering accessibility, performance, security, host integration recipes, Knowledge E3 migration notes, example source links, known limitations, and review guidance.
- Updated the main plan, MVP implementation plan, test matrix, lessons, and index to reflect Phase 4/5 completion.

**Verification:**
- `pnpm --filter @markdown-editor/dev-harness test:e2e -- e2e/modes-renderers.spec.ts` passed with 22 Playwright checks.
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.
- `pnpm --filter @markdown-editor/dev-harness test:e2e` passed with 44 Playwright checks across desktop and mobile Chromium.
- `git diff --check` passed with line-ending normalization warnings only.

**Outcome:** Phase 4 and Phase 5 implementation work is complete and ready for final full-suite verification and review handoff.

**Carry-forward notes:**
- Advanced Obsidian-style properties editing remains explicitly post-MVP.
- WYSIWYG tables intentionally normalize alignment markers, row width, and rich inline formatting inside cells as documented accepted normalizations.
- The accessibility/performance/security gates are MVP smoke and audit gates, not a formal compliance certification.

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
- Fixed WYSIWYG Markdown import for existing task lists so `- [ ]` and `- [x]` load as real checklist items instead of unordered-list text.
- Added WYSIWYG checkbox-list round-trip coverage.
- Added WYSIWYG PlantUML diagram nodes that render through the existing host-renderer boundary and expose the same edit/apply source workflow as Mermaid.
- Routed React WYSIWYG rendering services through the active renderer registry or host `renderPlantUml` service.
- Added WYSIWYG PlantUML round-trip coverage.
- Added WYSIWYG image nodes that render Markdown images visually and expose URL, alt text, and title editing.
- Added an image option to the WYSIWYG insert menu without expanding into upload pipeline scope.
- Added WYSIWYG image round-trip coverage.
- Captured the future requirement for an Obsidian-style properties panel in `docs/requirements.md`.
- Updated the MVP implementation plan to keep current properties editing scoped to simple scalar rows and defer advanced typed property editing.
- Updated the main plan decision log with the rationale for treating advanced properties as deliberate post-MVP UX/API work and for keeping PlantUML behind a host-renderer boundary.
- Captured the toolbar icon direction: support Font Awesome through a future icon adapter/slot, but do not add a hard dependency to the reusable control by default.
- Added a `/examples` dev-harness route with the six required MVP example shells: all-modes technical docs, markdown plus preview split workflow, hybrid-only knowledge editing, WYSIWYG-only contributor editing, read-only published docs, and compact comment composer.
- Added Playwright e2e smoke coverage for the examples route across desktop and mobile Chromium projects.
- Installed Playwright's Chromium browser runtime locally so `pnpm --filter @markdown-editor/dev-harness test:e2e` can execute in this workspace.
- Added a host-supplied WYSIWYG toolbar icon slot and wired the dev-harness examples to use Font Awesome icons for bold, italic, inline code, bulleted list, numbered list, and checkbox list controls.
- Added Playwright coverage proving the WYSIWYG contributor example renders Font Awesome toolbar SVGs.
- Added Playwright coverage for the `/modes` route covering all-mode switching, markdown+preview configuration limits, and read-only preview chrome.
- Added an intentionally invalid Mermaid block to the renderer fixture and Playwright coverage for highlighted code, rendered Mermaid, host-rendered PlantUML, tables, callouts, unsupported-language diagnostics, and inline Mermaid failure fallback.

**Verification:**
- `pnpm --filter @markdown-editor/renderers typecheck` passed.
- `pnpm --filter @markdown-editor/renderers test` passed.
- `pnpm --filter @markdown-editor/dev-harness typecheck` passed.
- `pnpm --filter @markdown-editor/wysiwyg-lexical test` passed.
- `pnpm --filter @markdown-editor/react typecheck` passed.
- `pnpm --filter @markdown-editor/dev-harness test:e2e` passed with 22 Playwright checks across desktop and mobile Chromium.
- `pnpm -r typecheck` passed.
- `pnpm -r test` passed.
- `pnpm -r build` passed.
- Dev harness at `http://127.0.0.1:5175/modes` returned HTTP 200.

**Outcome:** The advanced properties direction is documented without expanding the current MVP implementation scope. PlantUML now has a production-shaped host-renderer integration path with local fixture coverage. Hybrid mode now covers the initial MVP block-widget set. WYSIWYG now has a real lazy-loaded Lexical package boundary, a selection-aware editing toolbar, scalable block insertion, block-level code language controls with syntax highlighting, imported and newly inserted checkbox lists, source-backed images, and rendered source-backed Mermaid and PlantUML diagrams, but still needs table coverage before it can be considered MVP-complete. The required MVP example shells now exist in the dev harness and have desktop/mobile e2e coverage for examples, mode configurations, renderer success, and renderer failure fallback.

**Carry-forward notes:**
- Hybrid and diagram basics should now be treated as initial MVP-complete; remaining work is WYSIWYG hardening, examples, Playwright coverage, and release hardening.
- Current WYSIWYG coverage is intentionally narrow: headings, prose, inline formatting, links, ordered/bulleted/checkbox lists, blockquotes, highlighted fenced code, source-backed images, rendered Mermaid and PlantUML diagrams, and frontmatter envelope preservation.
- Future properties work should support reorder, add/remove, date/time/tag/boolean/link-aware editors, and host-defined property schemas.
- Toolbar icon support should be designed as a host-swappable icon slot/adapter so hosts can choose Font Awesome, Lucide, or a lightweight default without forcing all consumers to carry the same icon package.
- The examples route is currently a practical integration gallery, not final product-grade example-site polish. Next passes should add screenshot/layout assertions and refined shell-specific UX.

---
