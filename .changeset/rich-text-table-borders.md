---
"@echozedlabs/react": patch
---

Fix: Rich Text (WYSIWYG) tables now render with grid lines. The
`.me-wysiwyg-table*` rules were present in the wysiwyg-lexical stylesheet but
missing from the consumer-facing `@echozedlabs/react/styles.css` (which is the
only stylesheet consumers import), so tables rendered without any borders. The
table rules are now included, and the header-cell background uses
`--me-surface-muted` so it adapts to dark themes.
