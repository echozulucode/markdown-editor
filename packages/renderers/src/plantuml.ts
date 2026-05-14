import { escapeHtml } from './escape';
import type { RenderResult as CoreRenderResult } from '@markdown-editor/core';
import type {
  AsyncDiagramRenderer,
  DiagramRendererOptions,
  PlantUmlHostRenderer,
  RendererDiagnostic,
  RendererResult
} from './types';

export interface PlantUmlRendererOptions {
  renderPlantUml: PlantUmlHostRenderer['renderPlantUml'];
  timeoutMs?: number;
}

export function createPlantUmlRenderer(options: PlantUmlRendererOptions): AsyncDiagramRenderer {
  const timeoutMs = options.timeoutMs ?? 5000;

  return async ({ source, blockId, signal }: DiagramRendererOptions): Promise<RendererResult> => {
    if (signal?.aborted) {
      return failure(source, blockId, 'renderer.plantuml.aborted', 'PlantUML rendering was aborted.');
    }

    try {
      const result = await withTimeout(
        options.renderPlantUml(source, {
          blockId,
          signal
        }),
        timeoutMs
      );

      if (signal?.aborted) {
        return failure(source, blockId, 'renderer.plantuml.aborted', 'PlantUML rendering was aborted.');
      }

      return normalizeHostResult(result);
    } catch (cause) {
      return failure(source, blockId, 'renderer.plantuml.failed', 'PlantUML renderer failed; rendered source fallback.', cause);
    }
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`PlantUML render timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function normalizeHostResult(result: CoreRenderResult | RendererResult): RendererResult {
  if (isRendererResult(result)) {
    return result;
  }

  return {
    ok: true,
    html: result.html,
    diagnostics: result.diagnostics?.filter((diagnostic) => diagnostic.severity !== 'info') as
      | RendererDiagnostic[]
      | undefined
  };
}

function isRendererResult(result: CoreRenderResult | RendererResult): result is RendererResult {
  return 'ok' in result;
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
    html: `<pre class="me-renderer-error" data-language="plantuml"><code>${escapeHtml(source)}</code></pre>`,
    error,
    diagnostics: [error]
  };
}
