---
"@echozedlabs/codemirror": minor
"@echozedlabs/react": minor
---

Hybrid mode: tables are now **inline-editable** (Obsidian-style) instead of read-only.

Tables render as an always-on editable widget with `contenteditable` cells: edit
cells in place and Tab / Shift-Tab to move between cells. Structural editing is
exposed two ways, like a word processor — a contextual **toolbar** that appears
while the table is active and an identical **right-click context menu**:

- insert row above / below
- insert column left / right
- set column alignment (left / center / right)
- delete row / column / table

Column alignment is preserved on round-trip. Cell edits are written back to the
Markdown source when focus leaves the table (so cell-to-cell navigation never
churns the document); structural changes commit immediately.

Internally this adds a dependency-free GFM table model (`table-model`, including a
`setAlign` operation) and a `HybridTableWidget`, and the styles for the editable
table and its menu ship in `@echozedlabs/react/styles.css`.
