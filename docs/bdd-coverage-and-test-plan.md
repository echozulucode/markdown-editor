---
type: coverage-and-plan
project: "markdown-editor"
status: phase-1-complete
updated: 2026-06-06
scope: "BDD feature intent vs. automated (unit + Playwright) coverage"
companion: "docs/test-matrix.md, features/coverage.yaml"
---

# BDD Coverage & Test Plan

> **Update (Phase 1 complete):** all nine gaps below have been closed. Coverage
> is now **51/51 scenarios (100%)**. The headline table reflects the original
> baseline; the gap table records how each was closed. The remaining phases
> (executable Playwright-BDD, CI gate) are still open.

This report measures how much of the **intent** captured in `features/*.feature`
is actually verified by automated tests — the Vitest unit/integration suites in
`packages/*` and the Playwright suites in `examples/dev-harness/e2e` — and lays
out a plan to (a) close the gaps and (b) make the feature files executable so
intent and implementation stay bound.

The per-scenario mapping is the machine-readable manifest at
[`features/coverage.yaml`](../features/coverage.yaml); this document summarizes
and plans from it.

## Method

- **Intent surface:** 51 scenarios across 10 feature files.
- **Test surface:** 15 unit test files (~138 cases) + 6 Playwright specs (run on
  `chromium-desktop` and `chromium-mobile`).
- **Status per scenario:**
  - **Covered** — a test directly asserts the scenario's observable outcome.
  - **Partial** — related coverage exists but a key assertion is missing.
  - **None** — no automated test asserts the behavior.
- Coverage is mapped to the **observable outcome**, not to incidental setup. A
  scenario is "covered" only if a test would fail when that behavior breaks.

## Headline coverage

| Measure | Scenarios | Percent |
| --- | --- | --- |
| **Covered** (outcome asserted) | 42 / 51 | **82.4%** |
| At least partially covered | 49 / 51 | 96.1% |
| **Weighted** (partial = 0.5) | 45.5 / 51 | **89.2%** |
| None (untested) | 2 / 51 | 3.9% |

**Coverage source split** (of the 42 covered): **26** verified by both layers,
**9** by unit tests only, **7** by Playwright only. The harness uniquely covers 7
interaction scenarios the unit tests can't reach (host services, keyboard reach,
live typing shortcuts, toolbar icons, callout rendering); the unit suites
uniquely cover 9 (byte-preservation, `renderInline`, `table-model` ops, several
hybrid reveal behaviors).

## Coverage by feature

| Feature | Covered | Partial | None | Full % |
| --- | --- | --- | --- | --- |
| hybrid_mode_authoring | 4 | 0 | 0 | 100% |
| document_properties | 6 | 0 | 0 | 100% |
| diagram_rendering | 5 | 0 | 0 | 100% |
| rendering_rich_content | 5 | 1 | 0 | 83% |
| inline_table_editing | 8 | 2 | 0 | 80% |
| switching_editor_modes | 3 | 1 | 0 | 75% |
| rich_text_editing | 3 | 1 | 0 | 75% |
| editor_accessibility | 3 | 1 | 0 | 75% |
| markdown_source_editing | 3 | 0 | 1 | 75% |
| host_integration_services | 2 | 1 | 1 | 50% |

The strongest areas are the ones with deep library tests (hybrid rendering,
properties, diagram resilience). The weakest is **host integration services**,
which has *no unit coverage at all* — `HostServices` exists only as a type — and
relies entirely on two Playwright happy-path checks.

## Gaps — all closed in Phase 1

| Id | Scenario | How it was closed | Test |
| --- | --- | --- | --- |
| G1 | Reverting an edit restores previous text | unit | `codemirror::undoes a change, restoring the previous text` |
| G2 | Outdated page-search results discarded | unit | `react/host-services::discards results from a superseded search` |
| G3 | Switching an unedited doc leaves source identical | e2e | `modes-renderers::switching modes leaves an unedited source unchanged` |
| G4 | Preview tables have visible gridlines | **CSS fix** + e2e | `react/src/styles.css` (`.me-preview table th/td` border) + `modes-renderers::preview tables render with visible cell borders` |
| G5 | Rich-text tables show gridlines | e2e | `examples::rich text tables render with visible cell borders` |
| G6 | Moving between cells with the keyboard | e2e | `table-editing::the keyboard advances focus to the next cell` |
| G7 | Removing the table | unit + e2e | `codemirror::removes the whole table…` + `table-editing::deleting the table removes it from the source` |
| G8 | Page suggestions filtered by search text | e2e | `examples::page suggestions exclude pages that do not match the search` |
| G9 | Reduced-motion preference respected | e2e | `modes-renderers::a reduced-motion preference removes editor transitions` |

**G4 was the only real implementation gap** — `renderTable` emitted a borderless
`<table>` and `.me-preview table` set no cell borders, so preview GFM tables had
no gridlines. Fixed with a small CSS rule. The other eight were pure test gaps
(the behavior already worked). Full coverage is now **51/51 (100%)**.

## Plan

### Phase 1 — Close the gaps (small, high value)

Add the nine tests above. Five are Playwright (G3–G8 minus the unit parts), four
are Vitest (G1, G2, G7-unit, and optionally G9). Each lands in an existing file:

- `packages/codemirror/test/markdown-editor-view.test.ts` → G1 (undo), G7 (removeTable).
- a new `packages/*/test/host-services.test.ts` → G2 (abort), G8-unit (filter).
- `examples/dev-harness/e2e/table-editing.spec.ts` → G6 (Tab), G7 (delete table).
- `examples/dev-harness/e2e/modes-renderers.spec.ts` → G3 (no-op save), G4/G5 (table borders), G9 (reduced motion).

Update `features/coverage.yaml` as each lands; the CI gate (Phase 4) then holds
the line.

### Phase 2 — Make the feature files executable (Playwright-BDD)

> **Pilot complete (`inline_table_editing.feature`).** `playwright-bdd@9` is wired
> in: `playwright.bdd.config.ts` generates Playwright tests from the feature via
> `bddgen`, step definitions live in `examples/dev-harness/bdd-steps/`, and
> `pnpm --filter @echozedlabs/dev-harness test:bdd` runs them. All 10 scenarios
> pass against the harness.
>
> Two things the pilot surfaced:
> - **Product bug found and fixed.** The BDD steps were the first to assert the
>   *live* hybrid widget after a structural commit, which exposed that
>   `isTableSeparator` rejected center-aligned (`:--:`) and single-column tables —
>   the editable widget vanished to source after centering a column or deleting to
>   one column (Markdown stayed valid). Fixed in `@echozedlabs/codemirror`
>   (changeset `hybrid-table-detection-fix`), guarded by a unit test.
> - **Follow-up issue (not yet fixed).** A *controlled* editor (`value` + `onChange`,
>   e.g. the `full-page-docs` example) re-serializes the whole document on every
>   commit, accumulating blank lines and intermittently churning the table widget.
>   The pilot therefore drives an **uncontrolled** fixture (`example-bdd-table`).
>   Worth investigating the controlled-value round-trip normalization separately.

Bind the **interaction-level** scenarios to the harness so the `.feature` files
*run*, not just document:

1. Add `playwright-bdd` to `examples/dev-harness` (it generates Playwright tests
   from `.feature` files and reuses the existing `playwright.config.ts`,
   `webServer`, and the two device projects).
2. Author step definitions under `examples/dev-harness/steps/`, reusing the
   selectors already proven in the e2e specs (e.g. `getByTestId('example-…')`,
   `.cm-me-table`, `.me-toolbar`).
3. Step definitions read thresholds from
   [`features/support/interaction_contract.yaml`](../features/support/interaction_contract.yaml)
   (mode list, diagram timeout, viewport widths, perf budgets) — never inline.
4. Map these features first, since each already has matching e2e selectors:
   `inline_table_editing`, `diagram_rendering`, `switching_editor_modes`,
   `document_properties`, `host_integration_services`, `rich_text_editing`,
   `editor_accessibility`.

The current hand-written specs in `e2e/*.spec.ts` stay as the regression net
until the generated BDD tests reach parity, then the overlapping ones retire.

### Phase 3 — Bind unit-level intent without forcing Gherkin ✅

Some scenarios are inherently unit-level (byte-preservation, `renderInline`,
`table-model` operations, frontmatter protection). These are **not** routed
through a browser BDD runner; they stay in Vitest and are bound by traceability:

- The `unit:` / `e2e:` ids in `features/coverage.yaml` are the source of truth
  for each scenario→test link.
- The Phase-4 coverage gate enforces that binding: every referenced test **file**
  must exist, so deleting or renaming a bound test fails the build.

This keeps fast unit tests fast while still tracing every scenario to evidence.

### Phase 4 — CI gate + lint ✅

Implemented and wired into `.github/workflows/ci.yml`:

1. **Coverage gate** — `scripts/check-feature-coverage.mjs` (`pnpm check:coverage`):
   parses every `features/*.feature`, cross-checks it against
   `features/coverage.yaml` (bidirectional — no missing scenarios, no stale
   entries), fails on any `none` status (unless `@manual`), verifies `meta.totals`,
   and verifies every referenced test file exists.
2. **Intent lint** — `scripts/lint-feature-intent.mjs` (`pnpm lint:features`):
   rejects raw units (`12px`, `500ms`, …), project selectors (`.me-*`, `.cm-*`,
   `#id`), and HTML tags in scenario text, exempting numbers in scenarios tagged
   `@regulatory` / `@a11y` / `@spec-*`. Both run via `pnpm verify:features` in the
   CI `build` job.
3. **Executable BDD lane** — the CI `bdd` job builds the packages, installs
   Chromium, and runs `pnpm test:bdd` on chromium-desktop. It currently executes
   `inline_table_editing` and `diagram_rendering` (the `@performance`
   render-timeout scenario is excluded via `tags: 'not @performance'` — it has no
   browser fixture and is unit-covered). Expand to chromium-mobile and the other
   features as their steps land.

## Definition of done

- [x] All 51 scenarios at `covered` (or `@manual` with an audit note) in
  `features/coverage.yaml`.
- [x] CI fails on coverage-manifest drift and on intent-lint violations
  (`pnpm verify:features`, build job).
- [x] Executable Playwright-BDD in CI for `inline_table_editing` and
  `diagram_rendering` (bdd job; `@performance` excluded — unit-covered).
- [ ] Remaining interaction features (`switching_editor_modes`,
  `document_properties`, `host_integration_services`, `rich_text_editing`,
  `editor_accessibility`) bound as executable BDD, on desktop + mobile.
- [ ] Controlled-editor blank-line churn investigated (Phase 2 follow-up).
