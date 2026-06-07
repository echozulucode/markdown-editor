---
"@echozedlabs/renderers": patch
---

Render inline Markdown in the default preview renderer. Paragraphs, headings,
list items, table cells, blockquotes, and callouts now render **bold**,
*italic*, ~~strikethrough~~, `inline code`, links, and inline images instead of
showing literal Markdown syntax. Links are scheme-checked (dangerous schemes
like `javascript:` are left as plain text), underscores inside words
(`snake_case`) stay literal, and output remains HTML-escaped (and is still
DOMPurify-sanitized downstream). Exposed as a new `renderInline` export.
