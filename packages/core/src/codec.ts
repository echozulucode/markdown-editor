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

/** Keys that must never be copied off untrusted YAML onto a JS object. */
const FORBIDDEN_FRONTMATTER_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Copy frontmatter onto a null-prototype object, dropping prototype-polluting
 * keys (`__proto__`/`constructor`/`prototype`). gray-matter/js-yaml can surface
 * these as own properties from a hostile document; stripping them here keeps
 * every downstream consumer (which spreads/indexes frontmatter) safe.
 */
function sanitizeFrontmatter(data: Record<string, unknown>): Frontmatter {
  const clean = Object.create(null) as Frontmatter;
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_FRONTMATTER_KEYS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

function noFrontmatter(raw: string): FrontmatterSplit {
  return {
    rawFrontmatter: '',
    body: raw,
    hasFrontmatter: false,
    frontmatter: sanitizeFrontmatter({}),
    trailing: '',
  };
}

export function splitFrontmatter(raw: string): FrontmatterSplit {
  // Tolerate a leading UTF-8 BOM: detect the fence after it, but keep the BOM
  // byte attached to rawFrontmatter so the round-trip stays byte-stable.
  // Without this, a BOM'd document parsed as having no frontmatter.
  const bom = raw.charCodeAt(0) === 0xfeff ? '\uFEFF' : '';
  const text = bom ? raw.slice(bom.length) : raw;

  if (!FRONTMATTER_FENCE.test(text)) {
    return noFrontmatter(raw);
  }

  const firstNewline = text.indexOf('\n');
  if (firstNewline === -1) {
    return noFrontmatter(raw);
  }

  const afterOpen = firstNewline + 1;
  const closing = findClosingFence(text, afterOpen);
  if (closing === -1) {
    return noFrontmatter(raw);
  }

  const rawFrontmatterNoBom = text.slice(0, closing.endIdx);
  const body = text.slice(closing.endIdx);

  let frontmatter: Frontmatter = sanitizeFrontmatter({});
  try {
    const parsed = matter(rawFrontmatterNoBom + body);
    frontmatter = sanitizeFrontmatter((parsed.data ?? {}) as Record<string, unknown>);
  } catch {
    frontmatter = sanitizeFrontmatter({});
  }

  return {
    // Re-attach the BOM so replaceBody (rawFrontmatter + body) round-trips.
    rawFrontmatter: bom + rawFrontmatterNoBom,
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
