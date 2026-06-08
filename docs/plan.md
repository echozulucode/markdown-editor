---
type: plan
project: "markdown-editor"
status: ready_for_review
version: 2
updated: 2026-06-07
note: "Packages renamed @markdown-editor/* -> @echozedlabs/* and published to npm. Older docs/log entries keep the original names."
phases:
  - id: 1
    name: "Reference Extraction & Product Contract"
    status: completed
  - id: 2
    name: "Standalone Package Architecture"
    status: completed
  - id: 3
    name: "Core Editor Implementation"
    status: completed
  - id: 4
    name: "Example Sites & Integration Gallery"
    status: completed
  - id: 5
    name: "Hardening, Docs, and Release"
    status: completed
  - id: 6
    name: "Post-MVP Properties and Host Polish"
    status: completed
  - id: 7
    name: "Open-Source Packaging & npm Publishing (@echozedlabs)"
    status: completed
  - id: 8
    name: "Editable Tables + BDD Living Documentation & CI Gate"
    status: completed
  - id: 9
    name: "Demo Polish & Stabilization (theming, real bug fixes)"
    status: completed
current_phase: "Published to npm; living docs + demo polish done; 0.2.0 release pending"
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
- [x] Consolidate renderer contracts onto `@markdown-editor/core` public types.
- [x] Build initial design-token CSS contract and responsive layout primitives in `packages/react`.
- [x] Decide PlantUML strategy: default to host/server renderer, with public PlantUML server only as an explicit demo fallback.

## Phase 3: Core Editor Implementation
- [x] Build CodeMirror 6 raw Markdown mode foundation with search, line wrapping, read-only control, and selection APIs.
- [x] Add jsdom behavior coverage for CodeMirror markdown-mode editing, selection, lifecycle, and change events.
- [x] Create `@markdown-editor/react` public component shell and imperative handle.
- [x] Wire `examples/dev-harness` to consume public package APIs instead of placeholders.
- [x] Build preview/read-only mode with the same renderer pipeline and no editing chrome.
- [x] Split the dev harness production bundle into React, CodeMirror, and Lezer chunks.
- [x] Add an opt-in Shiki code renderer factory with broad bundled-language support and plaintext fallback tests.
- [x] Wire Shiki into the renderer harness route with success, fallback, and diagnostic coverage.
- [x] Replace full-bundle Shiki usage with fine-grained core language/theme loading for the MVP language set.
- [x] Build initial hybrid mode on the same CodeMirror state with active-block reveal, rendered inactive fenced blocks, rendered headings/lists/task lists, and properties table support.
- [x] Port WYSIWYG as an optional Lexical adapter with strict Markdown import/export gates.
- [x] Integrate Mermaid rendering with async execution, timeout, error panels, and no page crashes.
- [x] Integrate PlantUML through a renderer interface so hosts can provide a secure server endpoint.
- [x] Build initial table, image, code block, callout, link, wiki-link, and diagram hybrid widgets with source-edit affordances.
- [x] Establish the optional WYSIWYG package boundary and lazy React loading path.
- [x] Add initial WYSIWYG toolbar commands, selection-aware block style display, scalable block insertion, block-level code language controls with syntax highlighting, checkbox lists, source-backed image editing, and rendered source-backed Mermaid and PlantUML diagram editing.
- [x] Expand WYSIWYG import/export coverage for MVP technical blocks and accepted normalizations.
- [x] Track advanced Obsidian-style properties editing as post-MVP/frontmatter UX work: reorder, add/remove, typed date/time/tag/boolean editors, and host-defined property schemas.

## Phase 4: Example Sites & Integration Gallery
- [x] Full-page docs editor using all modes.
- [x] Markdown plus preview split or toggle workflow.
- [x] Hybrid-only knowledge-base editor.
- [x] WYSIWYG-only nontechnical contributor editor.
- [x] Read-only published documentation site.
- [x] Compact comment composer.
- [x] Side-pane review editor.
- [x] Modal quick-edit editor.
- [x] Technical runbook editor with diagrams and code-heavy samples.
- [x] Mobile-first note editor.
- [x] AI prompt composer using Markdown and page mentions.
- [x] Conflict/diff resolver embedding multiple editor instances.

## Phase 5: Hardening, Docs, and Release
- [x] Round-trip fixture suite covering GFM, frontmatter, tables, callouts, inline HTML, wiki-links, diagrams, very long lines, and mixed line endings.
- [x] WYSIWYG semantic and byte-stability gates with documented accepted normalizations.
- [x] Playwright coverage across desktop, tablet, and phone viewports.
- [x] Accessibility audit for keyboard navigation, screen reader semantics, focus restoration, contrast, and reduced motion.
- [x] Performance gates for mount, typing latency, mode switch, autocomplete, diagram rendering, and very large documents.
- [x] Security review for Markdown HTML, links, image URLs, Mermaid, PlantUML, and plugin APIs.
- [x] Publish package docs, host integration recipes, migration guide from Knowledge E3, and example-site source links.

## Phase 6: Post-MVP Properties and Host Polish
- [x] Replace the current advanced properties row actions with an Obsidian-class compact interaction model: drag handles for pointer reordering, keyboard-accessible reorder support, and no persistent per-row move buttons in the primary UI.
- [x] Add a property-name/type popover opened from the property name area. The selected type should be represented by a compact icon, with the text label available through accessible names and tooltips rather than always-visible chrome.
- [x] Build type-specific property editors: text input, boolean checkbox, date picker, time picker, date-time editor when needed, tags/token input, and link/url fields. Host-service value suggestions remain future work.
- [x] Implement tag editing inline in the row: type to add, press Enter to commit, Backspace/delete affordances for individual tags, and a subtle remove icon on each token. Avoid separate bulky management screens.
- [ ] Preserve Markdown/YAML as canonical source while clearly documenting the structured editor's YAML preservation boundary: simple scalars/lists remain supported first; complex YAML should either fall back to source editing or be guarded by host schema rules.
- [x] Add initial host property schema support for preferred keys, types, labels, icon hints, default values, and order preferences. Validation and required-field enforcement remain future work.
- [x] Add responsive behavior for the properties panel so the same controls work in full-page editors, side panes, modals, and mobile examples without row crowding.
- [x] Extend examples to show the refined properties panel in hybrid-only, all-modes, and compact/mobile contexts.
- [x] Keep Font Awesome as an example-site icon adapter, not a core package dependency. The reusable editor should continue to expose icon slots/adapters so hosts can use Font Awesome, Lucide, or their own design-system icons.
- [x] Add focused unit and browser tests for drag reordering, keyboard reordering, type switching, date/time editing, tag token add/remove, initial schema behavior, mobile layout, and YAML source updates.

## Phase 7: Open-Source Packaging & npm Publishing
- [x] Rename packages `@markdown-editor/*` → `@echozedlabs/*` (npm org `echozedlabs`, brand echozed.com, MIT license).
- [x] Set up Changesets (fixed versioning) and OIDC trusted publishing; document the runbook in `PUBLISHING.md`.
- [x] Publish `core`, `react`, `codemirror`, `renderers`, `wysiwyg-lexical` at 0.1.0.
- [x] Switch knowledge-e3 to consume `@echozedlabs/*` from npm; remove the workspace glob and the private-repo CI checkout/token.
- [x] Scaffold a standalone `echozed-demo` app consuming the published packages; write a brand blog post.
- [ ] Publish 0.2.0 bundling the pending changesets (user owns releases), then bump knowledge-e3 + echozed-demo to `^0.2.0`.

## Phase 8: Editable Tables + BDD Living Documentation & CI Gate
- [x] Add a dependency-free GFM `table-model` and an Obsidian-style `HybridTableWidget` (contenteditable cells, Tab nav, alignment) with an icon toolbar + right-click context menu.
- [x] Author 10 declarative Gherkin feature files in `features/` + interaction-contract YAML + README (0.1.0 baseline vs 0.2.0 additions).
- [x] Build `features/coverage.yaml` (scenario→test manifest) and `docs/bdd-coverage-and-test-plan.md`; close all gaps to 51/51 covered.
- [x] Make feature files executable with `playwright-bdd` (`inline_table_editing`, `diagram_rendering`).
- [x] Add CI coverage gate + intent lint (`pnpm verify:features`) and a `bdd` job.
- [ ] Bind remaining interaction features as executable BDD and add chromium-mobile to the BDD projects.

## Phase 9: Demo Polish & Stabilization
- [x] Fix latent bugs (see `docs/issues.yaml`): Mermaid error-graphic leak, hybrid table detection of aligned/single-column tables, host-CSS bleed into the editor, preview re-render loop, preview blank-on-navigation (activeMode clamp).
- [x] Render wiki links in preview; date property icon; preview/rich-text table gridlines; responsive phone tables.
- [x] Restyle the mode switcher (token-based segmented control); harness page-theme toggle (Light/Dark/Auto); editor follows the page theme, not the OS.
- [x] Build real content for the Responsive / Accessibility / Performance harness routes.
- [ ] Investigate controlled-editor blank-line churn on repeated structural commits.

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
| 2026-05-13 | Keep preview rendering in `@markdown-editor/react` backed by `@markdown-editor/renderers`. | This proves the shared renderer pipeline through the public component before hybrid decorations and WYSIWYG are added. |
| 2026-05-13 | Split harness bundles by React, CodeMirror, and Lezer first. | This removes the immediate Vite chunk warning without introducing brittle circular manual chunks. |
| 2026-05-13 | Make Shiki syntax highlighting opt-in through the renderer registry. | Hosts should choose the syntax-highlighting bundle strategy explicitly; the default renderer remains lightweight and safe. |
| 2026-05-13 | Use Shiki core with explicit language/theme loaders instead of `shiki` full bundle. | The full bundle pulled every bundled language into the harness build; fine-grained loading keeps syntax highlighting usable without blowing up MVP chunks. |
| 2026-05-14 | Keep MVP properties editing simple, but reserve the API/UX path for an Obsidian-style properties panel. | The richer properties panel needs typed editors, reordering, add/remove flows, and host property schemas, which should be designed deliberately after the hybrid editing basics are stable. |
| 2026-05-14 | Expose PlantUML as a host-renderer factory instead of a built-in network renderer. | Production hosts need to own the secure PlantUML endpoint; the package should provide timeout, abort, diagnostics, and fallback behavior around that boundary. |
| 2026-05-14 | Lazy-load the WYSIWYG Lexical adapter from `@markdown-editor/react`. | Hosts that do not enable WYSIWYG should not pay the Lexical bundle cost; the first adapter package proves the boundary while later work broadens import/export coverage. |
| 2026-05-14 | Treat WYSIWYG diagrams as rendered, source-backed blocks rather than graphical editors. | Mermaid has no native graphical editing surface in this MVP; rendering by default with an explicit source edit/apply path matches Confluence-style expectations while preserving Markdown fidelity. |
| 2026-05-14 | Use a generic WYSIWYG insert control instead of per-block toolbar textboxes. | The toolbar needs to scale to more block types; Mermaid source editing belongs on the rendered block, while insertion should stay generic and compact. |
| 2026-05-14 | Keep code-block language selection on the code block, not the global toolbar. | Language is code-block metadata and should travel with the block surface, especially once multiple code blocks with different languages are present. |
| 2026-05-14 | Route WYSIWYG PlantUML rendering through host/render-registry services. | PlantUML must stay behind the same host-owned rendering boundary in WYSIWYG as it does in preview and hybrid modes. |
| 2026-05-14 | Keep WYSIWYG image support URL-backed for MVP. | Uploads are a host-service concern; the WYSIWYG adapter should render and edit Markdown image metadata first, then plug into uploads later through the host boundary. |
| 2026-05-14 | Keep toolbar iconography host-swappable instead of hard-wiring Font Awesome. | Font Awesome is a valid host choice, but the reusable control should expose an icon slot or adapter so consumers can use Font Awesome, Lucide, or a default lightweight icon set without forcing one dependency into every bundle. |
| 2026-05-14 | Start the example gallery in the existing dev harness instead of a separate app. | The harness already consumes public APIs and hosts the mode/renderer fixtures, so adding `/examples` there keeps smoke coverage close to the integration surface while the examples mature. |
| 2026-05-14 | Use Font Awesome in examples through the WYSIWYG toolbar icon slot. | This proves graphical toolbar integration with a real icon library while keeping the package-level toolbar library-agnostic for other hosts. |
| 2026-05-14 | Treat simple GFM pipe tables as the MVP WYSIWYG table shape. | The WYSIWYG adapter now imports/renders/exports editable tables, while advanced table operations and alignment preservation remain accepted normalizations or post-MVP scope. |
| 2026-05-14 | Use the dev harness examples route as the Phase 4 review surface. | The route now contains the six required shells plus side-pane review, modal quick edit, technical runbook, mobile note, prompt composer, and conflict resolver examples using public APIs. |
| 2026-05-14 | Treat Phase 5 gates as MVP smoke/audit gates, not a formal compliance certification. | Automated tests now cover unit, browser, responsive, accessibility, and performance smoke paths; deeper axe, screen-reader, and production security certification remain host/release-process responsibilities. |
| 2026-05-15 | Make the post-MVP properties panel an Obsidian-class editor rather than a CRUD table. | The target UX is compact, inline, and source-backed: drag handles for ordering, type icons and popovers, customized date/time/tag/boolean editors, and no bulky property-management screens. |
| 2026-05-15 | Keep Font Awesome visible in examples but isolated through the existing icon adapter boundary. | The examples should demonstrate the requested graphical toolbar with a real icon set while the core packages remain library-agnostic for consumers with different design systems. |
| 2026-06-04 | Publish under the `@echozedlabs` npm scope (MIT, brand echozed.com) and consume it from npm in knowledge-e3 + echozed-demo. | Makes the editor a real versioned open-source package instead of a workspace-only dependency; OIDC trusted publishing + Changesets give a clean release path. |
| 2026-06-05 | Make hybrid tables inline-editable widgets with an icon toolbar + right-click context menu. | Obsidian/Word/Excel-style direct editing beats raw-pipe editing; the widget commits on leave so cell navigation never churns the document. |
| 2026-06-06 | Treat the Gherkin feature files as living documentation enforced by a CI coverage gate + intent lint. | Feature files stay valuable only if every scenario maps to a real test and stays declarative; the manifest + gate prevent silent coverage drift. |
| 2026-06-06 | The editor never imposes a theme; it follows the host page via `--me-*` tokens. | An embedded control that reads `prefers-color-scheme` fights its host (dark editor in a light page); the page/host owns light/dark. |
| 2026-06-07 | Clamp `activeMode` to `modes` and depend the preview effect only on `markdown`. | Prevents a reused/reconciled editor from rendering a mode outside `modes`, and prevents the diagnostics callback from driving a preview re-render loop. |

## Errors Encountered
| Date | Error | Resolution |
|------|-------|------------|
| 2026-05-11 | Port `5173` was occupied when starting the dev harness. | Vite selected `5174`; use the reported URL for the current running harness. |
| 2026-05-11 | Subagents using npm created package-lock files inside a pnpm workspace. | Removed npm lockfiles and normalized packages under the root pnpm workspace. |
| 2026-05-13 | Aggressive CodeMirror subchunking created a Rollup circular chunk warning. | Simplified manual chunks to React, CodeMirror, and Lezer; build is clean and chunks stay below the warning threshold. |
| 2026-05-13 | Importing Shiki's top-level bundle restored Vite large-chunk warnings and emitted hundreds of language/theme chunks. | Switched `createShikiCodeRenderer` to `shiki/core`, JavaScript regex engine, explicit language loaders, and a single default theme loader. |
| 2026-05-14 | WYSIWYG imported Markdown task-list syntax as unordered lists containing literal `[ ]` and `[x]` text. | Added Lexical's `CHECK_LIST` Markdown transformer before the default transformer set so existing Markdown task lists become real checklist items on import. |
| 2026-06-04 | `npm publish` at the monorepo root collided with an unrelated package; Classic *Publish* tokens hit E403. | Use `pnpm -r publish --access public --no-git-checks` (root + dev-harness stay private) with a Granular/Automation token or OIDC; enable corepack for the pnpm 10 pin. |
| 2026-06-06 | `isTableSeparator` rejected center-aligned (`:--:`) and single-column tables, so editable tables vanished to source after centering a column or deleting to one column. | Loosened the regex to match GFM separators (any dash run, optional alignment colons, ≥1 column), in step with `table-model`. |
| 2026-06-06 | Harness element selectors bled into editor internals (dark mode-button text, invisible toolbar icons). | Scoped the harness rules to direct children / header-footer subtrees so they never match `.me-editor` descendants. |
| 2026-06-06 | Adding `prefers-color-scheme: dark` to the editor stylesheet made it go dark inside a light page on a dark-OS machine. | Reverted; the editor follows the page via `--me-*` tokens. Added a harness Light/Dark/Auto page-theme toggle instead. |
| 2026-06-07 | The Renderers preview was blank with no diagnostics when reached by navigation (worked on fresh load). | React reconciled the prior route's markdown-mode editor into the preview editor; `initialMode` only applies on mount. Clamped `activeMode` to `modes` and made the preview effect depend only on `markdown`. |

