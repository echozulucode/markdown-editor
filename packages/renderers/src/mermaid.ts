import { escapeAttribute, escapeHtml } from './escape';
import type { AsyncDiagramRenderer, DiagramRendererOptions, RendererDiagnostic, RendererResult } from './types';

export interface MermaidRendererOptions {
  timeoutMs?: number;
}

let mermaidCounter = 0;

export function createMermaidRenderer(options: MermaidRendererOptions = {}): AsyncDiagramRenderer {
  const timeoutMs = options.timeoutMs ?? 3000;

  return async ({ source, blockId, signal }: DiagramRendererOptions): Promise<RendererResult> => {
    if (signal?.aborted) {
      return failure(source, blockId, 'renderer.mermaid.aborted', 'Mermaid rendering was aborted.');
    }

    try {
      const mermaid = await import('mermaid');
      const renderer = mermaid.default;
      renderer.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
        // On a parse error Mermaid otherwise injects its own "Syntax error in
        // text / mermaid version X" graphic straight into the DOM (appended to
        // <body>), which leaks onto the page even though we catch the throw and
        // render our own source fallback below. Suppress it so invalid diagrams
        // surface only through our diagnostics + fallback.
        suppressErrorRendering: true,
        // Render labels as SVG <text>, not HTML in <foreignObject>. The
        // downstream HTML sanitizer (DOMPurify) categorically strips foreignObject
        // HTML, which made diagram text disappear. Mermaid v11 only honors the
        // TOP-LEVEL `htmlLabels` flag for flowcharts (the per-diagram
        // `flowchart.htmlLabels` alone is NOT enough); set both.
        htmlLabels: false,
        flowchart: { htmlLabels: false }
      });

      const id = `me-mermaid-${blockId.replace(/[^a-zA-Z0-9_-]/g, '-')}-${++mermaidCounter}`;
      const rendered = await withTimeout(renderer.render(id, source), timeoutMs);

      return {
        ok: true,
        html: `<figure class="me-renderer-diagram me-renderer-mermaid" data-block-id="${escapeAttribute(blockId)}">${rendered.svg}</figure>`
      };
    } catch (cause) {
      return failure(source, blockId, 'renderer.mermaid.failed', 'Mermaid renderer failed; rendered source fallback.', cause);
    }
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Mermaid render timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function failure(
  source: string,
  blockId: string,
  code: string,
  message: string,
  cause?: unknown
): RendererResult {
  const error: RendererDiagnostic = {
    severity: code.endsWith('.aborted') ? 'warning' : 'error',
    code,
    message,
    blockId,
    cause
  };

  return {
    ok: false,
    html: `<pre class="me-renderer-error" data-language="mermaid"><code>${escapeHtml(source)}</code></pre>`,
    error,
    diagnostics: [error]
  };
}
