---
type: test-matrix
project: "markdown-editor"
status: ready_for_review
updated: 2026-05-14
scope: "MVP gates"
owner: "QA/Examples lane"
---

# Test Matrix

This matrix expands the MVP gates from `docs/mvp-implementation-plan.md` into concrete checks. Status values are evidence-based: implemented means there is committed automated coverage or a documented manual check in `docs/release-readiness.md`; partial means useful coverage exists but the full gate is not yet enforced.

## Gate Definitions

| Gate | Required for MVP | Check Type | Owner | Status |
| --- | --- | --- | --- | --- |
| G0 contracts are stable enough for parallel work | Phase 0 | Review, typecheck once packages exist | Coordinator, QA | Implemented: public types and package imports are covered by package typecheck tests. |
| Core Markdown bytes survive no-op parse/serialize | Phase 1 | Unit | Foundation, QA | Implemented: `packages/core/test/codec.test.ts` round-trips the fixture corpus byte-identically. |
| Frontmatter and body replacement preserve source | Phase 1 | Unit | Foundation, QA | Implemented: `packages/core/test/codec.test.ts` covers raw frontmatter preservation, body replacement, empty docs, and invalid YAML recovery. |
| Mode adapters never initialize to empty/undefined Markdown | Phase 1+ | Contract, integration | Engine lanes, QA | Implemented for MVP: mode matrix and example Playwright coverage proves content survives configured mode routes and controlled updates. |
| Invalid input fails soft, not with document crash | Phase 1+ | Unit, integration | Foundation, Renderers, QA | Implemented for MVP: invalid YAML, unknown code language, Mermaid failure, PlantUML failure, and synchronous hybrid renderer failure paths are covered. |
| Raw Markdown editing works on realistic fixtures | Phase 2 | Playwright, performance | CodeMirror, QA | Implemented for MVP: jsdom editing coverage plus Playwright controlled value, read-only, and typing smoke coverage. |
| Renderers isolate async failures | Phase 3 | Unit, integration, Playwright | Renderers, QA | Implemented for MVP renderer paths: renderer unit tests plus `/renderers` Playwright coverage. |
| Mode switching preserves exact Markdown where expected | Phase 4+ | Integration, Playwright | CodeMirror, React UX, QA | Implemented for MVP: visible switching, controlled propagation, renderer source preservation, and package round-trip gates are covered. |
| Public React API supports required host shapes | Phase 5+ | Integration, Playwright | React UX, QA | Implemented for MVP: public API type tests plus mode/example Playwright coverage for controlled, read-only, renderer, icon-slot, and imperative host shapes. |
| Required examples use public package APIs only | Phase 7+ | Static review, Playwright smoke | React UX, QA | Implemented: required and stretch shells are in `/examples` and exercised by Playwright; source review notes are in `docs/release-readiness.md`. |
| Accessibility and responsive gates pass | Phase 5+ | Playwright, manual audit | React UX, QA | Implemented for MVP: keyboard/ARIA, reduced-motion, read-only chrome, and phone/tablet/desktop overflow checks are committed; deeper axe/screen-reader certification is post-MVP. |
| MVP performance smoke stays within targets | Phase 2+ | Playwright perf smoke | Engine lanes, QA | Implemented for MVP: mode-switch and typing smoke checks are committed with conservative latency bounds; deeper trace-based perf budgets are post-MVP. |

## Unit Checks

| Area | Check | Fixture/Input | Expected Result | Phase |
| --- | --- | --- | --- | --- |
| Codec no-op | `parseMarkdown` then `serializeMarkdown` | Plain prose, headings, links, lists, tables, code fences | Output bytes match input bytes | 1 |
| Codec frontmatter | `splitFrontmatter` on YAML frontmatter | Valid YAML frontmatter plus body | Raw frontmatter bytes and body offsets preserved | 1 |
| Invalid frontmatter | Parse malformed frontmatter fences | Unclosed fence, bad YAML, body-only document | Parser returns diagnostics and usable body; no throw | 1 |
| Body replacement | `replaceBody` | Frontmatter plus body, body-only document | Frontmatter remains byte-identical; only body changes | 1 |
| Empty document | Parse and serialize empty string | `""` | Empty string survives; no undefined/null output | 1 |
| Fixture corpus | Round-trip normalized corpus | Knowledge E3 corpus categories once imported | No-op fixtures pass byte-identically unless explicitly marked | 1 |
| Diagnostic shape | Invalid Markdown-adjacent constructs | Broken links, bad frontmatter, invalid diagrams as text | Diagnostics use exported diagnostic types; document remains usable | 1 |
| Renderer registry | Register/resolve renderers | Known block type, unknown block type | Known renderer resolves; unknown falls back safely | 3 |
| Shiki fallback | Highlight unknown language | ```unknown-lang fence | Plaintext render with language label, no throw | 3 |
| Mermaid failure | Render invalid diagram source | Invalid Mermaid fence | Inline error state; sibling blocks still render | 3 |
| PlantUML boundary | Missing host renderer | PlantUML fence without `hostServices.renderPlantUml` | Inline unavailable state; no network assumption in core | 3 |
| WYSIWYG import/export | No-op through Lexical adapter | MVP block fixture corpus | Byte-identical for accepted no-op set; documented canonicalization otherwise | 6 |

## Integration Checks

| Area | Check | Harness Surface | Expected Result | Phase |
| --- | --- | --- | --- | --- |
| Package imports | Downstream packages import core public types | Build/typecheck | `EditorMode`, snapshots, renderer contracts import from public exports | 1 |
| Adapter initialization | Engine receives initial value | Dev harness route for each mode | Editor never emits undefined, null, or accidental empty Markdown on init | 1+ |
| Controlled value | Host updates `value` after mount | Markdown route | Visible document updates without duplicate change events | 2/5 |
| Read-only | Host toggles read-only | Markdown route | Typing and commands do not mutate source; selection/focus still usable | 2/5 |
| Mode config | Hosts allow subset of modes | Mode matrix route | Only configured modes appear and function | 5 |
| Renderer injection | Host supplies registry/services | Renderer route | Custom renderer path used; missing service produces inline fallback | 3/5 |
| Host callbacks | Save/cancel/navigation callbacks | API route | Callback payloads include source Markdown and metadata | 5 |
| WYSIWYG disabled | App excludes WYSIWYG mode | Mode matrix route | No WYSIWYG load path required unless enabled | 6 |
| Example isolation | Examples use public API only | Example gallery routes | No imports from package internals or source-only paths | 7 |

## Playwright Checks

| Scenario | Viewport(s) | Steps | Expected Result | Phase |
| --- | --- | --- | --- | --- |
| Dev harness loads | 390px, 768px, 1440px | Open `/`, navigate routes | No console errors; route content visible | 0 |
| Markdown typing | 1440px | Type prose, undo, redo | Source changes predictably; undo/redo restore text | 2 |
| Selection restore | 1440px | Select text, apply bold, switch route/mode | Selection/focus restore to editor surface | 2/5 |
| External value update | 768px | Trigger sample document control | Editor updates once and preserves configured mode | 2/5 |
| Hybrid reveal | 390px, 1440px | Click rendered inactive block | Active block shows raw source; leaving block restores render | 4 |
| Preview read-only | 390px, 1440px | Try keyboard input in preview-only route | No source mutation; links/buttons remain reachable | 4/5 |
| Renderer failures | Mobile Chromium, desktop Chromium | Load invalid Mermaid samples | Error panel appears inline; page/editor remains interactive | 3/4 - initial coverage added |
| Wiki-link completion | 1440px | Type `[[` and query | Host-backed options appear; unresolved link styling visible | 4 |
| Required examples | 390px, 1440px | Visit each required example shell | Each shell renders with public API and no overflow-breaking layout | 7 - initial coverage added |
| Example mode options | Mobile Chromium, desktop Chromium | Assert all-modes controls, split markdown/preview surfaces, single-mode focused shells, read-only chrome, and compact editing | Configured options render and host state updates through public APIs | 7 - initial coverage added |
| Example toolbar icons | Mobile Chromium, desktop Chromium | Visit WYSIWYG-only contributor shell and inspect toolbar SVGs | Host-supplied Font Awesome icons render inside graphical toolbar controls | 7 - initial coverage added |
| Mode matrix switching | Mobile Chromium, desktop Chromium | Switch the all-modes route among hybrid, markdown, preview, and WYSIWYG | Content remains visible and the correct mode-specific surface appears | 4/5 - initial coverage added |
| Renderer route behavior | Mobile Chromium, desktop Chromium | Visit renderer fixture route | Shiki-highlighted code, Mermaid, PlantUML, tables, callouts, unsupported-language diagnostics, and invalid Mermaid fallback render | 3/4 - initial coverage added |
| No-op save | 1440px | Load fixture, switch modes, save | Saved Markdown equals initial Markdown for no-op paths | 4+ |

## Accessibility Checks

| Area | Check | Expected Result | Phase |
| --- | --- | --- | --- |
| Toolbar semantics | Inspect roles and labels | Toolbar controls have accessible names, grouping, and `aria-pressed` where stateful | 5 |
| Keyboard-only editing | Tab through app and use commands | User can focus editor, write, use toolbar, switch modes, and save without mouse | 5 |
| Focus restoration | Switch modes and close overlays | Focus returns to the most relevant editor/control surface | 5 |
| Reduced motion | Enable reduced motion media query | Animated transitions are disabled or simplified | 5 |
| Contrast | Run automated contrast checks and manual spot check | Text, controls, selections, and error states meet WCAG AA targets | 5+ |
| Error announcements | Renderer and validation errors | Inline error states are reachable and announced without stealing focus | 3/5 |
| Small viewport operation | 390px keyboard navigation | Controls remain reachable; no horizontal page overflow from core chrome | 5/7 |

## Performance Checks

| Area | Target | Measurement | Phase |
| --- | --- | --- | --- |
| Raw editor mount | Establish baseline in Phase 2, enforce before RC | Playwright `performance.mark` around mount on 1k and 10k line fixtures | 2 |
| Typing latency | p95 under 50ms on 1k line fixture for MVP smoke | Input event to visible update in Playwright trace/perf marks | 2 |
| Large document typing | No catastrophic degradation on 10k line fixture | Smoke typing sample and trace review | 2 |
| Mode switch | No-op switch completes without source churn or visible lockup | Mark mode switch start/end and compare source before/after | 4 |
| Hybrid layout stability | No major jump on common block transitions | Playwright visual/layout measurements around active block changes | 4 |
| Shiki lazy load | Highlighter loads on first code block, not initial empty editor | Resource timing and UI loading state | 3 |
| Mermaid timeout | Invalid/slow diagram exits through timeout path | Controlled slow renderer fixture | 3 |
| Example gallery | Required routes load within MVP baseline | Route-level smoke timing on desktop/mobile | 7 |

## Phase 0/1 Exit Checklist

- `docs/test-matrix.md` exists and names concrete checks for unit, integration, Playwright, accessibility, and performance coverage.
- The dev harness can run as a standalone Vite React app without package internals.
- Harness routes exist for the surfaces later lanes will replace with real `MarkdownEditor` usage.
- Placeholder UI clearly separates planned controls from implemented package behavior.
- Future QA commands are documented in the harness package scripts.
