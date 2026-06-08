---
"@echozedlabs/renderers": patch
---

Mermaid: stop the library's built-in "Syntax error in text / mermaid version X"
graphic from leaking onto the page when a diagram fails to parse.

`createMermaidRenderer` already caught the render error and emitted a clean
source fallback plus a diagnostic, but Mermaid v11 *also* injects its own error
SVG into the DOM as a side effect. We now initialize Mermaid with
`suppressErrorRendering: true`, so invalid diagrams surface only through our
fallback + diagnostics.
