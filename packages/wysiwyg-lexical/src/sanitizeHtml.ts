import DOMPurify from 'dompurify';

/**
 * Sanitize renderer-produced HTML/SVG before it is injected via
 * dangerouslySetInnerHTML. Diagram renderers (Mermaid, host PlantUML) return
 * SVG that we do not control end-to-end, so we strip scripts/event handlers and
 * other active content while keeping SVG markup intact.
 *
 * In a browser, DOMPurify uses the global window. In jsdom (tests) window also
 * exists. If neither has a DOM (pure node), DOMPurify can't run, so we fail
 * closed and drop the markup rather than inject it unsanitized.
 */
export function sanitizeDiagramHtml(html: string): string {
  if (typeof (DOMPurify as { sanitize?: unknown }).sanitize !== 'function') {
    return '';
  }
  // Use DOMPurify's default config (allows HTML + SVG + MathML, strips
  // scripts/handlers) instead of USE_PROFILES. USE_PROFILES restricts namespaces
  // and drops the HTML inside SVG <foreignObject> — exactly how Mermaid renders
  // flowchart labels — making diagram text vanish. The default config keeps the
  // labels while still neutralizing scripts/event handlers/javascript: URLs.
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['foreignObject', 'style'],
  });
}
