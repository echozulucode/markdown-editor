---
type: release-readiness
project: "markdown-editor"
status: ready_for_review
updated: 2026-05-14
scope: "Phase 5 release documentation and audit artifacts"
---

# Release Readiness Notes

This document records the current MVP release posture. It is intentionally evidence-based: automated gates are marked ready only when backed by committed tests or package scripts, and manual checks are listed separately.

## Gate Snapshot

| Area | Current status | Evidence |
| --- | --- | --- |
| Core Markdown codec | Ready for MVP | `packages/core/test/codec.test.ts` round-trips the Knowledge E3 fixture corpus, frontmatter body replacement, empty docs, invalid YAML, long lines, wiki-links, callouts, tables, inline HTML, diagrams-as-text fixtures, and mixed line endings. |
| Renderer failure isolation | Ready for MVP | `packages/renderers/test/renderers.test.ts` covers Mermaid and PlantUML error paths, missing renderer fallback, host PlantUML success, and timeout fallback. `examples/dev-harness/e2e/modes-renderers.spec.ts` checks renderer route behavior. |
| Mode configuration examples | Ready for MVP | `examples/dev-harness/e2e/modes-renderers.spec.ts` covers mode switching, configured mode subsets, controlled value propagation, and read-only behavior on desktop and mobile Chromium. |
| Required and stretch example shells | Ready for MVP | `examples/dev-harness/e2e/examples.spec.ts` checks the six required shells plus side-pane review, modal quick edit, technical runbook, mobile note, AI prompt composer, and conflict resolver shells. |
| Accessibility | Ready for MVP smoke | ARIA labels, toolbar roles, `aria-pressed`, read-only preview chrome removal, keyboard-reachable controls, and reduced-motion behavior are covered by committed Playwright smoke checks. |
| Performance | Ready for MVP smoke | Playwright covers mode-switch and typing latency smoke with conservative bounds; deeper trace-based budgets are a post-MVP hardening track. |
| Security | Ready for MVP review | Renderer escape/fallback boundaries exist, Mermaid runs with `securityLevel: 'strict'`, PlantUML is host-owned, and known production trust-boundary caveats are documented. |
| WYSIWYG fidelity | Ready for MVP | WYSIWYG tests cover common prose, lists, images, Mermaid, PlantUML, code blocks, tables, frontmatter envelope preservation, and accepted table normalizations. |

## Accessibility Audit

Implemented or currently visible:
- `MarkdownEditor` exposes a configurable `ariaLabel` and labels preview/editor surfaces.
- Mode controls live inside `role="toolbar"` and use `aria-pressed`.
- WYSIWYG toolbar groups have labels, and stateful inline/list controls use `aria-pressed`.
- Renderer properties tables and diagram SVGs include accessible labels in the current harness paths.
- Read-only preview examples remove editing toolbar controls.

Committed MVP smoke checks:
- Keyboard activation of mode switching and WYSIWYG toolbar discovery.
- ARIA labels and stateful toolbar controls for editor and WYSIWYG chrome.
- Read-only preview chrome removal.
- Reduced-motion media preference acceptance and overflow stability.
- Phone, tablet, and desktop overflow checks on the mode and renderer routes.

Manual checks recommended before a production release:
- Screen reader smoke pass for toolbar grouping, rendered error panels, frontmatter properties, and WYSIWYG block controls.
- Contrast review for host-specific themes beyond the default light theme.
- Focus restoration check for every host-specific modal or route transition.

## Performance Gates

Current evidence:
- Shiki is opt-in and uses explicit language/theme loaders rather than the full Shiki bundle.
- The dev harness manual chunks separate React, CodeMirror, Lezer, and Lexical paths.
- Renderer tests cover Mermaid and PlantUML timeout fallback behavior.
- The core fixture corpus includes `24-very-long-lines.md`.

Committed MVP smoke gates:
- Mode switch timing on the all-modes card.
- Markdown typing latency through CodeMirror on the all-modes card.
- Responsive route stability on phone, tablet, and desktop widths.

Recommended post-MVP performance gates:
- Raw editor mount on 1k and 10k line fixtures.
- p95 typing latency with trace collection on 1k and 10k line fixtures.
- Hybrid layout stability around active/rendered block transitions.
- First Shiki render cost and lazy-load behavior.
- Mermaid slow/invalid render timeout in browser-level Playwright coverage.
- Example route smoke timing budgets per route.

## Security Review

Current guardrails:
- Plain Markdown-derived text paths escape HTML before injecting rendered output.
- Unknown code languages fall back to plaintext with diagnostics.
- Mermaid rendering uses `startOnLoad: false`, `securityLevel: 'strict'`, per-block IDs, timeout, and source fallback on failure.
- PlantUML rendering is a host renderer boundary. The package does not assume a public PlantUML network endpoint.
- PlantUML and Mermaid failures return inline fallback HTML and diagnostics instead of throwing past the editor boundary.
- WYSIWYG diagram and image blocks remain source-backed; Markdown is still the persisted artifact.

Production caveats for host review:
- `PreviewSurface` uses `dangerouslySetInnerHTML` with renderer output, so every renderer and host-provided PlantUML result must be treated as trusted or sanitized before return.
- Inline HTML policy is not finalized. The fixture corpus preserves inline HTML as Markdown source, but preview sanitization for arbitrary HTML is not a completed release gate.
- Link URL and image URL policy needs an explicit allowlist. The harness uses a `data:` SVG image fixture, which is acceptable for local demo coverage but should not imply production defaults.
- Host services and future extensions need a documented trust boundary: hosts own uploads, navigation, telemetry transport, link lookup, and PlantUML endpoint authorization.
- Mermaid and PlantUML source can be expensive; production hosts should keep timeouts and cancellation wired and avoid synchronous rendering on the main persistence path.

## Host Integration Recipes

All examples import through public package exports:

```tsx
import { MarkdownEditor } from '@markdown-editor/react';
import {
  createDefaultRendererRegistry,
  createMermaidRenderer,
  createPlantUmlRenderer,
  createShikiCodeRenderer,
} from '@markdown-editor/renderers';
import '@markdown-editor/react/styles.css';
```

All modes with technical renderers:

```tsx
const renderers = createDefaultRendererRegistry({
  shiki: createShikiCodeRenderer(),
  mermaid: createMermaidRenderer(),
  plantUml: createPlantUmlRenderer({ renderPlantUml: hostRenderPlantUml }),
});

<MarkdownEditor
  value={markdown}
  modes={['hybrid', 'markdown', 'preview', 'wysiwyg']}
  initialMode="hybrid"
  renderers={renderers}
  onChange={setMarkdown}
/>
```

Markdown plus read-only preview split:

```tsx
<MarkdownEditor value={markdown} modes={['markdown']} initialMode="markdown" onChange={setMarkdown} />
<MarkdownEditor value={markdown} modes={['preview']} initialMode="preview" readOnly renderers={renderers} />
```

WYSIWYG-only contributor surface:

```tsx
<MarkdownEditor
  value={articleMarkdown}
  modes={['wysiwyg']}
  initialMode="wysiwyg"
  renderers={renderers}
  wysiwygToolbarIcons={hostToolbarIcons}
  onChange={setArticleMarkdown}
/>
```

Read-only published page:

```tsx
<MarkdownEditor value={publishedMarkdown} modes={['preview']} initialMode="preview" readOnly renderers={renderers} />
```

Production PlantUML boundary:

```tsx
const plantUml = createPlantUmlRenderer({
  timeoutMs: 5000,
  renderPlantUml: async (source, { signal }) => {
    const response = await fetch('/api/render/plantuml', {
      method: 'POST',
      body: source,
      signal,
      headers: { 'content-type': 'text/plain' },
    });
    return { html: await response.text() };
  },
});
```

Host services remain optional. Use them when the host owns link lookup, navigation, uploads, diagnostics transport, or a direct PlantUML render service.

## Knowledge E3 Migration Notes

Carry forward:
- Markdown as the canonical saved value.
- The byte-stable codec behavior and fixture corpus.
- CodeMirror for raw and hybrid modes.
- Lexical as an optional WYSIWYG adapter, not the source of truth.
- Renderer behavior for code, Mermaid, PlantUML, tables, images, callouts, wiki-links, and source-backed technical blocks.

Do not carry forward into the package:
- Knowledge E3 page store, routing, auth, graph, backlinks, audit logging, server vault, or app shell.
- Knowledge E3-specific frontmatter schemas as hard-coded package behavior.
- Public PlantUML server use as a production default.
- Product-specific tokens, command names, telemetry destinations, or navigation side effects.

Migration mapping:
- Replace app-specific editor wrappers with `MarkdownEditor`.
- Pass allowed modes through `modes`.
- Move page persistence to the host `onChange` handler.
- Move link lookup/navigation to `hostServices`.
- Move PlantUML rendering behind a host endpoint and inject it through the renderer registry or `hostServices.renderPlantUml`.
- Treat advanced properties editing as post-MVP. Current MVP properties are simple scalar frontmatter rows.

## Example Source Links

| Example | Source |
| --- | --- |
| Full-page technical docs editor | `examples/dev-harness/src/main.tsx`, `ExamplesGallery`, `example-full-page-docs` |
| Markdown plus preview split workflow | `examples/dev-harness/src/main.tsx`, `example-markdown-preview` |
| Hybrid-only knowledge editor | `examples/dev-harness/src/main.tsx`, `example-hybrid-knowledge` |
| WYSIWYG-only contributor editor | `examples/dev-harness/src/main.tsx`, `example-wysiwyg-contributor` |
| Read-only published docs site | `examples/dev-harness/src/main.tsx`, `example-published-docs` |
| Compact comment composer | `examples/dev-harness/src/main.tsx`, `example-comment-composer` |
| Side-pane review editor | `examples/dev-harness/src/main.tsx`, `example-side-pane-review` |
| Modal quick-edit editor | `examples/dev-harness/src/main.tsx`, `example-modal-quick-edit` |
| Technical runbook editor | `examples/dev-harness/src/main.tsx`, `example-technical-runbook` |
| Mobile-first note editor | `examples/dev-harness/src/main.tsx`, `example-mobile-note` |
| AI prompt composer | `examples/dev-harness/src/main.tsx`, `example-ai-prompt-composer` |
| Conflict/diff resolver | `examples/dev-harness/src/main.tsx`, `example-conflict-resolver` |
| Example smoke tests | `examples/dev-harness/e2e/examples.spec.ts` |
| Mode and renderer smoke tests | `examples/dev-harness/e2e/modes-renderers.spec.ts` |

## Known Limitations

- WYSIWYG tables support simple pipe-style GFM tables only.
- WYSIWYG table export intentionally normalizes alignment markers to `---`, pads short rows, truncates extra cells, and preserves inline Markdown inside cells as text rather than rich inline formatting.
- Accessibility has MVP smoke coverage but no axe or screen-reader certification artifact.
- Performance gates are conservative MVP smoke checks, not trace-based production budgets.
- Example gallery has desktop/mobile Chromium smoke coverage and explicit phone/tablet/desktop overflow checks, but no visual screenshot baselines.
- Wiki-link autocomplete and upload flows are host-service contracts, not complete UI workflows.
- Advanced Obsidian-style properties editing is deferred.
- Package publishing docs are not final; current recipes are source-level integration notes.
