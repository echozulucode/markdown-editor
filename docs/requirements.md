---
type: requirements
project: "markdown-editor"
status: active
updated: 2026-05-15
---

# Requirements

## Advanced Properties Editor

Future frontmatter/properties editing should move beyond the MVP scalar table and behave more like Obsidian's properties panel.

Desired capabilities:
- Keep frontmatter hidden behind a structured properties UI in hybrid mode by default.
- Allow adding and removing properties through the GUI.
- Allow reordering properties through drag handles with keyboard-accessible reorder support. Do not make persistent up/down buttons the primary row UI.
- Let users click the property name/type area to open a compact chooser for key, type, and host-defined property suggestions.
- Represent the selected property type with a compact icon in the row; expose labels through accessible names, tooltips, or popover text.
- Provide type-aware editors for common property kinds:
  - text fields for plain strings;
  - date picker for dates;
  - time picker for times;
  - date-time editor when a host schema needs combined date/time values;
  - tag/token editor for tags and categories;
  - checkbox for booleans;
  - link-aware editor for linked values when supported by host services.
- Keep tag editing inline: typing in the row plus Enter should add a token, and each token should have a subtle remove affordance.
- Preserve Markdown/YAML source as the canonical saved representation.
- Support hosts defining allowed property names, property types, labels, defaults, and validation rules.
- Keep the properties panel usable on narrow screens without forcing raw YAML editing.

Target UX details:
- Rows should visually align with the reference pattern: drag handle, type icon, property name, compact editor, and row-level affordances that appear only when useful.
- Reordering should feel direct with pointer drag on desktop and should have an accessible keyboard alternative.
- Date and time controls should allow direct typing and native picker activation where the platform supports it.
- Boolean properties should render as a compact checkbox/toggle that can be clicked directly in edit mode.
- Unknown or complex YAML should not be silently damaged. The editor should either preserve it outside the structured rows, flag it, or fall back to source editing until complex YAML support is explicitly designed.
- The panel should remain calm and dense: avoid large management dialogs, multi-step property forms, or toolbar-heavy workflows for common add/edit/remove operations.
- Examples may use Font Awesome icons for property and toolbar affordances, but reusable packages must continue to accept icons through slots/adapters instead of importing Font Awesome directly.

Post-MVP status as of 2026-05-15:
- Hybrid mode now includes a structured properties UI with type affordances for text, date, time, tags, and booleans.
- Users can edit keys and values, add properties, remove properties, and reorder properties with keyboard-accessible move controls.
- Markdown/YAML remains the canonical saved representation.
- Current scope is still intentionally simple: top-level scalar, CSV, inline-list, and simple block-list values. Nested objects, comments, schema validation, drag reordering, and link-aware typed editors remain future work.

Revised target after 2026-05-15 review:
- Replace visible move buttons with drag handles plus keyboard-accessible reordering.
- Upgrade the name/type interaction to a popover/dropdown model with type icons and host suggestions.
- Refine tags into an inline token editor with subtle per-token removal and Enter-to-add behavior.
- Improve date/time editors beyond plain fields by supporting native pickers and schema-driven date/time/date-time variants.
- Use the example gallery to validate Font Awesome iconography without adding Font Awesome to the core editor packages.
