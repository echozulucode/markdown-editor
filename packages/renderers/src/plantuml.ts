import { escapeHtml } from './escape';
import type { RenderResult as CoreRenderResult } from '@echozedlabs/core';
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
    return { ...result, html: constrainDiagramSvgWidth(result.html) };
  }

  return {
    ok: true,
    html: constrainDiagramSvgWidth(result.html),
    diagnostics: result.diagnostics?.filter((diagnostic) => diagnostic.severity !== 'info') as
      | RendererDiagnostic[]
      | undefined
  };
}

/**
 * Give different-sized PlantUML diagrams sensible default sizing. A host SVG
 * with only a `viewBox` (no width/height) is stretched by the browser to fill
 * its container, so a small diagram renders huge on a wide screen. We cap such
 * SVGs at their intrinsic viewBox width via `max-width: <W>px` — the diagram
 * never upscales past its natural size yet still shrinks responsively on narrow
 * screens (mirroring how Mermaid sizes its output). SVGs that already declare a
 * width or a max-width, and non-SVG output (e.g. <img>), are left untouched.
 */
export function constrainDiagramSvgWidth(html: string): string {
  return html.replace(/<svg\b[^>]*>/gi, (tag) => {
    if (/\swidth\s*=/.test(tag)) return tag;
    if (/style\s*=\s*"[^"]*max-width/i.test(tag)) return tag;
    const viewBox = tag.match(/viewBox\s*=\s*"\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+[\d.]+/i);
    const width = viewBox ? Math.round(parseFloat(viewBox[1]!)) : NaN;
    if (!Number.isFinite(width) || width <= 0) return tag;
    const declaration = `max-width:${width}px;`;
    return /style\s*=\s*"/i.test(tag)
      ? tag.replace(/style\s*=\s*"/i, `style="${declaration}`)
      : tag.replace(/<svg\b/i, `<svg style="${declaration}"`);
  });
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
