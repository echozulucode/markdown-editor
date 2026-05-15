---
type: post-mvp-qa
project: "markdown-editor"
status: ready_for_review
updated: 2026-05-15
owner: "QA/Examples lane"
---

# Post-MVP QA Audit Notes

This document captures post-MVP QA artifacts that should continue after the MVP review handoff. It gives reviewers a concrete checklist for visual review, manual accessibility audit, and deeper performance budget work.

## Current Verification

As of 2026-05-15, the full post-MVP suite passed:

- `pnpm -r typecheck`
- `pnpm -r test`
- `pnpm -r build`
- `pnpm --filter @markdown-editor/dev-harness test:e2e` with 60 Playwright checks across desktop and mobile Chromium

## Focused Command

Run the post-MVP QA spec independently when iterating on the gallery, layout, accessibility chrome, or performance budgets:

```sh
pnpm --filter @markdown-editor/dev-harness test:e2e -- e2e/post-mvp-qa.spec.ts
```

The spec attaches full-page screenshots for `/examples`, `/modes`, and `/renderers` in the configured desktop and mobile Chromium projects. Treat those screenshots as review artifacts, not pixel baselines.

## Visual Screenshot and Layout Review

Review the generated screenshots for these route-level concerns:

| Route | Primary review target | Manual pass criteria |
| --- | --- | --- |
| `/examples` | Required and stretch host shells | Headers, controls, editors, side panes, modal shell, mobile frame, prompt panes, and conflict columns are visible without clipped primary controls. |
| `/modes` | Mode matrix cards | Mode switchers remain discoverable; active mode surfaces are not visually collapsed; read-only preview has no editing chrome. |
| `/renderers` | Renderer preview plus diagnostics | Code, diagrams, tables, callouts, diagnostics, and source fixture remain visually distinct and readable. |

The automated post-MVP spec currently checks:
- No document-level horizontal overflow for the screenshot routes.
- Key example shells have non-collapsed header and editor regions.
- Example shell header regions do not overlap the first editor surface.
- Full-page screenshot artifacts are attached for desktop and mobile review.

Manual visual review should still check:
- Text wrapping in toolbar buttons, route buttons, modal actions, and compact comment controls.
- Sticky or scrollable regions after long content is added by hosts.
- High-density tables and code blocks in both preview and hybrid modes.
- Mobile viewport reachability for WYSIWYG toolbar controls and insert menus.

## Accessibility Manual Audit Checklist

Automated smoke coverage is not a certification artifact. Before a production release, run a keyboard and screen-reader smoke pass against `/examples`, `/modes`, and `/renderers`.

| Area | Manual check | Notes |
| --- | --- | --- |
| Route navigation | Tab through harness route buttons and confirm `aria-current` follows navigation. | Verify focus order does not jump from route nav into hidden editor internals. |
| Editor mode toolbar | Switch modes with keyboard only and confirm the selected mode is announced as pressed/current. | Cover hybrid, markdown, preview, and WYSIWYG on `/modes`. |
| WYSIWYG toolbar | Confirm block style, inline formatting, list controls, insert menu, code language controls, and diagram edit/apply controls have useful names. | Include icon-only host toolbar buttons. |
| Renderer errors | Navigate to invalid Mermaid fallback and diagnostics. | Error content should be reachable without stealing focus from the editor. |
| Dialog shell | Inspect the modal quick-edit example. | Confirm dialog name, modal state, close/apply controls, and focus containment expectations for a future real modal. |
| Read-only preview | Confirm editing controls are absent but content remains reachable. | Include frontmatter properties, code, tables, links, and diagrams. |
| Reduced motion | Re-run the core flows with reduced motion enabled. | Confirm no workflow depends on animation timing. |
| Contrast | Spot-check default theme and any host theme overrides with a contrast tool. | Pay special attention to disabled states, diagnostics, selections, and code tokens. |

The post-MVP spec adds a lightweight automated guard for unlabeled buttons and selected ARIA states, but the screen-reader pass remains manual.

## Performance Budget Notes

The current MVP gates are smoke checks. Post-MVP performance work should establish trace-based budgets with repeatable fixtures and clear environment notes.

| Area | Draft target | Measurement approach |
| --- | --- | --- |
| Route readiness | `/examples`, `/modes`, and `/renderers` ready in under 8 seconds in local Chromium smoke. | Playwright timing around route navigation and first stable locator. |
| Mode switch | All-modes card switches to preview and WYSIWYG in under 5 seconds in smoke. | Existing e2e timing plus future trace markers around mode adapter mount. |
| Typing latency | p95 under 50 ms on a 1k-line markdown fixture. | Future Playwright trace or browser performance marks around input-to-visible-update. |
| Large document editing | No catastrophic lockup on a 10k-line fixture. | Future dedicated route or generated fixture with typing and scrolling probes. |
| Shiki lazy load | First highlighted block may lazy-load; empty editor should not pull Shiki. | Vite bundle report plus resource timing on renderer route. |
| Mermaid/PlantUML fallback | Slow or invalid diagrams exit through timeout/fallback without blocking editing. | Renderer unit tests plus a future browser-level slow-renderer fixture. |

Do not tighten these draft budgets until the route, fixture, hardware, browser version, and trace collection process are stable enough for repeatable comparisons.
