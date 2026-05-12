---
type: test-matrix
project: "markdown-editor"
status: draft
updated: 2026-05-11
scope: "MVP Phase 0/1 gates"
owner: "QA/Examples lane"
---

# Test Matrix

This matrix expands the MVP gates from `docs/mvp-implementation-plan.md` into concrete checks. Phase 0/1 scope is to define the release gates and create enough harness surface for later lanes to plug in package implementations without depending on unstable internals.

## Gate Definitions

| Gate | Required for MVP | Check Type | Owner | Status |
| --- | --- | --- | --- | --- |
| G0 contracts are stable enough for parallel work | Phase 0 | Review, typecheck once packages exist | Coordinator, QA | Draft |
| Core Markdown bytes survive no-op parse/serialize | Phase 1 | Unit | Foundation, QA | Pending implementation |
| Frontmatter and body replacement preserve source | Phase 1 | Unit | Foundation, QA | Pending implementation |
| Mode adapters never initialize to empty/undefined Markdown | Phase 1+ | Contract, integration | Engine lanes, QA | Pending implementation |
| Invalid input fails soft, not with document crash | Phase 1+ | Unit, integration | Foundation, Renderers, QA | Pending implementation |
| Raw Markdown editing works on realistic fixtures | Phase 2 | Playwright, performance | CodeMirror, QA | Planned |
| Renderers isolate async failures | Phase 3 | Unit, integration, Playwright | Renderers, QA | Planned |
| Mode switching preserves exact Markdown where expected | Phase 4+ | Integration, Playwright | CodeMirror, React UX, QA | Planned |
| Public React API supports required host shapes | Phase 5+ | Integration, Playwright | React UX, QA | Planned |
| Required examples use public package APIs only | Phase 7+ | Static review, Playwright smoke | React UX, QA | Planned |
| Accessibility and responsive gates pass | Phase 5+ | Playwright, axe, manual keyboard pass | React UX, QA | Planned |
| MVP performance smoke stays within targets | Phase 2+ | Playwright perf marks | Engine lanes, QA | Planned |

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
| Renderer failures | 1440px | Load invalid Mermaid/PlantUML samples | Error panel appears inline; page/editor remains interactive | 3/4 |
| Wiki-link completion | 1440px | Type `[[` and query | Host-backed options appear; unresolved link styling visible | 4 |
| Required examples | 390px, 1440px | Visit each required example shell | Each shell renders with public API and no overflow-breaking layout | 7 |
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
