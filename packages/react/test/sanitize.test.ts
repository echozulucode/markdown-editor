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
});
