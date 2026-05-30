import { describe, it, expect } from 'vitest';
import { sanitizeDiagramHtml } from '../src/sanitizeHtml.js';

describe('sanitizeDiagramHtml (P1-1 XSS boundary)', () => {
  it('strips <script> from injected diagram HTML', () => {
    const out = sanitizeDiagramHtml('<svg><script>window.__pwn = 1</script><rect/></svg>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/__pwn/);
  });

  it('strips inline event handlers (onload/onerror)', () => {
    const out = sanitizeDiagramHtml('<svg onload="alert(1)"><image href="x" onerror="alert(2)"/></svg>');
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/alert/);
  });

  it('preserves benign SVG markup', () => {
    const out = sanitizeDiagramHtml('<svg><rect width="10" height="10"/></svg>');
    expect(out).toMatch(/<rect/i);
  });

  it('preserves Mermaid SVG text labels (regression: diagram text was vanishing)', () => {
    // Mermaid with flowchart.htmlLabels:false emits labels as SVG <text>/<tspan>.
    const svg =
      '<svg role="graphics-document"><g class="node"><rect/></g>' +
      '<g class="nodeLabel"><text x="5" y="5"><tspan>StartNode</tspan></text></g>' +
      '<script>window.__pwn=1</script></svg>';
    const out = sanitizeDiagramHtml(svg);
    expect(out).toContain('StartNode'); // label text survives
    expect(out).toMatch(/<text/i);
    expect(out).not.toMatch(/<script/i); // still XSS-safe
  });
});
