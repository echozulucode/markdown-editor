import { describe, expect, it } from 'vitest';
import { createDefaultRendererRegistry, createShikiCodeRenderer, renderMarkdownToHtml } from '../src';

describe('renderer fallbacks', () => {
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
