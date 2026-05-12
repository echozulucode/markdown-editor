import { describe, expect, it } from 'vitest';
import { createDefaultRendererRegistry, renderMarkdownToHtml } from '../src';

describe('renderer fallbacks', () => {
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
