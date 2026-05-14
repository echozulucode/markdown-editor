import { escapeAttribute, escapeHtml } from './escape';
import { createPlantUmlRenderer } from './plantuml';
import type {
  AsyncDiagramRenderer,
  BlockRenderer,
  CodeBlock,
  MarkdownBlock,
  RendererBlockKind,
  RendererContext,
  RendererDiagnostic,
  RendererRegistryOptions,
  RendererResult,
  CalloutBlock,
  HeadingBlock,
  ImageBlock,
  ListBlock,
  ParagraphBlock,
  SimpleBlock,
  TableBlock
} from './types';

export class RendererRegistry {
  private readonly renderers = new Map<RendererBlockKind, BlockRenderer>();

  register<TBlock extends MarkdownBlock>(kind: TBlock['kind'], renderer: BlockRenderer<TBlock>): void {
    this.renderers.set(kind, renderer as BlockRenderer);
  }

  async renderBlock(block: MarkdownBlock, context?: Partial<RendererContext>): Promise<RendererResult> {
    const renderer = this.renderers.get(block.kind) ?? fallbackUnsupportedRenderer;
    const normalizedContext: RendererContext = {
      blockId: context?.blockId ?? block.id,
      signal: context?.signal
    };

    try {
      return await renderer(block, normalizedContext);
    } catch (cause) {
      return errorResult(block, {
        severity: 'error',
        code: 'renderer.threw',
        message: `Renderer for "${block.kind}" failed.`,
        blockId: normalizedContext.blockId,
        cause
      });
    }
  }
}

export function createDefaultRendererRegistry(options: RendererRegistryOptions = {}): RendererRegistry {
  const registry = new RendererRegistry();

  registry.register<ParagraphBlock>('paragraph', (block) => ok(`<p>${escapeHtml(block.text)}</p>`));
  registry.register<HeadingBlock>('heading', (block) => ok(`<h${block.depth}>${escapeHtml(block.text)}</h${block.depth}>`));
  registry.register<ListBlock>('list', (block) => ok(renderList(block)));
  registry.register<SimpleBlock>('blockquote', (block) => ok(`<blockquote>${escapeHtml(block.text)}</blockquote>`));
  registry.register<SimpleBlock>('html', (block) => ok(`<pre class="me-renderer-html">${escapeHtml(block.raw)}</pre>`));
  registry.register<TableBlock>('table', (block) => ok(renderTable(block.rows)));
  registry.register<ImageBlock>('image', (block) => {
    const title = block.title ? ` title="${escapeAttribute(block.title)}"` : '';
    return ok(`<img src="${escapeAttribute(block.url)}" alt="${escapeAttribute(block.alt)}"${title}>`);
  });
  registry.register<CalloutBlock>('callout', (block) => {
    const title = block.title ? `<strong>${escapeHtml(block.title)}</strong>` : '';
    return ok(
      `<aside class="me-renderer-callout me-renderer-callout-${escapeAttribute(block.calloutType.toLowerCase())}">${title}<p>${escapeHtml(block.body)}</p></aside>`
    );
  });
  registry.register<CodeBlock>('code', async (block, context) => {
    if (!options.shiki) {
      return renderPlainCode(block);
    }

    try {
      return await options.shiki({
        language: block.language,
        source: block.source,
        blockId: context.blockId,
        signal: context.signal
      });
    } catch (cause) {
      return errorResult(block, {
        severity: 'error',
        code: 'renderer.code.failed',
        message: 'Code highlighter failed; rendered plaintext fallback.',
        blockId: context.blockId,
        cause
      });
    }
  });
  registry.register('mermaid', createDiagramRenderer('mermaid', options.mermaid));
  registry.register('plantuml', createDiagramRenderer('plantuml', normalizePlantUmlRenderer(options.plantUml)));

  return registry;
}

function createDiagramRenderer(kind: 'mermaid' | 'plantuml', renderer?: AsyncDiagramRenderer): BlockRenderer<CodeBlock> {
  return async (block, context) => {
    if (!renderer) {
      return errorResult(block, {
        severity: 'warning',
        code: `renderer.${kind}.missing`,
        message: `${kind} renderer is not configured; rendered source fallback.`,
        blockId: context.blockId
      });
    }

    try {
      return await renderer({
        source: block.source,
        blockId: context.blockId,
        signal: context.signal
      });
    } catch (cause) {
      return errorResult(block, {
        severity: 'error',
        code: `renderer.${kind}.failed`,
        message: `${kind} renderer failed; rendered source fallback.`,
        blockId: context.blockId,
        cause
      });
    }
  };
}

function normalizePlantUmlRenderer(renderer: RendererRegistryOptions['plantUml']): AsyncDiagramRenderer | undefined {
  if (!renderer) {
    return undefined;
  }

  if (typeof renderer === 'function') {
    return renderer;
  }

  return createPlantUmlRenderer({
    renderPlantUml: renderer.renderPlantUml.bind(renderer)
  });
}

function renderPlainCode(block: CodeBlock): RendererResult {
  const language = block.language ? ` data-language="${escapeAttribute(block.language)}"` : '';
  return ok(`<pre class="me-renderer-code"${language}><code>${escapeHtml(block.source)}</code></pre>`);
}

function renderList(block: ListBlock): string {
  const tag = block.ordered ? 'ol' : 'ul';
  const hasTasks = block.items.some((item) => item.checked !== undefined);
  const className = hasTasks ? ' class="me-renderer-list me-renderer-task-list"' : ' class="me-renderer-list"';
  const items = block.items
    .map((item) => {
      if (item.checked === undefined) {
        return `<li>${escapeHtml(item.text)}</li>`;
      }

      const checked = item.checked ? ' checked' : '';
      return `<li class="me-renderer-task-item"><input class="me-renderer-task-checkbox" type="checkbox" disabled${checked}> <span>${escapeHtml(item.text)}</span></li>`;
    })
    .join('');

  return `<${tag}${className}>${items}</${tag}>`;
}

function renderTable(rows: string[][]): string {
  const renderedRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell.trim())}</td>`).join('')}</tr>`)
    .join('');
  return `<table><tbody>${renderedRows}</tbody></table>`;
}

function fallbackUnsupportedRenderer(block: MarkdownBlock): RendererResult {
  return errorResult(block, {
    severity: 'warning',
    code: 'renderer.unsupported',
    message: `No renderer registered for "${block.kind}".`,
    blockId: block.id
  });
}

function errorResult(block: MarkdownBlock, error: RendererDiagnostic): RendererResult {
  const language = 'language' in block && block.language ? ` data-language="${escapeAttribute(block.language)}"` : '';
  return {
    ok: false,
    html: `<pre class="me-renderer-error"${language}><code>${escapeHtml(block.raw)}</code></pre>`,
    error,
    diagnostics: [error]
  };
}

function ok(html: string): RendererResult {
  return { ok: true, html };
}
