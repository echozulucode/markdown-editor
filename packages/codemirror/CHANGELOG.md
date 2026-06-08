# @echozedlabs/codemirror

## 0.2.0

### Minor Changes

- ab9e58b: Hybrid mode: tables are now **inline-editable** (Obsidian-style) instead of read-only.

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

### Patch Changes

- ab9e58b: Date / time / datetime property fields no longer add a custom picker button when
  the browser provides a native one. Native date inputs already render their own
  clickable calendar/clock icon, so the custom trigger produced a duplicate icon
  (and could fight the native control on click). It's now only added as a fallback
  when `HTMLInputElement.showPicker` is unavailable, and renders as an icon (not a
  "Pick" text button) in that case.
- ab9e58b: Hybrid mode: fix the table detector dropping valid tables. `isTableSeparator`
  required at least three dashes per column and at least two columns, so a
  center-aligned separator (`:--:`, two dashes) or a single-column table
  (`| --- |`) stopped being recognized — the editable table widget would vanish to
  raw source after you centered a column or deleted down to one column, even though
  the Markdown stayed valid. The detector now matches GFM separators with any dash
  run and one or more columns, in step with the `table-model` parser.
  - @echozedlabs/core@0.2.0
