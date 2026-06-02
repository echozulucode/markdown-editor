# @echozedlabs/react

[![npm](https://img.shields.io/npm/v/@echozedlabs/react.svg)](https://www.npmjs.com/package/@echozedlabs/react)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/echozulucode/markdown-editor/blob/main/LICENSE)

A modular, embeddable **Markdown editor for React** — Markdown-first with a byte-stable round-trip, and four modes behind one component: **source / hybrid / preview / rich text (WYSIWYG)**.

Raw Markdown bytes are the source of truth, so switching modes never silently rewrites your document; frontmatter is preserved verbatim.

## Install

```bash
npm i @echozedlabs/react react react-dom
# or: pnpm add @echozedlabs/react
```

`react` and `react-dom` (>=18.2) are peer dependencies.

## Usage

```tsx
import { useState } from 'react';
import { MarkdownEditor } from '@echozedlabs/react';
import '@echozedlabs/react/styles.css';

export function Editor() {
  const [value, setValue] = useState('# Hello\n\nStart writing…\n');
  return (
    <MarkdownEditor
      value={value}
      onChange={setValue}
      modes={['markdown', 'hybrid', 'preview', 'wysiwyg']}
      initialMode="hybrid"
      onSaveShortcut={() => save(value)} // Cmd/Ctrl+S
    />
  );
}
```

Don't forget to import the stylesheet: `import '@echozedlabs/react/styles.css'`.

## Key props

| Prop | Purpose |
|---|---|
| `value` / `defaultValue` | Controlled / uncontrolled Markdown string. |
| `mode` / `initialMode` / `modes` | Active mode, initial mode, and which of `markdown`/`hybrid`/`preview`/`wysiwyg` are available. |
| `onChange` / `onModeChange` | Fired on Markdown edits / mode switches. |
| `onSaveShortcut` / `onCancelShortcut` | Cmd/Ctrl+S and Escape handlers. |
| `readOnly` | Render without editing. |
| `hostServices` | Optional link-search and image-upload integration. |
| `renderers` | Override/extend the preview renderer registry. |
| `ariaLabel` | Accessible label for the editor. |

The component also forwards an imperative `MarkdownEditorHandle` ref (`getMarkdown`, `setMode`, `insertMarkdown`, …).

## How it fits together

`@echozedlabs/react` ties together the focused packages:

- [`@echozedlabs/core`](https://www.npmjs.com/package/@echozedlabs/core) — the Markdown codec (parse/serialize/replaceBody) + frontmatter split.
- [`@echozedlabs/codemirror`](https://www.npmjs.com/package/@echozedlabs/codemirror) — CodeMirror 6 source/hybrid view.
- [`@echozedlabs/wysiwyg-lexical`](https://www.npmjs.com/package/@echozedlabs/wysiwyg-lexical) — Lexical rich-text surface.
- [`@echozedlabs/renderers`](https://www.npmjs.com/package/@echozedlabs/renderers) — markdown, Shiki, Mermaid, PlantUML renderers.

Installing `@echozedlabs/react` pulls these in automatically.

## License

[MIT](https://github.com/echozulucode/markdown-editor/blob/main/LICENSE) © Eric Zimmerman (echozed)
