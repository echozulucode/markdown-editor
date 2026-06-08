import DOMPurify from 'dompurify';

/**
 * Sanitize renderer output HTML before it is injected (preview surface and the
 * hybrid rendered-block widget). Fails closed in a non-DOM environment.
 *
 * Trust policy: this is a **trusted renderer-output** sanitizer, not a general
 * untrusted-HTML policy. It runs DOMPurify's default config (which allows HTML +
 * SVG + MathML and strips `<script>`, `on*` event handlers, and `javascript:`
 * URLs) and additionally allows two tags that diagram renderers (Mermaid) require:
 *
 * - `<foreignObject>` — Mermaid renders flowchart node labels as HTML inside it;
 *   `USE_PROFILES` would drop that HTML and the diagram text would vanish.
 * - `<style>` — Mermaid emits a `<style>` block scoped inside the diagram `<svg>`.
 *   DOMPurify's body-context parsing drops a *stray top-level* `<style>` blob, so
 *   only renderer SVG-scoped CSS survives — the CSS-injection surface is limited to
 *   trusted diagram output, not arbitrary document content.
 *
 * Renderers are nonetheless trusted to carry SVG-scoped CSS. Hosts that render
 * genuinely untrusted Markdown source should keep renderer output trusted (or add
 * a stricter profile). The regression test in `react/test/sanitize.test.ts` pins
 * both behaviors (top-level dropped, SVG-scoped kept).
 */
export function sanitizePreviewHtml(html: string): string {
  if (typeof (DOMPurify as { sanitize?: unknown }).sanitize !== 'function') {
    return '';
  }
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['foreignObject', 'style'],
  });
}
