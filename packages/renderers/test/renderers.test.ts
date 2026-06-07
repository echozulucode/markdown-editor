import { describe, expect, it } from 'vitest';
import { constrainDiagramSvgWidth, createDefaultRendererRegistry, createPlantUmlRenderer, createShikiCodeRenderer, renderInline, renderMarkdownToHtml } from '../src';

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

describe('inline Markdown', () => {
  it('renders bold, italic, inline code, and strikethrough', () => {
    expect(renderInline('**bold** and *italic* and `code` and ~~gone~~')).toBe(
      '<strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del>',
    );
  });

  it('renders the __bold__ and _italic_ underscore forms', () => {
    expect(renderInline('__b__ _i_')).toBe('<strong>b</strong> <em>i</em>');
  });

  it('renders wiki links, with and without an alias', () => {
    expect(renderInline('See [[Renderer Registry]] now')).toBe(
      'See <a class="me-renderer-wiki-link" data-wiki-target="Renderer Registry">Renderer Registry</a> now',
    );
    expect(renderInline('See [[Renderer Registry|the registry]]')).toBe(
      'See <a class="me-renderer-wiki-link" data-wiki-target="Renderer Registry">the registry</a>',
    );
  });

  it('does not italicize intraword underscores (snake_case)', () => {
    expect(renderInline('use snake_case_names here')).toBe('use snake_case_names here');
  });

  it('renders safe links and rejects dangerous schemes', () => {
    expect(renderInline('[site](https://echozed.com)')).toBe(
      '<a href="https://echozed.com" rel="noopener noreferrer">site</a>',
    );
    expect(renderInline('[x](javascript:alert(1))')).toBe('[x](javascript:alert(1))');
  });

  it('escapes HTML and blocks injection', () => {
    expect(renderInline('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(renderInline('a & b < c')).toBe('a &amp; b &lt; c');
  });

  it('leaves code-span contents untouched by emphasis', () => {
    expect(renderInline('`a*b*c`')).toBe('<code>a*b*c</code>');
  });

  it('flows through the registry for paragraphs and headings', async () => {
    const result = await renderMarkdownToHtml(
      '# A **bold** title\n\nSee [echozed](https://echozed.com) for *more*.',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('<h1>A <strong>bold</strong> title</h1>');
    expect(result.html).toContain('<a href="https://echozed.com" rel="noopener noreferrer">echozed</a>');
    expect(result.html).toContain('<em>more</em>');
    expect(result.html).not.toContain('**');
  });
});
