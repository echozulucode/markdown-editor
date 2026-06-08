import { describe, it, expect, vi } from 'vitest';
import { MarkdownEditor } from '../src/index.js';
import { createDefaultRendererRegistry } from '@echozedlabs/renderers';
import { mount, flush } from './mount.js';

// A registry whose diagram renderer tags its output, so we can see which registry
// produced the current preview.
function registryEmitting(marker: string) {
  return createDefaultRendererRegistry({
    mermaid: async () => ({ ok: true, html: `<div class="${marker}">diagram</div>` }),
  });
}

const doc = ['# T', '', '```mermaid', 'graph TD', 'A --> B', '```'].join('\n');

describe('MarkdownEditor — preview reacts to renderer registry changes', () => {
  it('re-renders the preview when the registry changes and the markdown does not', async () => {
    const { container, rerender, unmount } = mount(
      <MarkdownEditor value={doc} modes={['preview']} initialMode="preview" readOnly renderers={registryEmitting('reg-a')} />,
    );
    for (let i = 0; i < 6; i += 1) await flush();
    expect(container.querySelector('.reg-a')).not.toBeNull();

    // Same markdown, different registry: the preview must update.
    rerender(
      <MarkdownEditor value={doc} modes={['preview']} initialMode="preview" readOnly renderers={registryEmitting('reg-b')} />,
    );
    for (let i = 0; i < 6; i += 1) await flush();
    expect(container.querySelector('.reg-b')).not.toBeNull();
    expect(container.querySelector('.reg-a')).toBeNull();

    unmount();
  });

  it('routes diagnostics to both onDiagnostics and hostServices.reportDiagnostics', async () => {
    const onDiagnostics = vi.fn();
    const reportDiagnostics = vi.fn();
    const registry = createDefaultRendererRegistry({
      mermaid: async () => ({
        ok: true,
        html: '<div>diag</div>',
        diagnostics: [{ code: 'test.diag', message: 'boom', severity: 'warning' as const }],
      }),
    });
    const { unmount } = mount(
      <MarkdownEditor
        value={doc}
        modes={['preview']}
        initialMode="preview"
        readOnly
        renderers={registry}
        onDiagnostics={onDiagnostics}
        hostServices={{ reportDiagnostics }}
      />,
    );
    for (let i = 0; i < 6; i += 1) await flush();

    expect(onDiagnostics).toHaveBeenCalled();
    expect(reportDiagnostics).toHaveBeenCalled();
    const reported = reportDiagnostics.mock.calls.at(-1)![0] as { code: string }[];
    expect(reported.some((d) => d.code === 'test.diag')).toBe(true);

    unmount();
  });
});
