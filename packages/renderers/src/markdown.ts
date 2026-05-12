import { createDefaultRendererRegistry, RendererRegistry } from './registry';
import type { CalloutBlock, MarkdownBlock, RendererDiagnostic, RendererResult } from './types';

export interface RenderMarkdownOptions {
  registry?: RendererRegistry;
  signal?: AbortSignal;
}

export interface RenderMarkdownToHtmlResult {
  html: string;
  blocks: MarkdownBlock[];
  diagnostics: RendererDiagnostic[];
}

export async function renderMarkdownToHtml(
  markdown: string,
  options: RenderMarkdownOptions = {}
): Promise<RenderMarkdownToHtmlResult> {
  const registry = options.registry ?? createDefaultRendererRegistry();
  const blocks = parseMarkdownBlocks(markdown);
  const results: RendererResult[] = [];

  for (const block of blocks) {
    results.push(await registry.renderBlock(block, { blockId: block.id, signal: options.signal }));
  }

  return {
    html: results.map((result) => result.html).join('\n'),
    blocks,
    diagnostics: results.flatMap((result) => result.diagnostics ?? [])
  };
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([\w-]+)?\s*$/);
    if (fence) {
      const language = fence[1]?.toLowerCase();
      const start = index;
      index += 1;
      const sourceLines: string[] = [];

      while (index < lines.length && !lines[index].startsWith('```')) {
        sourceLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const kind = language === 'mermaid' ? 'mermaid' : language === 'plantuml' || language === 'puml' ? 'plantuml' : 'code';
      blocks.push({
        id: blockId(blocks.length),
        kind,
        language,
        source: sourceLines.join('\n'),
        raw: lines.slice(start, index).join('\n')
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        id: blockId(blocks.length),
        kind: 'heading',
        depth: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2],
        raw: line
      });
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/);
    if (image) {
      blocks.push({
        id: blockId(blocks.length),
        kind: 'image',
        alt: image[1],
        url: image[2],
        title: image[3],
        raw: line
      });
      index += 1;
      continue;
    }

    if (isCalloutStart(line)) {
      const start = index;
      const calloutLines: string[] = [];

      while (index < lines.length && lines[index].startsWith('>')) {
        calloutLines.push(lines[index]);
        index += 1;
      }

      blocks.push(parseCallout(blocks.length, calloutLines, lines.slice(start, index).join('\n')));
      continue;
    }

    if (isTableLine(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const start = index;
      const tableLines: string[] = [];

      while (index < lines.length && isTableLine(lines[index])) {
        if (!isTableSeparator(lines[index])) {
          tableLines.push(lines[index]);
        }
        index += 1;
      }

      blocks.push({
        id: blockId(blocks.length),
        kind: 'table',
        rows: tableLines.map(parseTableRow),
        raw: lines.slice(start, index).join('\n')
      });
      continue;
    }

    const paragraphLines: string[] = [];
    const start = index;

    while (index < lines.length && lines[index].trim() !== '') {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push({
      id: blockId(blocks.length),
      kind: 'paragraph',
      text: paragraphLines.join('\n'),
      raw: lines.slice(start, index).join('\n')
    });
  }

  return blocks;
}

function parseCallout(index: number, lines: string[], raw: string): CalloutBlock {
  const first = lines[0].replace(/^>\s?/, '');
  const match = first.match(/^\[!(\w+)\]\s*(.*)$/);
  const body = lines.slice(1).map((line) => line.replace(/^>\s?/, '')).join('\n');

  return {
    id: blockId(index),
    kind: 'callout',
    calloutType: match?.[1] ?? 'note',
    title: match?.[2] || undefined,
    body,
    raw
  };
}

function blockId(index: number): string {
  return `block-${index + 1}`;
}

function isCalloutStart(line: string): boolean {
  return /^>\s?\[!\w+\]/.test(line);
}

function isTableLine(line: string): boolean {
  return /^\|.*\|$/.test(line.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
}
