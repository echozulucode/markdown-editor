---
type: implementation-plan
project: "markdown-editor"
status: active
updated: 2026-05-14
scope: "MVP"
---

# MVP Implementation Plan

## MVP Goal
Ship a standalone React/TypeScript Markdown editor control that proves the core product promise:

- Hosts can enable any subset of `markdown`, `hybrid`, `preview`, and `wysiwyg` modes.
- Markdown text is the canonical source of truth.
- The editor works well in full-page, narrow pane, modal, compact, and mobile layouts.
- Code blocks are syntax highlighted for major languages.
- Mermaid and PlantUML fenced blocks render through safe, async renderer interfaces.
- The package includes enough example sites to prove real reuse, not just a component demo.

## MVP Scope

### Current Progress Snapshot
- Workspace, core codec, renderer registry, CodeMirror markdown foundation, React component shell, preview mode, and dev harness wiring are in place.
- CodeMirror markdown behavior has jsdom coverage for edits, selection, lifecycle, and change events.
- Syntax highlighting has an opt-in fine-grained Shiki renderer factory, plaintext fallback tests, and a renderer harness route using public package APIs.
- Mermaid has an async renderer with timeout/error fallback, and PlantUML has a host-renderer factory with timeout/error fallback.
- Initial hybrid decorations are in place for headings, lists, task lists, inline links/wiki-links, frontmatter properties, rendered inactive fenced blocks, tables, images, and callouts.
- WYSIWYG Lexical adapter, example gallery, Playwright coverage, and hardening remain open.

### Included
- Monorepo package setup with TypeScript, React, Vite, Vitest, Playwright, package builds, and examples app.
- Core Markdown codec and round-trip corpus extracted from Knowledge E3 and cleaned for standalone use.
- Public editor API with mode configuration, feature flags, renderer registry, host services, and imperative handle.
- CodeMirror 6 Markdown engine for `markdown`, `hybrid`, and `preview` modes.
- Optional Lexical WYSIWYG adapter for common prose and technical-doc blocks.
- Shiki syntax highlighting with lazy language/theme loading.
- Mermaid renderer with async render, timeout, error boundary, and no document crash on invalid diagrams.
- PlantUML renderer interface with a demo renderer and a production expectation that hosts provide the endpoint.
- Render/edit support for headings, paragraphs, emphasis, links, wiki-links, lists, task lists, blockquotes, horizontal rules, fenced code, tables, images by URL, callouts, Mermaid, and PlantUML.
- Basic frontmatter properties table in hybrid mode for simple scalar `key: value` rows.
- Responsive editor shell, toolbar slots, mode switcher, small-screen layouts, and keyboard shortcuts.
- At least six example host shells.
- Automated tests for codec, mode sync, renderer failures, WYSIWYG import/export, responsive layout, and examples smoke coverage.

### Deferred
- Real-time collaboration.
- Attachment upload pipeline beyond host-service interface and demo mock.
- Full plugin marketplace.
- Advanced table operations such as merge/split cells.
- Advanced Obsidian-style properties editing: property reordering, add/remove UI, typed date/time/tag/boolean/link editors, and host-defined property schemas.
- Math rendering unless it falls out cheaply from the renderer system.
- Native desktop/Tauri wrapper.
- Production telemetry backend; keep local perf marks and callback hooks.

## Team Model

Assume a small parallel subagent team with one coordinating lead.

| Lane | Subagent | Primary Ownership | Writes |
| --- | --- | --- | --- |
| A | Foundation | workspace, package structure, core types, codec, build/test plumbing | `packages/core`, root config, fixtures |
| B | CodeMirror | Markdown, hybrid, preview modes, CM6 commands, selection, history | `packages/codemirror` |
| C | Renderers | Shiki, Mermaid, PlantUML interface, block renderer registry, security boundaries | `packages/renderers` |
| D | WYSIWYG | Lexical adapter, import/export visitors, toolbar commands for WYSIWYG | `packages/wysiwyg-lexical` |
| E | React UX & Examples | public React component, responsive shell, example sites, visual polish | `packages/react`, `examples/*` |
| F | QA/Hardening | test matrix, Playwright, accessibility, performance, release gates | `tests`, `docs`, CI helpers |

Coordination rule: each lane owns disjoint files. Cross-lane contracts must be changed through `packages/core` types first, then downstream lanes adapt.

## Phase 0: Kickoff and Architecture Freeze

**Duration:** 1-2 days  
**Goal:** Turn the high-level plan into stable contracts so parallel work does not thrash.

### Work
- Define MVP acceptance criteria and non-goals.
- Create initial package/file layout.
- Freeze initial public API names:
  - `MarkdownEditor`
  - `EditorMode`
  - `MarkdownEditorProps`
  - `MarkdownEditorHandle`
  - `MarkdownEditorExtension`
  - `RendererRegistry`
  - `HostServices`
- Decide package manager and build tooling.
- Decide CSS strategy: package CSS plus token overrides, not app-specific tokens.
- Define mode semantics:
  - `markdown`: raw Markdown only.
  - `hybrid`: active block source, inactive blocks rendered.
  - `preview`: rendered document, optional cursor/selection only when editable.
  - `wysiwyg`: Lexical visual editing, Markdown remains canonical.

### Parallel Assignments
- Foundation: scaffold monorepo and package boundaries.
- React UX: sketch component API and example app routes.
- QA: draft first test matrix and acceptance gates.

### Deliverables
- Root workspace with empty packages.
- `docs/mvp-implementation-plan.md` approved as working plan.
- `docs/api-design.md` with public API type sketch.
- `docs/test-matrix.md` with MVP gates.

### Gate
- Every lane can start with clear file ownership and API expectations.

## Phase 1: Foundation, Codec, and Contract Tests

**Duration:** 3-5 days  
**Goal:** Establish the canonical Markdown model before UI work depends on it.

### Work
- Extract Knowledge E3 codec into `packages/core`.
- Preserve byte-stable no-op round trips.
- Add `parseMarkdown`, `serializeMarkdown`, `replaceBody`, `splitFrontmatter`, and frontmatter-neutral body helpers.
- Move fixture corpus into `packages/core/test/fixtures`.
- Add fixture categories for diagrams and large docs.
- Define `DocumentSnapshot`, `ChangeMeta`, `SelectionSnapshot`, `ModeChangeMeta`, and diagnostic types.
- Add contract tests that all engines must satisfy:
  - no-op input returns same bytes;
  - body replacement preserves raw frontmatter;
  - mode adapters never emit `undefined`/empty markdown on init;
  - invalid frontmatter does not crash parsing.

### Parallel Assignments
- Foundation owns codec extraction and core types.
- QA owns fixture normalization and test harness.
- CodeMirror and WYSIWYG consume types but do not mutate them without coordinator review.

### Deliverables
- `@markdown-editor/core` builds and tests.
- `core` fixture suite passes.
- API type exports are documented enough for other lanes.

### Gate
- `pnpm test --filter @markdown-editor/core` passes.
- All downstream packages can import `EditorMode`, `DocumentSnapshot`, and renderer contracts.

## Phase 2: CodeMirror Markdown Engine

**Duration:** 1 week  
**Goal:** Ship a strong raw Markdown editor and the substrate for hybrid/preview.

### Work
- Build `createMarkdownEditorView` in `packages/codemirror`.
- Support:
  - Markdown language extension;
  - line wrapping;
  - native history;
  - default keymaps;
  - search hook;
  - save/cancel shortcuts;
  - host-controlled read-only state;
  - imperative focus, selection, insert, replace, and get-doc APIs.
- Add Markdown editing shortcuts:
  - bold, italic, inline code;
  - heading levels;
  - list indent/outdent;
  - fenced code insertion.
- Implement mode state as a CodeMirror state field.
- Emit normalized `ChangeMeta` for every document edit.
- Build `markdown` mode first with no decorations beyond syntax highlighting.

### Parallel Assignments
- CodeMirror owns engine implementation.
- React UX builds a thin temporary harness around the engine.
- QA writes Playwright smoke tests against the harness.

### Deliverables
- `@markdown-editor/codemirror` raw Markdown editor.
- Harness page: `examples/dev-harness/markdown`.
- Tests for typing, undo/redo, selection restoration, external `value` update, and read-only mode.

### Gate
- Raw Markdown editing feels stable on 1k and 10k line fixtures.
- Typing p95 stays under 50ms on a 1k line fixture in local Playwright/perf smoke.

## Phase 3: Renderer Registry and Technical Blocks

**Duration:** 1 week, overlaps late Phase 2  
**Goal:** Build the rendering layer shared by preview, hybrid widgets, WYSIWYG previews, and examples.

### Work
- Implement `RendererRegistry` in `packages/renderers`.
- Implement block renderers:
  - headings and prose;
  - lists and task lists;
  - blockquotes;
  - code blocks;
  - tables;
  - images;
  - callouts;
  - Mermaid;
  - PlantUML.
- Integrate Shiki:
  - lazy highlighter;
  - common language aliases;
  - fallback to plaintext;
  - copy button and language label hooks.
- Integrate Mermaid:
  - isolated async rendering;
  - invalid syntax panel;
  - render timeout;
  - per-block error isolation.
- Define PlantUML production interface:
  - `hostServices.renderPlantUml(source, options)`;
  - demo renderer may use encoded URL only in examples, clearly labeled.
- Add sanitized HTML policy for rendered Markdown.

### Parallel Assignments
- Renderers owns registry and built-in renderers.
- QA writes renderer error tests.
- React UX starts visual styling and responsive renderer layouts.

### Deliverables
- `@markdown-editor/renderers` package.
- Renderer fixture page with valid and invalid code, Mermaid, PlantUML, tables, images, and callouts.
- Unit tests for renderer fallbacks and async errors.

### Gate
- A bad Mermaid or PlantUML block cannot crash the editor.
- Unknown code language renders as plaintext with a language label.

## Phase 4: Hybrid and Preview Modes

**Duration:** 1-2 weeks  
**Goal:** Deliver the distinctive editor experience: document-like editing without losing Markdown control.

### Work
- Implement preview decorations/widgets for inactive ranges.
- Start with block-level rendering:
  - headings;
  - paragraphs with inline emphasis/link hiding;
  - lists;
  - blockquotes;
  - fenced code;
  - tables;
  - diagrams;
  - images;
  - callouts.
- Define active range behavior:
  - active block shows raw Markdown in `hybrid`;
  - all blocks render in `preview`;
  - complex rendered blocks expose source-edit action;
  - clicking or keyboard navigation into a block reveals source when needed.
- Preserve CodeMirror native selection and undo where possible.
- Add stable min-height and scroll anchoring to avoid layout jumps.
- Add wiki-link autocomplete as a host-service backed completion source.
- Add unresolved wiki-link styling and navigation callback.

### Parallel Assignments
- CodeMirror owns decorations, active range, completions, and CM6 behavior.
- Renderers provides widgets and block render APIs.
- QA builds cursor/selection fixtures and Playwright tests.
- React UX tunes visual design across desktop and mobile.

### Deliverables
- `hybrid` and `preview` modes in CodeMirror package.
- Fixture gallery proving all MVP block types.
- Playwright tests for active block reveal, leaving block restore, tables, diagrams, wiki-link autocomplete, and no-op save.

### Gate
- Switching among `markdown`, `hybrid`, and `preview` preserves exact Markdown.
- Hybrid mode has no major layout jump on common block transitions.
- The editor remains usable at 390px, 768px, and desktop widths.

## Phase 5: React Component and Host API

**Duration:** 1 week, overlaps Phase 4  
**Goal:** Turn engines into the actual embeddable control.

### Work
- Implement `MarkdownEditor` in `packages/react`.
- Support:
  - controlled and semi-controlled value modes;
  - allowed modes via `modes`;
  - initial mode and controlled mode;
  - feature flags;
  - renderer registry injection;
  - host services injection;
  - theme tokens;
  - toolbar slots;
  - mode switcher slot;
  - imperative ref handle;
  - read-only mode.
- Build default toolbar:
  - icon buttons;
  - responsive overflow;
  - mode selector;
  - code/table/diagram insertion where enabled.
- Add accessibility semantics:
  - toolbar roles;
  - `aria-pressed`;
  - focus restoration after mode changes;
  - reduced-motion handling;
  - keyboard-only operation.

### Parallel Assignments
- React UX owns component shell, toolbar, theming, and responsive behavior.
- CodeMirror exposes engine hooks and lifecycle APIs.
- Renderers exposes CSS class contract.
- QA writes component-level tests.

### Deliverables
- `@markdown-editor/react` package.
- Component API docs.
- The dev harness switches to public `MarkdownEditor`, not internal engines.

### Gate
- The same component can be configured as:
  - hybrid-only;
  - markdown plus preview;
  - wysiwyg-only placeholder if Phase 6 not complete;
  - all modes;
  - read-only preview.

## Phase 6: Optional WYSIWYG Adapter

**Duration:** 1-2 weeks  
**Goal:** Provide a useful WYSIWYG mode without compromising Markdown fidelity.

### Work
- Port Lexical adapter into `packages/wysiwyg-lexical`.
- Implement mdast-to-Lexical and Lexical-to-mdast visitors for MVP nodes:
  - paragraph;
  - headings;
  - emphasis/strong/delete;
  - inline code;
  - links;
  - wiki-links;
  - unordered/ordered/task lists;
  - blockquote;
  - code block;
  - table;
  - horizontal rule;
  - image as Markdown-backed node or source fallback;
  - diagram blocks as rendered source-backed nodes.
- Route all export through core serialization.
- Add WYSIWYG toolbar commands.
- Add mode switch checkpoints from CodeMirror to Lexical and back.
- Lazy-load WYSIWYG package from React component when `wysiwyg` is enabled.

### Parallel Assignments
- WYSIWYG owns adapter and visitors.
- Foundation/QA owns cross-engine round-trip tests.
- React UX owns mode-switch UI and loading state.

### Deliverables
- `@markdown-editor/wysiwyg-lexical` optional package.
- WYSIWYG fixture suite and known-normalization report.
- WYSIWYG can be disabled entirely with no bundle hit beyond integration stub.

### Gate
- At least 80% of round-trip fixtures pass byte-identically through WYSIWYG.
- Any accepted normalization is documented and limited to WYSIWYG-edited content, not no-op mode switching.
- A host can configure `modes={['wysiwyg']}` and still receive Markdown changes.

## Phase 7: Example Sites MVP

**Duration:** 1 week, starts once Phases 4-5 are stable  
**Goal:** Prove embeddability through real host shells.

### Required Example Sites
- Full-page technical docs editor: all modes, diagrams, code, tables, responsive toolbar.
- Hybrid-only knowledge editor: no mode switch, document-first layout.
- Markdown plus preview editor: source/preview toggle or split workflow.
- WYSIWYG-only contributor editor: visual toolbar, no Markdown chrome.
- Read-only published docs site: preview renderer, no editor controls.
- Compact comment composer: small height, wiki-link autocomplete, submit shortcut.

### Stretch Examples
- Side-pane review editor.
- Modal quick-edit editor.
- Mobile-first note editor.
- AI prompt composer.
- Diff/conflict resolver.

### Parallel Assignments
- React UX owns example shells and visual design.
- QA owns screenshot and smoke coverage for each example.
- Renderers provides sample technical content.

### Deliverables
- `examples/gallery` with routes for each required example.
- Example source snippets shown in the UI or docs.
- Screenshot baselines for desktop and mobile.

### Gate
- Every required example uses the published package API, not internal imports.
- Every required example works at 390px and desktop widths.

## Phase 8: MVP Hardening and Release Candidate

**Duration:** 1 week  
**Goal:** Make the MVP dependable enough to build on.

### Work
- Run full test suite:
  - unit;
  - integration;
  - Playwright;
  - typecheck;
  - package build.
- Accessibility pass:
  - keyboard-only workflows;
  - focus order;
  - labels;
  - contrast;
  - reduced motion.
- Performance pass:
  - mount;
  - typing latency;
  - mode switch;
  - large document scroll;
  - Shiki lazy load;
  - Mermaid render timeout.
- Security pass:
  - HTML sanitization;
  - link handling;
  - image source handling;
  - Mermaid config;
  - PlantUML host-service boundary.
- Documentation:
  - install;
  - quickstart;
  - modes;
  - renderers;
  - host services;
  - theming;
  - examples;
  - known limitations.

### Parallel Assignments
- QA owns gates and bug triage.
- Foundation fixes build/package issues.
- CodeMirror/WYSIWYG/Renderers fix lane-specific defects.
- React UX fixes visual and accessibility issues.

### Deliverables
- MVP release candidate.
- Known issues list.
- Migration notes from Knowledge E3 reference implementation.
- Demo instructions for examples gallery.

### Gate
- No P0/P1 issues open.
- No known data-loss issue.
- Package builds from clean checkout.
- Example gallery is the primary manual QA surface.

## Cross-Phase Integration Rhythm

- Daily integration checkpoint: coordinator pulls lane outputs into the main branch and resolves API friction.
- Twice-weekly visual review: example gallery screenshots across mobile/tablet/desktop.
- End-of-phase gate review: only move forward when tests and examples for that phase are green.
- Contract changes: any change to `packages/core` public types requires a short note in `docs/api-design.md`.
- Bug policy: any data-loss, source-churn, cursor jump, or renderer crash gets logged immediately and blocks release until triaged.

## MVP Acceptance Criteria

- `MarkdownEditor` can run with `modes={['hybrid']}`, `['markdown', 'preview']`, `['wysiwyg']`, and all four modes.
- No-op loading and saving preserves Markdown bytes through core and CodeMirror modes.
- WYSIWYG no-op mode switching does not corrupt Markdown; WYSIWYG edits either preserve bytes or produce documented canonical Markdown.
- Code blocks highlight common languages through lazy Shiki loading and fall back cleanly.
- Mermaid and PlantUML blocks render asynchronously with inline error states.
- Invalid diagrams, missing images, unknown languages, and malformed frontmatter do not crash the editor.
- The required six example sites use the public package API.
- The editor is usable at phone, tablet, and desktop sizes.
- Keyboard-only users can write, switch modes, use toolbar commands, and recover focus.
- Large document smoke tests meet target latency well enough for MVP.

## Recommended First Dispatch

Start with four subagents plus coordinator:

- Foundation: scaffold workspace, extract codec, define core API types.
- CodeMirror: build raw Markdown editor and lifecycle API against draft core types.
- Renderers: build renderer registry with Shiki/Mermaid/PlantUML interfaces.
- QA/Examples: create test matrix and a minimal gallery harness that other lanes can plug into.

Defer the WYSIWYG lane until the core API, codec, and CodeMirror lifecycle are stable enough to avoid rework.
