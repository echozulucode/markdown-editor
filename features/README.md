# Feature specifications

Living documentation for the markdown-editor, written as Gherkin. These files
describe **what an author or reader can do and observe** — not how the packages
implement it — so they survive UI and internal refactors.

Concrete values (mode names, render timeout, performance budgets, viewport
widths) are **not** written into scenario text. They live in
[`support/interaction_contract.yaml`](support/interaction_contract.yaml) and are
read by step definitions at run time.

## Actors

| Actor | Who they are |
| --- | --- |
| **the author** | Someone creating or editing a document in the editor. |
| **a reader** | Someone viewing a rendered, read-only document. |
| **the host application** | The product embedding the editor; it supplies renderers, page search, and asset storage. |

## Glossary

| Term | Meaning |
| --- | --- |
| **Markdown source** | The canonical text of a document; every mode reads from and writes to it. |
| **mode** | One of Markdown, Hybrid, Preview, or Rich Text (see the interaction contract). |
| **rendered view** | Any surface that shows rendered output (Preview, or inactive blocks in Hybrid). |
| **rendered block** | A diagram, table, code block, callout, or image shown in its rendered form. |
| **active block** | The block the author is currently editing; in Hybrid mode it reveals its source. |
| **callout** | A highlighted note block (note / warning / danger). |
| **wiki link** | A link to another page written as a page reference. |
| **page suggestion** | A page offered by the host's search while the author is inserting a link. |
| **properties** | A document's metadata, presented as a typed panel backed by its frontmatter. |
| **inline editable table** | A table the author edits directly as a grid in Hybrid mode. |
| **fails soft** | An error is contained inline (fallback + notice) without crashing the document. |

## Tag vocabulary

| Tag | Purpose |
| --- | --- |
| `@release-0.1.0` | Behavior present since the initial release. |
| `@release-0.2.0` | Behavior added by the recent requested changes. |
| `@smoke` | Core happy-path checks to run on every commit. |
| `@a11y` | Accessibility behavior. |
| `@keyboard` | Keyboard-operability behavior. |
| `@performance` | Behavior governed by a budget in the interaction contract. |
| `@spec-WCAG-<section>` | Traces a scenario to a WCAG success criterion. |

`@release-0.1.0` / `@release-0.2.0` are applied at the feature level for the
release a capability belongs to, and at the scenario level where a newer release
added a single behavior inside an older feature (e.g. inline emphasis rendering,
rich-text table gridlines, soft Mermaid failure).

## Traceability to automated coverage

| Feature file | Primary automated coverage |
| --- | --- |
| `markdown_source_editing.feature` | `packages/core` codec tests; `examples/dev-harness/e2e/modes-renderers.spec.ts` |
| `switching_editor_modes.feature` | `e2e/modes-renderers.spec.ts`, `e2e/examples.spec.ts` |
| `hybrid_mode_authoring.feature` | `packages/codemirror` view tests; `e2e/modes-renderers.spec.ts` |
| `document_properties.feature` | `e2e/examples.spec.ts` (schema-backed properties) |
| `rendering_rich_content.feature` | `packages/renderers` tests; `e2e/modes-renderers.spec.ts` |
| `diagram_rendering.feature` | `e2e/mermaid-rendering.spec.ts`, `e2e/diagram-sizing.spec.ts` |
| `rich_text_editing.feature` | `packages/wysiwyg-lexical` tests; `e2e/modes-renderers.spec.ts` |
| `inline_table_editing.feature` | `packages/codemirror` table tests; `e2e/table-editing.spec.ts` |
| `host_integration_services.feature` | `e2e/examples.spec.ts` (host services) |
| `editor_accessibility.feature` | `e2e/modes-renderers.spec.ts`, `e2e/post-mvp-qa.spec.ts` |
