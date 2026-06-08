---
"@echozedlabs/renderers": minor
---

Render wiki links in inline content. `renderInline` now turns `[[Target]]` and
`[[Target|Label]]` into a styled link (`<a class="me-renderer-wiki-link"
data-wiki-target="…">`) instead of leaving the raw brackets as text, so
preview/rendered surfaces show wiki links the way hybrid mode already does. The
host can resolve the real destination from `data-wiki-target`. Styling ships in
`@echozedlabs/react/styles.css`.
