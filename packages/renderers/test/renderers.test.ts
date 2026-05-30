import { describe, expect, it } from 'vitest';
import { constrainDiagramSvgWidth, createDefaultRendererRegistry, createPlantUmlRenderer, createShikiCodeRenderer, renderMarkdownToHtml } from '../src';

describe('renderer fallbacks', () => {
  it('renders leading YAML frontmatter as read-only properties', async () => {
    const markdown = ['---', 'title: Preview note', 'status: draft', '---', '# Body'].join('\n');

    const result = await renderMarkdownToHtml(markdown);

    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('class="me-renderer-properties"');
    expect(result.html).toContain('<th>title</th><td>Preview note</td>');
    expect(result.html).toContain('<th>status</th><td>draft</td>');
    expect(result.html).toContain('<h1>Body</h1>');
    expect(result.html).not.toContain('title: Preview note');
  });

  it('renders bullet lists and task checkboxes as list markup', async () => {
    const result = await renderMarkdownToHtml('- [ ] Draft plan\n- [x] Ship preview\n- Review feedback');

    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('<ul class="me-renderer-list me-renderer-task-list">');
    expect(result.html).toContain('type="checkbox" disabled>');
    expect(result.html).toContain('type="checkbox" disabled checked>');
    expect(result.html).toContain('<span>Draft plan</span>');
    expect(result.html).toContain('<span>Ship preview</span>');
    expect(result.html).toContain('<li>Review feedback</li>');
  });

  it('renders unknown code languages as escaped plaintext', async () => {
    const result = await renderMarkdownToHtml('```madeup\nconst x = "<tag>";\n```');

    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('data-language="madeup"');
    expect(result.html).toContain('&lt;tag&gt;');
  });

  it('does not crash when Mermaid renderer is missing', async () => {
    const result = await renderMarkdownToHtml('```mermaid\ngraph TD\nA-->B\n```');

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('renderer.mermaid.missing');
    expect(result.html).toContain('me-renderer-error');
  });
});

describe('async renderer errors', () => {
  it('converts thrown Mermaid errors into explicit error results', async () => {
    const registry = createDefaultRendererRegistry({
      mermaid: async () => {
        throw new Error('invalid diagram');
      }
    });

    const result = await renderMarkdownToHtml('```mermaid\nnot valid\n```', { registry });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('renderer.mermaid.failed');
    expect(result.html).toContain('not valid');
  });

  it('converts thrown PlantUML host errors into explicit error results', async () => {
    const registry = createDefaultRendererRegistry({
      plantUml: {
        renderPlantUml: async () => {
          throw new Error('endpoint unavailable');
        }
      }
    });

    const result = await renderMarkdownToHtml('```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```', { registry });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('renderer.plantuml.failed');
    expect(result.html).toContain('@startuml');
  });

  it('renders PlantUML through the host renderer factory without network assumptions', async () => {
    const registry = createDefaultRendererRegistry({
      plantUml: createPlantUmlRenderer({
        renderPlantUml: async (source) => ({
          html: `<figure class="me-renderer-diagram me-renderer-plantuml">${source.includes('Alice') ? 'sequence' : 'diagram'}</figure>`
        })
      })
    });

    const result = await renderMarkdownToHtml('```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```', { registry });

    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('me-renderer-plantuml');
    expect(result.html).toContain('sequence');
  });

  it('turns PlantUML timeouts into inline error results', async () => {
    const registry = createDefaultRendererRegistry({
      plantUml: createPlantUmlRenderer({
        timeoutMs: 1,
        renderPlantUml: async () => new Promise(() => undefined)
      })
    });

    const result = await renderMarkdownToHtml('```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```', { registry });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('renderer.plantuml.failed');
    expect(result.html).toContain('@startuml');
  });

  it('caps a viewBox-only host SVG at its intrinsic width so small diagrams do not render huge', async () => {
    const registry = createDefaultRendererRegistry({
      plantUml: createPlantUmlRenderer({
        renderPlantUml: async () => ({
          html: '<figure class="me-renderer-diagram me-renderer-plantuml"><svg viewBox="0 0 520 170"><rect/></svg></figure>',
        }),
      }),
    });
    const result = await renderMarkdownToHtml('```plantuml\n@startuml\nA -> B\n@enduml\n```', { registry });
    expect(result.html).toContain('max-width:520px');
  });
});

describe('constrainDiagramSvgWidth', () => {
  it('adds max-width from the viewBox when no width is declared', () => {
    expect(constrainDiagramSvgWidth('<svg viewBox="0 0 300 120"><rect/></svg>')).toContain('max-width:300px');
  });

  it('merges into an existing style attribute', () => {
    const out = constrainDiagramSvgWidth('<svg viewBox="0 0 80 40" style="display:block"><rect/></svg>');
    expect(out).toContain('max-width:80px;display:block');
  });

  it('leaves SVGs that already declare a width or max-width untouched', () => {
    const withWidth = '<svg width="200" viewBox="0 0 200 100"></svg>';
    expect(constrainDiagramSvgWidth(withWidth)).toBe(withWidth);
    const withMax = '<svg viewBox="0 0 200 100" style="max-width:200px"></svg>';
    expect(constrainDiagramSvgWidth(withMax)).toBe(withMax);
  });

  it('ignores non-SVG output such as <img>', () => {
    const img = '<img src="x.png" alt="diagram">';
    expect(constrainDiagramSvgWidth(img)).toBe(img);
  });
});

describe('Shiki code renderer', () => {
  it('renders highlighted code through the registry code renderer slot', async () => {
    const registry = createDefaultRendererRegistry({
      shiki: createShikiCodeRenderer()
    });

    const result = await renderMarkdownToHtml('```ts\nconst mode: string = "preview";\n```', { registry });

    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('me-renderer-code-highlight');
    expect(result.html).toContain('class="shiki github-light"');
    expect(result.html).toContain('data-language="ts"');
  });

  it('falls back to plaintext highlighting for unsupported languages', async () => {
    const registry = createDefaultRendererRegistry({
      shiki: createShikiCodeRenderer()
    });

    const result = await renderMarkdownToHtml('```madeup\nconst x = "<tag>";\n```', { registry });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('renderer.code.language.unsupported');
    expect(result.html).toContain('data-language="madeup"');
    expect(result.html).toContain('const x');
    expect(result.html).not.toContain('<tag>');
  });
});
