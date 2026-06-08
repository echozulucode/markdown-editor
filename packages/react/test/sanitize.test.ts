import { describe, it, expect } from 'vitest';
import { sanitizePreviewHtml } from '../src/sanitizeHtml.js';

describe('sanitizePreviewHtml (P1-1 preview XSS boundary)', () => {
  it('strips <script> from preview HTML', () => {
    const out = sanitizePreviewHtml('<p>ok</p><script>window.__pwn = 1</script>');
    expect(out).toMatch(/<p>ok<\/p>/);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/__pwn/);
  });

  it('strips javascript: URLs and inline handlers', () => {
    const out = sanitizePreviewHtml('<a href="javascript:alert(1)" onclick="alert(2)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/onclick/i);
  });

  it('keeps benign rendered markup and embedded SVG diagrams', () => {
    const out = sanitizePreviewHtml('<h1>Title</h1><svg><rect width="4" height="4"/></svg>');
    expect(out).toMatch(/<h1>Title<\/h1>/);
    expect(out).toMatch(/<rect/i);
  });

  it('drops a stray top-level <style> but keeps SVG-scoped diagram <style> (renderer trust policy)', () => {
    // The `<style>` allowance exists for Mermaid, whose <style> lives inside the
    // diagram <svg>. A stray top-level <style> blob (a CSS-injection vector) is
    // dropped by DOMPurify's body-context parsing; scripts/handlers always go.
    const topLevel = sanitizePreviewHtml('<style>.x{color:red}</style><div onclick="bad()">hi</div><script>evil()</script>');
    expect(topLevel).not.toMatch(/<style/i);
    expect(topLevel).not.toMatch(/onclick/i);
    expect(topLevel).not.toMatch(/<script/i);

    const svgScoped = sanitizePreviewHtml('<svg><style>.n{fill:red}</style><rect width="2" height="2"/></svg>');
    expect(svgScoped).toMatch(/<style/i);
    expect(svgScoped).toMatch(/fill:red/);
  });
});
