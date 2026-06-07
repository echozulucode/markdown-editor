---
type: plan
project: "markdown-editor"
status: complete
created: 2026-06-07
completed: 2026-06-07
scope: "@echozedlabs/react wrapper hardening — from the 2026-06-07 independent React code review"
source_review: docs/archive/react-code-review-2026-06-07.md
---

# React Wrapper Hardening Plan

> **Status: complete (2026-06-07).** All phases R1–R5 implemented and verified.
> Findings tracked as ISSUE-012…ISSUE-015 are resolved. Full suite green: 183
> unit (core/codemirror/react/renderers/wysiwyg), 48 hand-written e2e, 36 BDD,
> feature-coverage gate (52/52) and intent lint pass. Changeset:
> `.changeset/react-wrapper-hardening.md` (patch `@echozedlabs/react`).
> R5 extracted the three self-contained surfaces (`PreviewSurface`,
> `HostServiceToolbar`, icon helpers) into their own files — `MarkdownEditor.tsx`
> dropped 733 → 458 lines. The deeper `ModeToolbar`/`useCodeMirrorEditor` hook
> extractions are deferred (see Phase R5 note): they are tightly coupled to
> component state and carry regression risk disproportionate to the readability
> gain, so they are left for a dedicated follow-up rather than rushed here.

Derived from the independent review in
[`docs/react-code-review-2026-06-07.md`](react-code-review-2026-06-07.md). Each
finding was checked against the current source before planning. **All findings
are valid**; a few carry caveats (noted with evidence). The plan turns the valid
findings into ordered, test-first actions.

## Validity assessment (verified against source)

| # | Finding | Verdict | Evidence | Caveat |
| --- | --- | --- | --- | --- |
| 1 | Imperative updates double-fire `onChange` | **Valid** | `MarkdownEditor.tsx:313` calls `setMarkdown(..., { emitChange: true })` (CM emits via the `onChange` callback at `:166`) **and** `:317` emits again; `replaceMarkdown` `:279` adds a third. CM emits only when `emitChange:true` (`codemirror/index.ts:112`). | Only double-fires when content **actually changes** (CM early-returns on a no-op, `index.ts:106-110`) and only in CodeMirror modes (preview/wysiwyg have a null `cmRef`, so they emit once). |
| 2 | Wrapper recreates CodeMirror for mode/config changes the adapter can do in place | **Valid** | Create-effect deps `:192` include `activeMode`, `readOnly`, `showProperties`, `normalizedFrontmatterDisplay`; the cleanup `destroy()`s and re-creates. The adapter's `setMode(mode, hybridFrontmatterMode?)` "Reconfigure in place: selection, scroll, and undo history are kept" (`codemirror/index.ts:160-168`), and a separate `setReadOnly` effect already exists (`:208-210`). | CM↔non-CM transitions (preview/wysiwyg) legitimately need destroy/recreate; the fix targets only in-CodeMirror changes. `readOnly` is currently double-handled (in both the create-effect deps and the `setReadOnly` effect). |
| 3 | Preview does not respond to renderer-registry changes | **Valid** | `PreviewSurface` effect deps are `[markdown]` (`:646`); `registry` is only read via `registryRef.current`. | This was a deliberate fix for a re-render loop (LESSON-034) whose root cause was the **`onDiagnostics`** callback identity (now via ref), **not** the registry. Re-adding a *stable* `renderers` to the deps is safe. |
| 4 | `HostServices.reportDiagnostics` is declared but never wired | **Valid** | `core/types.ts:125` declares `reportDiagnostics?(...)`; the React package only ever emits through `onDiagnostics`/`emitDiagnostics`. | Low severity — it is an optional, unused field, so resolving it is non-breaking either way. |
| W1 | `MarkdownEditor.tsx` is a coordination hotspot | **Valid** | One file owns ~11 responsibilities (state, CM lifecycle, preview, wysiwyg routing, host toolbar, diagnostics, shortcuts, imperative handle, mode + properties UI). | Subjective but accurate; do it **after** behavior is locked by tests. |
| W2 | Imperative API semantics underspecified | **Valid** | Tied to #1. Also: an imperative `setMarkdown` on a **controlled** editor emits `onChange` and mutates CM, but the markdown sync effect (`:198-206`) reverts CM back to the unchanged `value`. | Real controlled-host conflict; needs a documented contract. |
| W3 | `getSnapshot()` omits selection | **Valid** | `:274` returns `selection: undefined` though the public model supports it. | — |
| W4 | Sanitizer trust policy (`style`) is undocumented | **Valid** | `sanitizeHtml.ts:19` `ADD_TAGS: ['foreignObject', 'style']`; only `foreignObject` is justified in the comment. A `<style>` blob from hostile renderer output survives (CSS-injection/exfil) — matches the earlier QA-audit note. | — |
| W5 | API drift: `rendererRegistry` vs `renderers` | **Valid** | `core/types.ts:201-202` declares both; the React component type **omits** `rendererRegistry` entirely (`MarkdownEditor.tsx:34`) and never reads it → dead legacy field. | `rendererRegistry` is effectively unreachable through the React component today. |

## Phases

Ordered so each behavior change is locked by tests **before** the structural
extraction (W1). Phases R1–R4 are small and independently shippable; R5 is the
refactor.

### Phase R1 — Single-source `onChange` + imperative semantics (Finding 1, W2)

- **Make React the single emit source for imperative paths.** In `updateMarkdown`,
  call `cmRef.current?.setMarkdown(nextMarkdown, { emitChange: false })` and emit
  once. Give `updateMarkdown(next, meta?)` an optional meta param; have
  `replaceMarkdown` call it and **remove** its second `onChangeRef` emit (`:279`).
  Typing still emits once via the CM `onChange` callback (`:166`); imperative calls
  emit once from React. Net: exactly one `onChange` per action.
- **Document and enforce the imperative contract** (in code comments + README):
  `setMarkdown`/`replaceMarkdown`/`insertMarkdown` emit one `onChange` with
  `source: 'programmatic'` (or the caller's meta); on a **controlled** editor they
  emit but do not fight `value` (host must update `value`).
- **Tests (react):** assert `onChange` is called **exactly once** for each of
  `setMarkdown`, `replaceMarkdown`, `insertMarkdown`, and the host insertion path,
  with the expected `source`; assert no revert/flicker when a controlled host
  ignores an imperative update.

### Phase R2 — Keep CodeMirror stable across in-editor changes (Finding 2)

- **Drop `activeMode`, `readOnly`, `showProperties`, `normalizedFrontmatterDisplay`
  from the create-effect deps.** Recreate only when `isCodeMirrorMode` actually
  toggles (entering/leaving CM) or `ariaLabel`/`propertySchema`/`hybridRenderMarkdown`
  identity changes.
- **Drive in-place changes through the adapter:** a `setMode(cmMode, hybridFrontmatterMode)`
  effect keyed on `[activeMode, showProperties, normalizedFrontmatterDisplay]`, and
  keep the existing `setReadOnly` effect as the sole `readOnly` handler.
- **Tests (react):** selection (and scroll where assertable) survives
  markdown→hybrid, hybrid→markdown, show/hide properties, and read-only toggle;
  add an undo-history-survives-mode-switch test (Test Gap #3) once the contract is
  decided.

### Phase R3 — Preview responds to renderer changes (Finding 3)

- **Add the stable `renderers` (registry) to the `PreviewSurface` render effect
  deps** (alongside `markdown`), keeping diagnostics on the ref so the loop stays
  fixed. Document in the prop JSDoc that `renderers` must be a stable reference
  (memoized by the host) — or, if a host needs to force a re-render without
  changing the registry, expose a `previewKey`/`renderVersion` prop.
- **Test (react):** rerender with a different registry and unchanged markdown →
  preview output updates.

### Phase R4 — API contract cleanup (Finding 4, W3, W4, W5)

- **`reportDiagnostics` (Finding 4):** centralize dispatch. Make `emitDiagnostics`
  call `onDiagnostics` **and** `hostServices.reportDiagnostics?.(...)` so both public
  channels are consistent (non-breaking). Add a test asserting both fire.
- **`rendererRegistry` (W5):** mark it `@deprecated` in `core/types.ts` with a
  pointer to `renderers`; plan removal in the next minor. (It is already unreachable
  via the React component, so no runtime change is needed now.)
- **`getSnapshot` selection (W3):** populate `selection` from
  `cmRef.current?.getSelection()` when CM is mounted; test it.
- **Sanitizer trust policy (W4):** document `sanitizePreviewHtml` as a *trusted
  renderer-output* policy (why `foreignObject` **and** `style` are allowed for
  Mermaid). Add a regression test pinning the current `<style>` behavior so the
  tradeoff is deliberate; evaluate splitting profiles (strict-preview vs
  trusted-renderer vs diagram-SVG) as a follow-up if hosts render untrusted source.

### Phase R5 — Extract sub-surfaces (W1) — DONE (partial, by design)

Pragmatic, behavior-preserving extractions from `MarkdownEditor.tsx`, each guarded
by the tests above.

**Done:** `PreviewSurface` (`PreviewSurface.tsx`), `HostServiceToolbar`
(`HostServiceToolbar.tsx`), and the toolbar icon helpers (`icons.tsx`) are now
their own modules — the three self-contained pieces the review named first. The
diagnostics dispatch was already centralized in `emitDiagnostics` (R4), so no
separate `useDiagnosticsDispatch` helper was warranted. `MarkdownEditor.tsx` went
733 → 458 lines. Verified: react typecheck + 24 unit tests + the full 48-test e2e
suite all green after the move (pure code relocation, identical logic).

**Deferred (tracked):** `ModeToolbar` (the inline toolbar JSX) and a
`useCodeMirrorEditor` lifecycle hook (the create/setMode/setReadOnly/markdown-sync
effects). These are tightly coupled to component state (mode/properties state,
the imperative handle's closures, several refs) and would need new abstractions to
extract cleanly. The regression risk outweighs the readability gain for now, so
they are left as a focused follow-up rather than bundled into this pass. No
behavior change is pending; the public component is already meaningfully thinner.

## Test additions (maps the review's "Test Gaps to Add Next")

1. `onChange` call-count for every imperative handle method (R1).
2. CM selection survives markdown/hybrid switches (R2).
3. Undo history survives mode switches *if* in-contract (R2).
4. Preview rerenders on registry change with unchanged markdown (R3).
5. Diagnostics routed through `hostServices.reportDiagnostics` (R4).
6. `getSnapshot()` includes selection when CM is mounted (R4).
7. Sanitizer regression pinning allowed `<style>` behavior (R4).

## Sequencing & risk

- **R1 → R2 → R3 → R4** are independent, low-risk, test-first, and each can ship in
  a patch changeset. **R5** lands last (pure refactor behind green tests).
- R2 is the highest user-visible win (no more lost cursor/undo on mode switch) and
  the highest regression risk — gate it on the selection-survival tests.
- All four numbered findings are tracked as ISSUE-012…ISSUE-015 in
  `docs/issues.yaml`; the weak-area items fold into those phases.

## Outcome (2026-06-07)

- **R1–R4 done and verified test-first** — every fix had a test that failed on the
  pre-fix code and passes after. The XSS-parity fix from the prior QA pass
  (ISSUE-010, hybrid now sanitizes like preview) remains in place.
- **R5 done partially by design** — three self-contained surfaces extracted
  (`MarkdownEditor.tsx` 733 → 458 lines); `ModeToolbar`/`useCodeMirrorEditor`
  deferred as a tracked follow-up (see Phase R5).
- **Verification:** 183 unit tests, 48 e2e (fresh isolated server, rebuilt dist),
  36 BDD (desktop + mobile), coverage gate 52/52, intent lint — all green.
- **Release:** owner-driven. Changeset `.changeset/react-wrapper-hardening.md`
  (patch `@echozedlabs/react`) is staged; the user handles publishing.

## Not changed (with reason)

- No finding was rejected. The only tempering is on Finding 1 (double-fire is
  conditional on real content change, CodeMirror modes only) and Finding 3 (the
  staleness was an intentional loop fix; the corrective is to re-add a *stable*
  registry dep, not to revert the loop fix).
