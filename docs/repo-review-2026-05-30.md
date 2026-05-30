# Repository Review & Test-Rigor Plan — markdown-editor

**Date:** 2026-05-30
**Reviewer:** full-repo sweep (controls/UX, WYSIWYG + codec + renderers, and an automated-test-rigor audit)
**Commit base:** `8c7cb03` (cleanup)
**Scope:** `packages/{core,react,codemirror,renderers,wysiwyg-lexical}/src` + their tests, and `examples/dev-harness/e2e`.
**Primary goal of this plan:** add **significant automated test rigor to the editor controls** (toolbar buttons, keyboard shortcuts, formatting commands, markdown input rules, mode switching, list/property widgets). That plan is §5 — the centerpiece.

---

## 1. Executive summary

The **foundation is solid and well-tested**: the core codec round-trips a 34-fixture corpus byte-identically, the renderer registry isolates Mermaid/PlantUML/Shiki failures, and the CodeMirror **hybrid block-reveal + frontmatter properties widget** has a genuinely strong jsdom suite (`markdown-editor-view.test.ts`, ~18 cases). The **interactive control surface is the weak spot**, and the weakness is concentrated in exactly two places:

1. **`@markdown-editor/react` has zero runtime tests.** Its `test` script is `tsc -p tsconfig.test.json --noEmit`, and `test/public-api.test.tsx` is a *type-only* file (it constructs JSX and calls `.toUpperCase()` on types — never executed, no assertions, no jsdom/RTL). The mode switcher, properties toggle, host-service search/upload toolbar, `Cmd/Ctrl+S`/`Escape` handlers, controlled-vs-uncontrolled state, and the imperative handle are **untested at runtime**.
2. **`@markdown-editor/wysiwyg-lexical` toolbar commands have only round-trip (codec) coverage.** `roundtrip.test.ts` drives a *headless* `createEditor` through the import/export transformers and one *pure* table function. It **never renders the toolbar, never dispatches `FORMAT_TEXT_COMMAND`, never invokes `setBlock`/`insertBlock`** — and `vitest.config.ts` sets `environment: 'node'`, so it *cannot* mount the live editor even if a test wanted to. ~16 toolbar controls + ~6 markdown input rules are untested (2 input rules have e2e smoke).

A structural fact worth stating up front (it corrects a common misconception): **CodeMirror defines no custom bold/italic/heading/list/indent commands or input rules.** Source/hybrid editing uses the stock `defaultKeymap + historyKeymap + searchKeymap` (`codemirror/src/index.ts:173`). The package's *own* interactive logic is hybrid block reveal + the frontmatter property widgets — which **are** well covered. **The real formatting-command product surface lives in the WYSIWYG (Lexical) toolbar**, which is the least-tested code in the repo.

Separately, the review found a **security gap that spans the render pipeline**: three `dangerouslySetInnerHTML` sites inject renderer/host HTML with **no sanitizer anywhere in the repo** (no DOMPurify/sanitize-html). For a library whose whole job is hosting untrusted document content, that is the top correctness/security item.

### Priority snapshot

| Pri | Theme | Gate |
|-----|-------|------|
| **P1** | Unsanitized HTML injection (3 sites); mode-switch destroys editor state; codec prototype-pollution + BOM; WYSIWYG round-trip losses | Correctness/security before wider adoption |
| **P2** | **Test rigor for controls** (React 0 runtime tests, WYSIWYG toolbar 0 control tests); a11y toolbar semantics; insert/tags/shortcut bugs | The core of this plan (§5) |
| **P3** | Perf on large docs, frontmatter edge cases, minor a11y/label nits, renderer info-leak | Hardening backlog |

> Note on numbering: this doc uses `Cn/Hn/Mn/Ln` IDs that map to the underlying review notes; the wave plan (§7) sequences them.

---

## 1b. Remediation status (2026-05-30, same-day)

Waves 0–2 of §7 were executed the same day. **Workspace runtime tests: 88 → 125; the React package went from 0 → 13 runtime tests; WYSIWYG 15 → 37.** All package typechecks (incl. dev-harness) pass.

| Wave | Items | Status |
|------|-------|--------|
| **0 — test infra unblock** | react vitest+jsdom; wysiwyg `node→jsdom` | ✅ Done. Added `dompurify` + `jsdom` (offline install), `vitest.config.ts` + shared `test/setup.ts` (Range/matchMedia polyfills) + a `react-dom`+`act` `mount` helper (no RTL needed). React `test` now runs vitest; the type-only `public-api.test.tsx` is kept for `typecheck`. Live CodeMirror **and** Lexical editors mount in jsdom. |
| **1 — security** | P1-1 (DOMPurify ×3), P1-3 (proto), P1-4 (BOM) | ✅ Done. `sanitizeDiagramHtml`/`sanitizePreviewHtml` route all three `dangerouslySetInnerHTML` sites through DOMPurify (fail-closed off-DOM); codec now strips `__proto__`/`constructor`/`prototype` onto a null-proto object and is BOM-aware. **+8 tests** (3 wysiwyg + 3 react sanitize/XSS-regression, 2 core proto/BOM). |
| **2 — control tests A** | backlog #1,#2,#3,#6,#7(partial) | ✅ Core done. **17 WYSIWYG toolbar control tests** drive a *real* editor: select text → click button / change select → assert exported markdown + `aria-pressed` (bold/italic/code + toggle-off; block-style H1/H2/quote/code; bullet/number/check lists; insert table/code/image; table-op active-table gating reveal/hide; toolbar a11y baseline). **8 React control tests**: mode switch (uncontrolled, controlled-no-op, same-mode no-op), `Cmd/Ctrl+S`+`Esc` shortcuts (with `preventDefault`), imperative handle (get/set markdown+mode, snapshot, insert, replace). |

**Technique proven:** the "control test" pattern works end-to-end in jsdom — a real toolbar click over a DOM selection produces the correct markdown via the editor's own export (verified: Bold over `hello` → `**hello**`). This is the reusable harness (`wysiwyg-lexical/test/harness.tsx`) for the remaining backlog.

**Not yet done (remaining backlog):** markdown **input-rule** typing tests (#5 — needs `beforeinput` simulation in jsdom or e2e), table-op *button* live path (#7 partial — pure fn already covered), host-service search/upload branches (#9), properties toggle + preview-error (#10), CodeMirror raw-keystroke tests (#8), property-based round-trip (#11), and the **editor-state correctness fixes** (Wave 3: mode-switch reconfigure-not-recreate P1-2, `insertMarkdown` dispatch P1-6, a11y radiogroup P2-1) + Playwright/axe expansion (#12). The jsdom collapsed-caret selection sync is imperfect, so a couple of insert tests use a full selection; true caret cases belong in e2e.

---

## 2. What the controls actually are (scope map)

Knowing the real surface is essential for a test plan that targets the right thing.

| Layer | File | Interactive controls that exist | Test status today |
|-------|------|----------------------------------|-------------------|
| **React wrapper** | `react/src/MarkdownEditor.tsx` (676 L) | Mode toggle (markdown/hybrid/preview/wysiwyg); properties show/hide; host-service link-search box + image upload; `Cmd/Ctrl+S` + `Escape`; imperative handle (`get/setMarkdown`, `get/setMode`, `get/setSelection`, `insertMarkdown`, `replaceMarkdown`, `getSnapshot`, `clearHistory`[no-op]); lazy WYSIWYG routing; preview render | **0 runtime tests** (type-only) |
| **CodeMirror view** | `codemirror/src/index.ts` (1663 L) | Document ops (get/set/insert/selection/readOnly/destroy); **stock CM6 keymaps** (undo/redo, typing — no custom formatting/input rules); hybrid block reveal (heading/list/link/wiki/table/image/callout/fence); arrow-nav into blocks; frontmatter delete-protection; **frontmatter properties table** (edit/add/remove/reorder/type-change/tags/schema pickers) | **Strong** jsdom suite for hybrid + properties; raw keystroke defaults unproven; drag-drop reorder, datetime/link type, name-rename UNTESTED |
| **WYSIWYG (Lexical)** | `wysiwyg-lexical/src/index.tsx` (2152 L) | **Toolbar**: bold/italic/inline-code; block `<select>` (P/H1–H6/quote/code); list buttons (bullet/number/check); insert `<select>` (code/table/image/mermaid/plantuml); table-op buttons (R±/C±); code-language `<select>`; diagram/image edit→Apply; **markdown input rules** (`# `, `- `, `**`, `>`, ```` ``` ````, `[ ]`, `1.`); active-state sync (`aria-pressed`) | **Round-trip codec only**; toolbar buttons/input rules effectively **0 control tests** (`environment:'node'` blocks live tests) |
| **Core codec** | `core/src/codec.ts` (117 L) | parse/serialize/replaceBody/frontmatter split | **Strong** (34-fixture byte-identical corpus) — but no prototype-pollution/BOM cases |
| **Renderers** | `renderers/src/*` | markdown→HTML, shiki, mermaid, plantuml, registry | **Good** failure-isolation coverage; no XSS-regression test |

---

## 3. Prioritized issues (correctness / UX / security)

Each item: location, problem, fix. Tag: **NEW** (this review).

### P1 — Correctness & security

#### P1-1 · Unsanitized HTML injected at 3 sites — XSS exposure — NEW
- **Where:** `react/src/MarkdownEditor.tsx:631` (preview), `wysiwyg-lexical/src/index.tsx:1413` (Mermaid), `:1507` (PlantUML). **No DOMPurify/sanitizer exists anywhere in the repo** (verified).
- **Problem:** Each site does `dangerouslySetInnerHTML={{__html: html}}` where `html` comes from a renderer/host. The preview concatenates *registry* renderer output (extensible; the default PlantUML path forwards host HTML verbatim). A host renderer that returns attacker-influenced markup (an SVG with `<script>`/`onload`, an echoed PlantUML proxy) executes in the editor origin. Mermaid's `securityLevel:'strict'` is good but is the *only* defense and isn't backed by a regression test.
- **Fix:** Add DOMPurify (`USE_PROFILES:{svg:true,html:true}`) at all three injection boundaries (or sanitize inside `renderMarkdownToHtml` + each diagram node). Add an XSS-regression test asserting a malicious diagram/host payload is neutralized.

#### P1-2 · Mode switch destroys and recreates the CodeMirror view — loses selection/scroll/undo — NEW
- **Where:** `react/src/MarkdownEditor.tsx:137-180` (effect keyed on `activeMode`, and on `showProperties`/`normalizedFrontmatterDisplay`).
- **Problem:** Toggling markdown↔hybrid (or toggling the properties panel) runs `handle.destroy()` and rebuilds a fresh `EditorView` from `markdown` — cursor, selection, scroll offset, and the entire undo/redo stack are lost every time. `clearHistory()` is already a documented no-op, compounding the surprise.
- **Fix:** Reconfigure the existing view via a `Compartment` (`modeCompartment.reconfigure(...)`) and carry selection/scroll across, instead of tearing it down.

#### P1-3 · Frontmatter carries `__proto__`/`constructor` to consumers — NEW
- **Where:** `core/src/codec.ts` (frontmatter returned straight from `matter().data`).
- **Problem:** gray-matter/js-yaml produce **own enumerable** `__proto__`/`constructor` keys from a hostile document. js-yaml 3.14 doesn't pollute the global prototype, but a consumer that spreads (`{...fm}` re-invokes the `__proto__` setter → real pollution), `Object.assign`es, or `for…in`-walks frontmatter can be corrupted. (This is the same class of bug fixed in the knowledge-e3 codec.)
- **Fix:** Build frontmatter on `Object.create(null)` and strip `__proto__`/`constructor`/`prototype`; add a fixture.

#### P1-4 · Codec is BOM-blind — NEW
- **Where:** `core/src/codec.ts:8` — `FRONTMATTER_FENCE = /^---\r?\n/`.
- **Problem:** A leading UTF-8 BOM (or leading whitespace) defeats the fence, so a BOM'd file parses as bodyless with `hasFrontmatter:false` and empty `frontmatter` (round-trip stays byte-stable, so the corpus test hides it). (Same as knowledge-e3 #57.)
- **Fix:** Strip/handle a leading `﻿` before the fence test; re-attach to raw frontmatter for round-trip; add a BOM fixture.

#### P1-5 · WYSIWYG round-trip silently loses inline HTML, callouts, and table alignment — NEW
- **Where:** `wysiwyg-lexical/src/index.tsx:1664-1684` (import strips frontmatter, body → Lexical), `:2026` (table delimiter hard-coded `---`), `:2057-2068` (cell text flattened).
- **Problem:** No transformer for raw/inline HTML (`<details>`, `<span data-…>`) → flattened to text or dropped. Callouts (`> [!warning]`) degrade to plain blockquotes (marker lost). GFM table column alignment (`:--:`) is parsed but never stored, so it's lost on export. Inline formatting inside table cells collapses to plain text. `roundtrip.test.ts` has **no** callout/inline-HTML/nested-list/wiki-link case.
- **Fix:** Add transformers for callouts + a raw-HTML passthrough node; capture/re-emit table alignment; serialize cell inline nodes. Where loss is accepted, pin it as an explicit golden and **document** it.

#### P1-6 · `insertMarkdown` dispatch is malformed — scroll + user-event attribution dropped — NEW
- **Where:** `codemirror/src/index.ts:138-145`.
- **Problem:** `view.dispatch(view.state.replaceSelection(text), {scrollIntoView, userEvent})` passes a second arg that CM6 ignores, so host inserts (image upload, link pick) don't scroll into view and are mis-attributed as `programmatic` (M-tier `onChange.source` is then wrong, confusing host dirty/save logic).
- **Fix:** `view.dispatch(view.state.update(view.state.replaceSelection(text), {scrollIntoView:true, userEvent:'input'}))`.

### P2 — UX, accessibility, control bugs

#### P2-1 · Mode toggle / toolbar advertise interaction semantics they don't implement (a11y) — NEW
- **Where:** `react/src/MarkdownEditor.tsx:331-353` (`role="toolbar"` + `aria-pressed` toggle buttons).
- **Problem:** A mutually-exclusive mode selector is exposed as independent `aria-pressed` buttons, and `role="toolbar"` promises arrow-key roving focus that isn't implemented (Tab steps through every button). Screen-reader users don't hear a single-choice group. WYSIWYG toolbar has the same toolbar-without-roving issue.
- **Fix:** Use `role="radiogroup"`/`role="radio"` (or tablist) with roving `tabindex` + arrow-key nav for the mode selector; implement roving focus in the toolbars or downgrade to `role="group"`.

#### P2-2 · Save/Escape shortcuts are dead in preview/wysiwyg and over-eager preventDefault — NEW
- **Where:** `react/src/MarkdownEditor.tsx:200-217` (listener on `hostRef`, only present for CM modes; `Ctrl/Cmd+S` calls `preventDefault` even with no handler; `Escape` never `preventDefault`s).
- **Fix:** Attach to the always-present outer `<section>`; only `preventDefault` save when `onSaveShortcut` is set.

#### P2-3 · Tags input double-adds on Enter+blur — NEW
- **Where:** `codemirror/src/index.ts:1475-1495` — Enter commits without clearing `input.value`, then blur re-commits the same tag.
- **Fix:** Clear the input after the Enter commit (or guard blur against an already-committed value).

#### P2-4 · `findFrontmatterRange` can mistake a body `---` thematic break for the frontmatter closer — NEW
- **Where:** `codemirror/src/index.ts:520-543`.
- **Problem:** Any doc whose first line is `---` is treated as frontmatter open; the next `---` anywhere becomes the closer, so a large body span can be swallowed by the properties widget.
- **Fix:** Require the closer within a bounded window and only treat line-1 `---` at doc start as frontmatter.

#### P2-5 · Rendered-block/link widgets reset caret to block start on click — NEW
- **Where:** `codemirror/src/index.ts:1082-1087, 1578-1592` — mousedown always moves caret to `this.from` and `preventDefault`s, so users can't click-place mid-block or select inside a rendered region.
- **Fix:** Map the click coordinate via `view.posAtCoords` and place the caret there.

#### P2-6 · Hybrid decorations rebuild on every cursor move (large-doc perf) — NEW
- **Where:** `codemirror/src/index.ts:239-243, 270-389` — `StateField.update` does a full O(lines) walk + per-line regex on every selection change.
- **Fix:** Rebuild only when the active line changes and/or restrict to the viewport.

#### P2-7 · Properties toggle resets when `frontmatterDisplay` prop changes — NEW
- **Where:** `react/src/MarkdownEditor.tsx:182-184` — an effect re-syncs the user's explicit toggle to the prop-derived default on any host re-render touching `frontmatterDisplay`.
- **Fix:** Separate the user toggle from the prop default (or make it a controlled prop).

### P3 — Lower priority (hardening)

- **P3-1** Renderer diagnostics embed raw `cause` (stack/source) returned to host — `renderers/src/registry.ts:179` — info-leak; serialize `message`/`code` only.
- **P3-2** Shiki highlighter-init failure isn't caught on the retry path — `renderers/src/shiki.ts:88-99` — wrap the second `getHighlighter()`.
- **P3-3** PlantUML privacy: default path sends diagram source to a remote server with no consent gate/allowlist — `renderers/src/plantuml.ts` — document + gate behind explicit opt-in.
- **P3-4** Image `src` not scheme-validated in WYSIWYG — `wysiwyg-lexical/src/index.tsx:1583` — allowlist `http(s)`/`data:image/*`.
- **P3-5** Minor a11y/label nits: alt-text escaping misses `[`/`(`/`)` (`MarkdownEditor.tsx:673`); `aria-expanded` reflects suggestion count not popup visibility (`:517`); drag handle has no announced shortcut (`index.ts:1167`).
- **P3-6** `parseFrontmatter` drops malformed/nested YAML lines on round-trip through the properties table — `codemirror/src/index.ts:749-755` — preserve unrecognized lines.

---

## 4. UX problems (consolidated, by impact)

1. **Mode switch loses your place** (P1-2) — selection, scroll, and undo vanish on every toggle; the single most jarring everyday behavior.
2. **Host inserts don't scroll into view and look "programmatic"** (P1-6).
3. **Toolbars aren't keyboard/AT navigable as advertised** (P2-1) — fails the accessibility posture the docs claim "ready for MVP smoke."
4. **Save/cancel shortcuts silently dead in preview/WYSIWYG** (P2-2).
5. **Can't click-place the caret inside a rendered hybrid block** (P2-5).
6. **Tags can double-add** (P2-3); **properties panel reopens itself** (P2-7).
7. **Sluggish typing on very large docs** (P2-6).
8. **Silent fidelity loss** in WYSIWYG for callouts/inline-HTML/table alignment (P1-5) — users discover it only after a save mangles their doc.

---

## 5. Test-rigor plan for the controls (the centerpiece)

The goal: every user-facing control is proven by an automated test that **drives a real editor instance, performs the control the way a user would, and asserts the resulting markdown + selection + reflected control state.**

### 5.1 Coverage map (today)

Legend: ✅ tested · 🟡 indirect/partial · ❌ none. Layers U=unit, C=component, E=e2e.

**React wrapper (`MarkdownEditor.tsx`) — 0 executable tests:**

| Control | U | C | E | Note |
|---|---|---|---|---|
| Mode-switch buttons | ❌ | ❌ | 🟡 | e2e via harness only; component never isolated |
| Controlled vs uncontrolled `mode` | ❌ | ❌ | ❌ | override + `onModeChange` payload unproven |
| Properties show/hide toggle | ❌ | ❌ | ❌ | |
| `Cmd/Ctrl+S` save / `Escape` cancel | ❌ | ❌ | ❌ | host-contract callbacks never fired |
| Host link-search / image-upload | ❌ | ❌ | 🟡 | harness happy-path only; abort/error untested |
| Imperative handle (set/get/insert/replace/snapshot) | ❌ | ❌ | ❌ | **type-checked only** |
| Lazy WYSIWYG routing / preview error fallback | ❌ | ❌ | 🟡 | |

**WYSIWYG toolbar (`wysiwyg-lexical`) — 0 control tests (blocked by `environment:'node'`):**

| Control | Status |
|---|---|
| Bold / Italic / Inline-code (`FORMAT_TEXT_COMMAND`) | ❌ never clicked |
| Block `<select>` (P/H1–H6/quote/code; `$setBlocksType`) | ❌ |
| List buttons (bullet/number/check) | ❌ (import shape only) |
| Insert `<select>` (code/table/image/mermaid/plantuml) | ❌ |
| Table-op buttons (R±/C±) | 🟡 pure fn only, not the button→command→active-table path |
| Markdown input rules (`#`,`-`,`**`,`>`,```` ``` ````,`[ ]`,`1.`) | 🟡 only `# ` and `- ` have e2e smoke |
| Active-state sync (`aria-pressed`/`activeBlock`) | 🟡 presence asserted, not flipping |
| Code-language `<select>`, diagram/image edit→Apply | ❌ |

**CodeMirror (`codemirror`) — strong, with gaps:** document ops ✅, hybrid reveal ✅, arrow-nav ✅, frontmatter delete-protection ✅, properties widget (edit/add/remove/reorder/boolean/date/time/schema) ✅; **UNTESTED:** raw keystroke defaults (undo/redo, list-continuation, Tab indent — relied upon, never proven), drag-drop reorder, datetime/link type controls, name-rename menu, tags backspace/blur.

**Core/renderers — good** (not controls): codec corpus ✅, renderer failure isolation ✅. Gaps: prototype-pollution/BOM (P1-3/4), XSS-regression (P1-1), Shiki init-failure (P3-2).

**Quantified gap:** React control tests = **0** (~11 controls). WYSIWYG toolbar control tests = **0** (~16 controls + ~6 input rules; 2 rules have e2e smoke). No WYSIWYG toolbar button is clicked-and-asserted anywhere (unit/component/e2e).

### 5.2 Biggest gaps, ranked by risk × likelihood

1. **WYSIWYG inline/block/list/insert toolbar buttons** — richest interactive surface, 0 tests, will silently break on a Lexical bump.
2. **React mode-switch + controlled/uncontrolled state** — the component's core job; untested.
3. **React `Cmd/Ctrl+S` / `Escape`** — host-facing callbacks with platform key logic.
4. **WYSIWYG input rules beyond `#`/`-`** — `**`, `>`, fence, `[ ]`, `1.`.
5. **React imperative handle** — type-checked only; no behavioral proof.
6. **WYSIWYG table-op buttons + active-table gating** — only the pure transform is tested.
7. **CodeMirror raw-formatting/list/indent keystrokes** — stable but assumed, not proven.

### 5.3 Tooling to add (two config unblocks first)

1. **`@markdown-editor/react`: add a real runtime stack** (currently none). Add `vitest.config.ts` (`environment:'jsdom'`), `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`. Change `test` from `tsc … --noEmit` to `vitest run` (keep the type file as a separate `typecheck` step). Extract the `Range.getClientRects`/`getBoundingClientRect` jsdom polyfill from `codemirror/test/markdown-editor-view.test.ts:5-18` into a shared `test/setup.ts` (CodeMirror-in-React needs it).
2. **`@markdown-editor/wysiwyg-lexical`: flip `environment:'node'` → `'jsdom'`** and widen `include` to `*.tsx`. **This single change unblocks every toolbar test.** Add `@testing-library/react` + `user-event` + the same Range polyfill; use `@lexical/headless` + `createEditor` for command-level tests where DOM rendering is overkill.
3. **`@markdown-editor/codemirror`: already jsdom** — just add keystroke tests with the existing `EditorView`-driven pattern.
4. **`examples/dev-harness` (Playwright): already present** — expand for true toolbar click/keyboard interaction; add `@axe-core/playwright` to back the accessibility claims.
5. **Cross-cutting:** add `fast-check` to `core` and `wysiwyg-lexical` for round-trip invariants; promote `core/test/fixtures/*.md` to a shared corpus (tiny internal `@markdown-editor/test-fixtures` package).

### 5.4 The "control test" pattern (one shape, three layers)

```
arrange:  mount a real editor with known markdown + selection
act:      dispatch the control as a user would —
            component: userEvent.click(button) / selectOptions / keyboard('{Meta>}b{/Meta}')
            command:   editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')   // headless Lexical
            CM:        view.dispatch(...)  or dispatch a real KeyboardEvent
assert:   (1) exported markdown === golden
          (2) selection/caret is where expected
          (3) reflected control state (aria-pressed / activeBlock / <select> value)
```

The same `(input.md, action, expected.md)` fixture triple is asserted at the fast component layer **and** confirmed thinly at e2e — proven once cheaply, smoke-confirmed once for real, not duplicated.

### 5.5 Round-trip & property-based testing

- **Codec:** keep the byte-identical corpus; add `fast-check` generators (headings, nested lists, tables, inline marks) asserting `parse∘serialize` identity/idempotence.
- **WYSIWYG:** property-based `markdown → import → export` idempotence (second round-trip is a fixed point) on the canonical subset; pin accepted normalizations (alignment, etc.) as explicit goldens.
- **Golden files:** store control cases as data triples so adding a case = adding a file; treat snapshot churn as a review gate.

### 5.6 Prioritized test backlog (risk-reduction per effort)

Do the **two config unblocks (5.3 #1, #2) first**, then:

| # | Suite | Layer | ~Cases | Asserts |
|---|-------|-------|--------|---------|
| 1 | WYSIWYG inline-format buttons (bold/italic/code) | component | 8 | export gains `**`/`*`/`` ` ``; `aria-pressed` flips; toggles off |
| 2 | WYSIWYG block `<select>` + list buttons | component | 12 | `# `/`> `/fence/`- `/`1. `/`- [ ] ` in export; `activeBlock` tracks caret |
| 3 | React mode switching + controlled/uncontrolled | component | 10 | each button → `data-mode` + correct surface + `onModeChange` payload; controlled `mode` overrides |
| 4 | React save/cancel shortcuts | component | 5 | Ctrl+S & Meta+S → `onSaveShortcut` + `preventDefault`; Esc → cancel; no fire on plain `s` |
| 5 | WYSIWYG markdown input rules | component (typing) | 7 | `**`,`>`,fence,`[ ]`,`1.`,`## ` produce correct export, markers not escaped |
| 6 | React imperative handle behavior | component | 9 | set/get markdown+mode+selection, insert/replace fire `onChange{source}`, snapshot |
| 7 | WYSIWYG insert `<select>` + table-op buttons (live) | component | 10 | insert blocks; R±/C± reshape table; op group only when a table is active |
| 8 | CodeMirror raw keystrokes (undo/redo, list-continue, Tab indent) | component | 8 | proves the relied-upon CM6 defaults yield expected markdown |
| 9 | React host-service search/upload branches | component | 8 | resolve/reject/abort → list/"No matches"/`onDiagnostics`; upload success/failure |
| 10 | React properties toggle + preview error fallback | component | 5 | toggle flips frontmatter mode; renderer reject → `me-preview-error` + diagnostic |
| 11 | Codec + WYSIWYG property-based round-trip | unit (fast-check) | 6 props | parse∘serialize identity; WYSIWYG export idempotence |
| 12 | e2e: real toolbar clicks + axe a11y scan | Playwright | 12 | real Bold/list/insert/table clicks → markdown; keyboard-only toolbar; axe on `/examples`,`/modes`,`/renderers` |

**Suites 1–7 alone close every "0-test control" gap.** Suites 8/11 harden the foundation; 12 is the thin real-browser confirmation.

---

## 6. Suggested implementation improvements (beyond bugs)

- **Reconfigure, don't recreate** the CM view across mode/properties changes (fixes P1-2 and the perf cost of teardown). Use `Compartment`s for `mode`, `readOnly`, `frontmatter` config.
- **One sanitizer boundary.** Add DOMPurify once in a shared `renderers` helper and route all three injection sites through it (P1-1) — also lets the XSS-regression test target a single function.
- **Centralize the insert path.** The React wrapper has three subtly different insert/update code paths (`MarkdownEditor.tsx:247-253/296-307/309-321`); unify them so user-event attribution and separator handling are consistent (supports P1-6).
- **Make `clearHistory()` real or remove it** — a silent no-op on a documented API is a foot-gun.
- **Decompose `FrontmatterPropertiesWidget.toDOM`** (~110 L imperative) and `createNameMenu` (~100 L) so the name-rename and type-change controls become unit-testable in isolation (supports suite #2/#7-adjacent CM gaps).
- **Document the WYSIWYG lossy constructs** (callouts, inline HTML, table alignment) until transformers land — set host expectations.

---

## 7. Suggested plan (waves)

One PR per wave; each ships with the named tests. The two config unblocks gate the test waves.

| Wave | Theme | Items | Gate |
|------|-------|-------|------|
| **0 — test infra unblock** | Add react vitest+jsdom+RTL; flip wysiwyg to jsdom; shared `test/setup.ts` + fixtures package | 5.3 #1–#2, #5 | `pnpm -r test` runs real tests in react + wysiwyg |
| **1 — security** | DOMPurify at all 3 inject sites + XSS-regression test; codec prototype-pollution + BOM (+ fixtures) | P1-1, P1-3, P1-4 | XSS payload neutralized; proto/BOM fixtures green |
| **2 — control tests A (highest risk)** | WYSIWYG inline/block/list/insert + input rules; React mode/shortcuts/imperative | backlog #1–#6 | every 0-test control now asserted |
| **3 — editor-state correctness** | CM reconfigure-not-recreate; `insertMarkdown` dispatch; tags double-add; click-to-position | P1-2, P1-6, P2-3, P2-5 | mode-switch preserves selection/undo (new test) |
| **4 — control tests B + a11y** | WYSIWYG table-ops live; host-service branches; properties/preview; toolbar radiogroup/roving + axe | backlog #7,#9,#10,#12; P2-1, P2-2 | axe clean on 3 routes; toolbar keyboard-navigable |
| **5 — WYSIWYG fidelity** | Callout + raw-HTML transformers; table alignment; cell inline serialization | P1-5 | new round-trip goldens for callout/HTML/alignment |
| **6 — hardening** | Large-doc decoration perf; frontmatter range/parse edge cases; renderer info-leak/privacy; CM keystroke + property-based suites | P2-4,P2-6,P2-7,P3-*; backlog #8,#11 | perf smoke; fast-check green |

**Rough effort:** Wave 0 ~0.5 day; each control-test wave ~1–1.5 days; security ~0.5 day; fidelity ~1–2 days. The test-rigor objective (Waves 0,2,4 + suites in 6) is ~4–5 focused days and closes every untested control.

**Standing gate:** `pnpm -r build && pnpm -r typecheck && pnpm -r test` + `pnpm test:e2e`.

---

## 8. What's already good (no action)

- Core codec: 34-fixture byte-identical round-trip; honest frontmatter/body/empty/invalid-YAML coverage.
- CodeMirror hybrid block-reveal + frontmatter properties widget: a genuinely strong jsdom suite — the model to copy for the other layers.
- Renderer registry: clean failure isolation (Mermaid/PlantUML/Shiki) with timeouts and fallbacks; Mermaid runs `securityLevel:'strict'`.
- Playwright harness already exercises mode switching, the six example shells, controlled value, and read-only across desktop + mobile Chromium.
- Documentation discipline (`test-matrix.md`, `release-readiness.md`, `post-mvp-qa.md`) is evidence-based and honestly labels type/smoke vs behavioral coverage — which is exactly why this plan's gaps were easy to locate.
