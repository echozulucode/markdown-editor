---
"@echozedlabs/codemirror": patch
---

Hybrid mode: fix the table detector dropping valid tables. `isTableSeparator`
required at least three dashes per column and at least two columns, so a
center-aligned separator (`:--:`, two dashes) or a single-column table
(`| --- |`) stopped being recognized — the editable table widget would vanish to
raw source after you centered a column or deleted down to one column, even though
the Markdown stayed valid. The detector now matches GFM separators with any dash
run and one or more columns, in step with the `table-model` parser.
