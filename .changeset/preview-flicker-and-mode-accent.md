---
"@echozedlabs/react": patch
---

Mode-switcher restyle plus preview-rendering and mode-resolution fixes.

- **Mode switcher restyle.** The mode buttons are a proper segmented control: the
  selected mode is filled with the accent color, inactive modes get a hover
  surface, and all expose a focus-visible ring — all from the `--me-*` theme
  tokens, so it follows whatever light/dark theme the host applies (the editor
  never imposes its own system theme).
- **Active mode is clamped to `modes`.** If `modes` changes so the current mode is
  no longer allowed — e.g. a host reuses the editor instance for a different
  surface, or React reconciles one usage into another — the editor falls back to a
  valid mode instead of getting stuck rendering a mode outside `modes` (which left
  no editing/preview surface and, for preview, no rendered output or diagnostics).
- **Preview rendering no longer loops or drops.** The preview effect now depends
  only on `markdown` (diagnostics are reported through a ref), so it renders once
  per document instead of re-rendering continuously (a flickering scrollbar) — and
  it reliably renders on first mount/navigation. The preview also reserves its
  scrollbar gutter.
- **Responsive tables.** Dropped the fixed table-level `min-width`; per-cell
  min-widths drive horizontal scroll (contained within the table) only when a
  table is genuinely too wide, so tables fit narrow/phone-width containers.
