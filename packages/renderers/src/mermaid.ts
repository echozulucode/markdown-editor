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
        theme: 'default'
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
