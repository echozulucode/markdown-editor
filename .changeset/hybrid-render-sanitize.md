---
"@echozedlabs/react": patch
---

Security: sanitize renderer HTML in hybrid mode. The preview surface ran
renderer output through `sanitizePreviewHtml`, but the hybrid rendered-block
widget injected the same renderer HTML **unsanitized** — an asymmetric XSS path
when a custom/host renderer (or a future renderer) emits event handlers or
`javascript:` URLs. `hybridRenderMarkdown` now sanitizes its output too, matching
the preview path. Guarded by a regression test that fails if a renderer's
`onerror` handler reaches the editor DOM.
