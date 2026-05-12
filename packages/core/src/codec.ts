import matter from 'gray-matter';
import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Frontmatter, FrontmatterSplit, ParsedMarkdown } from './types.js';

const FRONTMATTER_FENCE = /^---\r?\n/;

export function parseMarkdown(raw: string): ParsedMarkdown {
  const { rawFrontmatter, body, hasFrontmatter, frontmatter, trailing } =
    splitFrontmatter(raw);

  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(body) as Root;

  return {
    raw,
    frontmatter,
    body,
    ast,
    hasFrontmatter,
    rawFrontmatter,
    trailing,
  };
}

export function serializeMarkdown(parsed: ParsedMarkdown): string {
  return parsed.raw;
}

export function replaceBody(parsedOrRaw: ParsedMarkdown | string, newBody: string): string {
  const parsed =
    typeof parsedOrRaw === 'string' ? parseMarkdown(parsedOrRaw) : parsedOrRaw;
  return `${parsed.rawFrontmatter}${newBody}${parsed.trailing}`;
}

export function roundTripMarkdown(raw: string): string {
  return serializeMarkdown(parseMarkdown(raw));
}

export function splitFrontmatter(raw: string): FrontmatterSplit {
  if (!FRONTMATTER_FENCE.test(raw)) {
    return {
      rawFrontmatter: '',
      body: raw,
      hasFrontmatter: false,
      frontmatter: {},
      trailing: '',
    };
  }

  const firstNewline = raw.indexOf('\n');
  if (firstNewline === -1) {
    return {
      rawFrontmatter: '',
      body: raw,
      hasFrontmatter: false,
      frontmatter: {},
      trailing: '',
    };
  }

  const afterOpen = firstNewline + 1;
  const closing = findClosingFence(raw, afterOpen);
  if (closing === -1) {
    return {
      rawFrontmatter: '',
      body: raw,
      hasFrontmatter: false,
      frontmatter: {},
      trailing: '',
    };
  }

  const rawFrontmatter = raw.slice(0, closing.endIdx);
  const body = raw.slice(closing.endIdx);

  let frontmatter: Frontmatter = {};
  try {
    const parsed = matter(rawFrontmatter + body);
    frontmatter = (parsed.data ?? {}) as Frontmatter;
  } catch {
    frontmatter = {};
  }

  return {
    rawFrontmatter,
    body,
    hasFrontmatter: true,
    frontmatter,
    trailing: '',
  };
}

interface ClosingFenceLocation {
  startIdx: number;
  endIdx: number;
}

function findClosingFence(raw: string, fromIdx: number): ClosingFenceLocation | -1 {
  let cursor = fromIdx;
  while (cursor < raw.length) {
    const lineEnd = raw.indexOf('\n', cursor);
    const lineRawEnd = lineEnd === -1 ? raw.length : lineEnd;
    const line = raw.slice(cursor, lineRawEnd).replace(/\r$/, '');
    if (line === '---') {
      const endIdx = lineEnd === -1 ? raw.length : lineEnd + 1;
      return { startIdx: cursor, endIdx };
    }
    if (lineEnd === -1) {
      break;
    }
    cursor = lineEnd + 1;
  }
  return -1;
}
