# React Code Review - markdown-editor

**Date:** 2026-06-07  
**Reviewer:** React-focused code review  
**Scope:** `packages/react`, its public contracts in `packages/core`, the CodeMirror adapter boundary, and the React package tests.  
**Change policy:** Review only. No source changes made.

---

## Executive Summary

The React package is a strong composition layer over focused internal packages:

- `@echozedlabs/core` owns public editor contracts and shared types.
- `@echozedlabs/codemirror` owns source and hybrid editing.
- `@echozedlabs/renderers` owns block rendering.
- `@echozedlabs/wysiwyg-lexical` owns rich text editing.
- `@echozedlabs/react` ties those surfaces into a single embeddable component.

That separation is the strongest architectural asset in the current code. The implementation is also moving in the right direction on security and behavior coverage: preview and hybrid rendering now share sanitization, controlled mode behavior is tested, stale async host-service search results are discarded, and the imperative handle has runtime coverage.

The main risks are now concentrated in the React wrapper lifecycle and API semantics. `MarkdownEditor.tsx` owns a lot of orchestration in one file, and some imperative paths can emit duplicate change events. The wrapper also recreates CodeMirror in cases where the lower-level adapter already supports in-place reconfiguration.

---

## Findings

### 1. Imperative updates can double-fire `onChange`

**Severity:** Medium  
**Location:** `packages/react/src/MarkdownEditor.tsx`

`updateMarkdown` calls:

```ts
cmRef.current?.setMarkdown(nextMarkdown, { emitChange: true });
```

and then emits `onChange` directly. In CodeMirror modes, `setMarkdown(..., { emitChange: true })` routes through the CodeMirror `onChange` callback, and the React wrapper emits another `onChange` immediately after.

`replaceMarkdown` compounds this by calling `updateMarkdown(...)` and then invoking `onChangeRef.current?.(...)` again.

**Why it matters:** Hosts commonly attach autosave, analytics, collaboration, dirty-state tracking, and validation to `onChange`. Duplicate events from a single imperative call can cause unnecessary saves, noisy diagnostics, or incorrect history.

**Suggested direction:** Choose a single event source per path. For imperative wrapper methods, either:

- call CodeMirror with `emitChange: false` and emit once from React, or
- let CodeMirror emit and remove the wrapper-level duplicate.

Add call-count assertions for `setMarkdown`, `replaceMarkdown`, `insertMarkdown`, and host insertion paths.

---

### 2. React recreates CodeMirror for mode/config changes even though the adapter supports in-place reconfiguration

**Severity:** Medium  
**Location:** `packages/react/src/MarkdownEditor.tsx`, `packages/codemirror/src/types.ts`

The React effect that creates CodeMirror is keyed on `activeMode`, `showProperties`, `normalizedFrontmatterDisplay`, `propertySchema`, `readOnly`, and `hybridRenderMarkdown`. When these change, the wrapper destroys the existing CodeMirror view and creates a new one.

The CodeMirror adapter already exposes `setMode(mode, hybridFrontmatterMode?)`, documented to preserve selection, scroll, and undo history.

**Why it matters:** Mode switches and frontmatter-display toggles are central interactions. Recreating the editor risks losing cursor position, scroll position, and undo/redo history during ordinary usage.

**Suggested direction:** Keep the CodeMirror view stable across markdown/hybrid and hybrid frontmatter display changes. Use the adapter's `setMode` and `setReadOnly` APIs where possible, and reserve destroy/recreate for true surface changes such as leaving CodeMirror for preview or WYSIWYG.

Add regression tests that assert selection survives:

- markdown to hybrid
- hybrid to markdown
- show/hide properties
- read-only toggle

---

### 3. Preview rendering does not respond to renderer registry changes

**Severity:** Medium  
**Location:** `packages/react/src/MarkdownEditor.tsx`

`PreviewSurface` stores `registry` in a ref, but the render effect only depends on `markdown`. If a host swaps renderer registries, renderer options, or host-backed diagram services while the markdown is unchanged, the preview can stay stale until content changes.

**Why it matters:** Advanced hosts are likely to change renderer behavior dynamically, especially for feature flags, tenant-specific renderers, theme-aware diagram output, or failed renderer fallback.

**Suggested direction:** Treat renderer identity as part of the render input. If avoiding unstable host callback loops is the concern, document that renderers must be stable and include the stable registry reference in dependencies, or expose an explicit preview-render key/version prop.

Add a test that rerenders with a different registry and unchanged markdown, then verifies the preview output updates.

---

### 4. Diagnostics have two public channels, but only one is wired

**Severity:** Low to Medium  
**Location:** `packages/core/src/types.ts`, `packages/react/src/MarkdownEditor.tsx`

`HostServices` exposes:

```ts
reportDiagnostics?(diagnostics: EditorDiagnostic[]): void;
```

The React package emits diagnostics through `onDiagnostics`, but does not call `hostServices.reportDiagnostics`.

**Why it matters:** Two public diagnostics channels create integration ambiguity. A host may implement `reportDiagnostics` and never receive diagnostics, while another host may use `onDiagnostics` and ignore the service method entirely.

**Suggested direction:** Decide whether `reportDiagnostics` is part of the active public contract.

- If yes, centralize diagnostic dispatch so both channels are consistently invoked.
- If no, remove or deprecate it from `HostServices` before broader adoption.

---

## Strong Areas

### Clean package boundaries

The package split is coherent. The React component composes lower-level packages rather than absorbing all editor behavior. This is the right shape for a reusable editor library because source editing, rich text editing, rendering, and codec behavior can evolve independently.

### Security posture is improving

Preview and hybrid rendering now sanitize HTML before injection. The hybrid XSS regression test intentionally feeds hostile renderer output and verifies event handlers are stripped while benign diagram markup survives.

Relevant coverage:

- `packages/react/src/sanitizeHtml.ts`
- `packages/react/test/hybrid-sanitize.test.tsx`
- `packages/react/test/sanitize.test.ts`

### Public behavior is covered by focused runtime tests

The React package now has useful jsdom coverage for the public component surface:

- controlled `mode` does not self-mutate
- invalid active modes are clamped when `modes` changes
- keyboard shortcuts call the right handlers
- imperative handle methods update state
- host link search reports failures and ignores superseded async results

This is the right level of test focus for a wrapper component.

### Lazy WYSIWYG loading is a good package choice

The WYSIWYG surface is loaded with `React.lazy`, which keeps the common markdown/hybrid/preview path lighter and avoids forcing rich-text runtime cost on every host.

### Host service toolbar has good async hygiene

Search uses `AbortController` and ignores late results from superseded requests. That is exactly the behavior hosts need for responsive link search.

---

## Weak Areas and Evolution Pressure

### `MarkdownEditor.tsx` is becoming the coordination hotspot

The file currently owns:

- controlled and uncontrolled markdown state
- controlled and uncontrolled mode state
- CodeMirror lifecycle
- preview rendering
- WYSIWYG routing
- host-service toolbar
- diagnostics dispatch
- keyboard shortcuts
- imperative handle behavior
- mode switcher UI
- frontmatter property toggle UI

It is still readable, but it is the file most likely to become brittle as features grow. The first split worth considering is not a broad abstraction. It is a pragmatic extraction of stable sub-surfaces:

- `PreviewSurface`
- `HostServiceToolbar`
- `ModeToolbar`
- diagnostic dispatch helper
- CodeMirror lifecycle hook

### Imperative API semantics need tightening

The public handle is valuable, but it needs precise semantics:

- Should `setMarkdown` emit `onChange`?
- Should `replaceMarkdown` differ from `setMarkdown`, or just accept metadata?
- Should `insertMarkdown` emit as `user`, `programmatic`, or `host`?
- Should controlled hosts receive imperative updates if they do not update `value`?

The current behavior is close, but duplicate emission and partially overlapping methods will become expensive once external hosts rely on it.

### Snapshot support is incomplete

`getSnapshot()` returns `selection: undefined` even though the public model supports selection snapshots. That limits restore workflows, editor navigation, draft persistence, and collaboration features.

### Renderer trust policy needs an explicit decision

`sanitizePreviewHtml` allows `foreignObject` and `style` to preserve Mermaid output. That may be the right product choice, but it should be treated as a documented renderer trust policy rather than a generic untrusted HTML policy.

For long-term hardening, consider separating sanitizer profiles:

- strict content preview
- trusted renderer output
- diagram output with required SVG allowances

### There is API drift around renderer naming

`MarkdownEditorProps` includes both `rendererRegistry` and `renderers`, while the React component exposes `renderers`. If both remain public, their precedence and intended use should be documented. If `rendererRegistry` is legacy, deprecate it before the API settles.

---

## Test Gaps to Add Next

1. Assert `onChange` call counts for all imperative handle methods.
2. Assert CodeMirror selection survives markdown/hybrid switches.
3. Assert undo history survives mode switches if that is part of the expected contract.
4. Assert preview rerenders when the renderer registry changes and markdown does not.
5. Assert diagnostics are routed through `hostServices.reportDiagnostics` if that API remains supported.
6. Assert `getSnapshot()` includes selection when CodeMirror is mounted.
7. Add a sanitizer regression for allowed `style` behavior so the tradeoff is deliberate and reviewable.

---

## Verification

Commands run during review:

```bash
pnpm --filter @echozedlabs/react typecheck
pnpm --filter @echozedlabs/react test
```

Results:

- React typecheck passed.
- React tests passed: 5 files, 17 tests.

The first sandboxed test attempt failed with an `esbuild` child-process `EPERM`. Re-running the same package test command outside that sandbox restriction passed.

---

## Recommended Next Moves

1. Fix duplicate `onChange` emission in imperative paths and add call-count tests.
2. Rework the React wrapper to keep CodeMirror stable across markdown/hybrid and property-display changes.
3. Clarify diagnostics and renderer-registry API contracts before more host integrations are built.
4. Extract `PreviewSurface` and `HostServiceToolbar` once behavior is locked by tests, keeping the public component thin and easier to reason about.
