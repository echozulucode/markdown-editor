import DOMPurify from 'dompurify';

/**
 * Sanitize preview HTML (concatenated registry-renderer output, which may
 * include host/diagram HTML) before it is injected via
 * dangerouslySetInnerHTML. Fails closed in a non-DOM environment.
 */
export function sanitizePreviewHtml(html: string): string {
  if (typeof (DOMPurify as { sanitize?: unknown }).sanitize !== 'function') {
    return '';
  }
  // Use DOMPurify's default config (which already allows HTML + SVG + MathML and
  // strips scripts/event handlers) rather than USE_PROFILES. USE_PROFILES
  // restricts namespaces and DROPS the HTML inside SVG <foreignObject>, which is
  // how Mermaid renders flowchart node labels — that made diagram text vanish in
  // the preview. The default config keeps foreignObject's HTML labels while still
  // removing <script>/on*-handlers/javascript: URLs.
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['foreignObject', 'style'],
  });
}
