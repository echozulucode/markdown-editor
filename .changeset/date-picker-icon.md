---
"@echozedlabs/codemirror": patch
---

Date / time / datetime property fields no longer add a custom picker button when
the browser provides a native one. Native date inputs already render their own
clickable calendar/clock icon, so the custom trigger produced a duplicate icon
(and could fight the native control on click). It's now only added as a fallback
when `HTMLInputElement.showPicker` is unavailable, and renders as an icon (not a
"Pick" text button) in that case.
