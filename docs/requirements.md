---
type: requirements
project: "markdown-editor"
status: active
updated: 2026-05-14
---

# Requirements

## Advanced Properties Editor

Future frontmatter/properties editing should move beyond the MVP scalar table and behave more like Obsidian's properties panel.

Desired capabilities:
- Keep frontmatter hidden behind a structured properties UI in hybrid mode by default.
- Allow adding and removing properties through the GUI.
- Allow reordering properties through drag handles or keyboard-accessible move controls.
- Provide type-aware editors for common property kinds:
  - text fields for plain strings;
  - date picker for dates;
  - time picker for times;
  - tag/token editor for tags and categories;
  - checkbox for booleans;
  - link-aware editor for linked values when supported by host services.
- Preserve Markdown/YAML source as the canonical saved representation.
- Support hosts defining allowed property names, property types, labels, defaults, and validation rules.
- Keep the properties panel usable on narrow screens without forcing raw YAML editing.

Initial MVP limitation:
- Current hybrid properties editing only supports simple `key: value` scalar rows.
