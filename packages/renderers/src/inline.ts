import { escapeHtml } from './escape';

// NUL-delimited placeholder index — never appears in real Markdown text, and
// survives escaping and the emphasis/link passes untouched. Built at runtime so
// no literal control byte lives in the source.
const NUL = String.fromCharCode(0);
const RESTORE = new RegExp(`${NUL}(\\d+)${NUL}`, 'g');
const HAS_PLACEHOLDER = new RegExp(`${NUL}\\d+${NUL}`);

/**
 * Render inline Markdown — bold, italic, strikethrough, inline code, links, and
 * inline images — to safe HTML.
 *
 * The block parser hands us raw text with its inline syntax intact, so this
 * turns that syntax into HTML while escaping everything else. Code spans, links,
 * and images are rendered into opaque placeholders first so later emphasis rules
 * can't reach inside them (and a URL can't be mangled). URLs are scheme-checked;
 * unknown/dangerous schemes (e.g. `javascript:`) are left as literal text.
 * Output is still sanitized downstream (DOMPurify) as defense-in-depth.
 */
export function renderInline(text: string): string {
  const tokens: string[] = [];
  const stash = (html: string): string => `${NUL}${tokens.push(html) - 1}${NUL}`;

  // 1. Inline code spans — contents escaped, never further transformed.
  let out = text.replace(/`([^`\n]+)`/g, (_m, code: string) => stash(`<code>${escapeHtml(code)}</code>`));

  // 2. Escape the remaining text. Emphasis/link markers are ASCII punctuation and
  //    survive escaping, so the passes below still match.
  out = escapeHtml(out);

  // 3. Inline images: ![alt](url "title")
  out = out.replace(
    /!\[([^\]]*?)\]\((\S+?)(?:\s+&quot;([^&]*?)&quot;)?\)/g,
    (match, alt: string, url: string, title?: string) => {
      const src = safeUrl(url);
      if (src === null) return match;
      const t = title ? ` title="${title}"` : '';
      return stash(`<img src="${src}" alt="${alt}"${t}>`);
    },
  );

  // 4. Links: [label](url "title") — the label may itself contain emphasis.
  out = out.replace(
    /\[([^\]]*?)\]\((\S+?)(?:\s+&quot;([^&]*?)&quot;)?\)/g,
    (match, label: string, url: string, title?: string) => {
      const href = safeUrl(url);
      if (href === null) return match;
      const t = title ? ` title="${title}"` : '';
      return stash(`<a href="${href}"${t} rel="noopener noreferrer">${applyEmphasis(label)}</a>`);
    },
  );

  // 4b. Wiki links: [[Target]] or [[Target|Label]]. Rendered as a styled link
  //     carrying the target; the host resolves the real destination.
  out = out.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_match, target: string, label?: string) => {
    const text = (label ?? target).trim();
    return stash(`<a class="me-renderer-wiki-link" data-wiki-target="${target.trim()}">${text}</a>`);
  });

  // 5. Emphasis on the remaining prose.
  out = applyEmphasis(out);

  // 6. Restore placeholders (loop in case one nests another, e.g. a code span
  //    inside a link label).
  for (let i = 0; i < 5 && HAS_PLACEHOLDER.test(out); i += 1) {
    out = out.replace(RESTORE, (_m, n: string) => tokens[Number(n)] ?? '');
  }
  return out;
}

function applyEmphasis(input: string): string {
  return input
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
    // Underscore italics only at word boundaries — leaves snake_case intact.
    .replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
}

/**
 * Return the (HTML-escaped) URL if its scheme is safe to use in an attribute, or
 * `null` to reject it. Relative URLs and `#anchors` are always allowed.
 */
function safeUrl(escapedUrl: string): string | null {
  const decoded = escapedUrl
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  // If it declares a scheme, it must be one of the safe ones.
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) && !/^(https?|mailto|tel):/i.test(decoded)) {
    return null;
  }
  return escapedUrl;
}
