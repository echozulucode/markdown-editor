# echozed markdown editor

[![npm](https://img.shields.io/npm/v/@echozedlabs/react.svg)](https://www.npmjs.com/package/@echozedlabs/react)
[![CI](https://github.com/echozulucode/markdown-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/echozulucode/markdown-editor/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> A modular, embeddable Markdown editor for React — Markdown-first, byte-stable round-trip, with **source / hybrid / preview / WYSIWYG** modes. Published as [`@echozedlabs/react`](https://www.npmjs.com/package/@echozedlabs/react).

The editor treats **raw Markdown bytes as the source of truth**. Every mode (a CodeMirror 6 source/hybrid view, a rendered preview, and a Lexical WYSIWYG surface) reads and writes the same canonical Markdown, so switching modes never silently rewrites your document. Frontmatter is preserved verbatim; body edits round-trip through a tested codec.

## Features

- **Four modes** behind one React component: `markdown` (source), `hybrid` (source with inline-rendered blocks), `preview` (read-only render), `wysiwyg` (Lexical rich-text toolbar).
- **Byte-stable codec** — `parse → serialize` is byte-identical across a 34-fixture corpus; frontmatter bytes are never rewritten on a body edit.
- **Pluggable renderers** — Markdown → HTML, Shiki code highlighting, Mermaid and PlantUML diagrams, with per-renderer failure isolation.
- **Host services** — optional link-search and image-upload toolbar wired through your app.
- **Imperative + controlled APIs** — `value`/`onChange`, `mode`/`onModeChange`, plus an imperative ref handle (`getMarkdown`, `setMode`, `insertMarkdown`, …).
- **Sanitized output** — rendered/diagram HTML is passed through DOMPurify before injection.

## Packages (pnpm workspace)

| Package | What it is |
|---|---|
| `@echozedlabs/core` | Markdown codec (parse/serialize/replaceBody), frontmatter split, shared types. |
| `@echozedlabs/codemirror` | CodeMirror 6 source + hybrid editor view, frontmatter properties widget. |
| `@echozedlabs/wysiwyg-lexical` | Lexical WYSIWYG surface + formatting toolbar, Markdown ↔ rich-text transformers. |
| `@echozedlabs/renderers` | Renderer registry: markdown, Shiki, Mermaid, PlantUML. |
| `@echozedlabs/react` | The public `<MarkdownEditor>` React component that ties the modes together. |
| `examples/dev-harness` | A Vite app that exercises every mode/route — **the examples application**. |

## Prerequisites

- **Node 20+**
- **pnpm 9+** (`npm i -g pnpm`)

## Install & build

```bash
pnpm install
pnpm -r build      # builds every package's dist/ (required before running the examples)
```

> The examples app and consumers resolve packages from their built `dist/`, so run `pnpm -r build` (or build a specific package) after pulling changes.

## Run the examples application

```bash
pnpm dev:harness          # starts the Vite dev server on http://localhost:5173
```

Then open **http://localhost:5173**. Use the left sidebar to switch routes:

| Route | Shows |
|---|---|
| `/markdown` | the source editor (default) |
| `/modes` | all editor modes + mode switching |
| `/renderers` | Shiki / Mermaid / PlantUML rendering |
| `/examples` | host-integration example shells |
| `/responsive` | mobile/tablet/desktop layouts |
| `/accessibility` | a11y-focused configurations |
| `/performance` | typing / mode-switch smoke surfaces |

Equivalent direct form: `pnpm --filter @echozedlabs/dev-harness dev`.
See **`quick-start.md`** for the shortest path.

## Use it in your app

```bash
pnpm add @echozedlabs/react
```

```tsx
import { MarkdownEditor } from '@echozedlabs/react';
import '@echozedlabs/react/styles.css';

export function Editor() {
  const [value, setValue] = useState('# Hello\n\nStart writing…\n');
  return (
    <MarkdownEditor
      value={value}
      onChange={(markdown) => setValue(markdown)}
      modes={['markdown', 'hybrid', 'preview', 'wysiwyg']}
      initialMode="hybrid"
      onSaveShortcut={() => save(value)}   // Cmd/Ctrl+S
    />
  );
}
```

Key props: `value`/`defaultValue`, `mode`/`initialMode`/`modes`, `readOnly`, `onChange`, `onModeChange`, `onSaveShortcut`, `onCancelShortcut`, `hostServices`, `renderers`, `ariaLabel`. The component also forwards an imperative `MarkdownEditorHandle` ref.

## Scripts

```bash
pnpm -r build        # build all packages
pnpm -r test         # unit/component tests (vitest) across packages
pnpm -r typecheck    # type-check all packages
pnpm test:e2e        # Playwright browser smoke (dev-harness)
pnpm dev:harness     # run the examples app
```

## Testing

Each package has its own vitest suite (`jsdom` where a DOM is needed):

- **core** — codec round-trip corpus, frontmatter, BOM, prototype-pollution.
- **codemirror** — source/hybrid view, frontmatter properties widget, in-place mode switch.
- **wysiwyg-lexical** — Markdown round-trip + **toolbar control tests** that click real buttons and assert exported Markdown.
- **react** — mode switching, keyboard shortcuts, imperative handle, preview sanitization.
- **dev-harness** — Playwright e2e across desktop + mobile Chromium.

Run one package: `pnpm --filter @echozedlabs/<pkg> test`.

## Architecture in one paragraph

The codec (`core`) owns the canonical Markdown bytes. CodeMirror renders source/hybrid and emits byte-level edits; Lexical (WYSIWYG) imports the Markdown body to a rich-text state and exports it back through transformers; the renderers package turns Markdown blocks into sanitized HTML/SVG for preview and diagrams. The React component selects a mode, owns (or accepts) the Markdown value, and exposes controlled + imperative APIs. View layers never hold their own canonical state — every edit surfaces as a Markdown mutation.

## Status

Pre-1.0 (`0.1.x`) — the public API may still change between minor versions until 1.0. See `docs/` for the implementation plan, test matrix, and release-readiness notes.

## Contributing

Issues and PRs welcome. Run `pnpm install && pnpm -r build && pnpm -r test` before opening a PR, and add a changeset (`pnpm changeset`) describing user-facing changes. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © Eric Zimmerman (echozed)
