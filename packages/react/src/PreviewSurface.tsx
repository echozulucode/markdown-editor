import React from 'react';
import {
  createDefaultRendererRegistry,
  renderMarkdownToHtml,
  type RenderMarkdownToHtmlResult,
  type RendererRegistry,
} from '@echozedlabs/renderers';
import { sanitizePreviewHtml } from './sanitizeHtml.js';

/** Read-only preview surface: renders Markdown to sanitized HTML. */
export function PreviewSurface({
  markdown,
  registry,
  onDiagnostics,
}: {
  markdown: string;
  registry?: RendererRegistry;
  onDiagnostics(diagnostics: NonNullable<RenderMarkdownToHtmlResult['diagnostics']>): void;
}) {
  const [result, setResult] = React.useState<RenderMarkdownToHtmlResult | null>(null);
  const registryRef = React.useRef<RendererRegistry | undefined>(registry);
  registryRef.current = registry;
  // Keep onDiagnostics out of the render effect's deps (via a ref). Putting it in
  // the deps makes reporting diagnostics — which updates host state — re-trigger
  // the effect, so the preview re-renders in a loop; and any non-stable callback
  // identity desync would also break the single-fire-on-mount. The effect should
  // run purely when `markdown` changes.
  const onDiagnosticsRef = React.useRef(onDiagnostics);
  onDiagnosticsRef.current = onDiagnostics;

  React.useEffect(() => {
    // Use a local "cancelled" guard rather than aborting the render: the renderer
    // lazy-loads (and caches) shiki/mermaid, and aborting on cleanup can break the
    // shared loader. The guard still drops stale/after-unmount results.
    let cancelled = false;
    const activeRegistry = registryRef.current ?? createDefaultRendererRegistry();

    renderMarkdownToHtml(markdown, { registry: activeRegistry })
      .then((nextResult: RenderMarkdownToHtmlResult) => {
        if (cancelled) {
          return;
        }
        setResult(nextResult);
        onDiagnosticsRef.current?.(nextResult.diagnostics);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        const diagnostics = [
          {
            code: 'preview.render.failed',
            message,
            severity: 'error' as const,
            source: 'renderer',
          },
        ];
        setResult({
          html: `<pre class="me-preview-error">${escapeHtml(markdown)}</pre>`,
          blocks: [],
          diagnostics,
        });
        onDiagnosticsRef.current?.(diagnostics);
      });

    return () => {
      cancelled = true;
    };
    // `registry` is a real render input (a host may swap renderers without changing
    // markdown); it must be a stable reference. Diagnostics stay on a ref, so this
    // can't reintroduce the re-render loop that narrowing these deps once fixed.
  }, [markdown, registry]);

  return (
    <div
      className="me-preview"
      aria-label="Markdown preview"
      dangerouslySetInnerHTML={{ __html: result?.html ? sanitizePreviewHtml(result.html) : '<p>Rendering preview...</p>' }}
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
