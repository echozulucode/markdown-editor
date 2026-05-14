import React from 'react';
import type {
  ChangeMeta,
  EditorMode,
  MarkdownEditorHandle,
  MarkdownEditorProps,
  ModeChangeMeta,
  TextSelection,
} from '@markdown-editor/core';
import {
  createMarkdownEditorView,
  type CodeMirrorEditorMode,
  type MarkdownEditorViewHandle,
} from '@markdown-editor/codemirror';
import {
  createDefaultRendererRegistry,
  renderMarkdownToHtml,
  type RenderMarkdownToHtmlResult,
  type RendererRegistry,
} from '@markdown-editor/renderers';
import type { WysiwygToolbarIcons } from '@markdown-editor/wysiwyg-lexical';

const CODEMIRROR_MODES = new Set<EditorMode>(['markdown', 'hybrid']);
const DEFAULT_MODES: EditorMode[] = ['hybrid', 'markdown', 'preview'];
const LazyWysiwygLexicalEditor = React.lazy(async () => {
  const module = await import('@markdown-editor/wysiwyg-lexical');
  return { default: module.WysiwygLexicalEditor };
});

export interface MarkdownEditorComponentProps
  extends Omit<MarkdownEditorProps, 'extensions' | 'rendererRegistry' | 'renderers'> {
  renderers?: RendererRegistry;
  wysiwygToolbarIcons?: WysiwygToolbarIcons;
  className?: string;
}

export const MarkdownEditor = React.forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorComponentProps
>(function MarkdownEditor(
  {
    value,
    defaultValue = '',
    mode,
    defaultMode,
    initialMode,
    modes = DEFAULT_MODES,
    readOnly = false,
    className,
    ariaLabel = 'Markdown editor',
    onChange,
    onModeChange,
    onSaveShortcut,
    onCancelShortcut,
    onDiagnostics,
    renderers,
    hostServices,
    wysiwygToolbarIcons,
  },
  forwardedRef,
) {
  const allowedModes = React.useMemo(() => normalizeModes(modes), [modes]);
  const firstMode = initialMode ?? defaultMode ?? preferredInitialMode(allowedModes);
  const [internalMarkdown, setInternalMarkdown] = React.useState(defaultValue);
  const [internalMode, setInternalMode] = React.useState<EditorMode>(
    allowedModes.includes(firstMode) ? firstMode : preferredInitialMode(allowedModes),
  );
  const [showProperties, setShowProperties] = React.useState(true);
  const markdown = value ?? internalMarkdown;
  const activeMode = mode ?? internalMode;
  const hasFrontmatter = /^---\r?\n/.test(markdown);
  const showToolbar = allowedModes.length > 1 || (activeMode === 'hybrid' && hasFrontmatter);
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const cmRef = React.useRef<MarkdownEditorViewHandle | null>(null);
  const markdownRef = React.useRef(markdown);
  const modeRef = React.useRef(activeMode);
  const onChangeRef = React.useRef(onChange);
  const onSaveShortcutRef = React.useRef(onSaveShortcut);
  const onCancelShortcutRef = React.useRef(onCancelShortcut);
  const onDiagnosticsRef = React.useRef(onDiagnostics);

  markdownRef.current = markdown;
  modeRef.current = activeMode;
  onChangeRef.current = onChange;
  onSaveShortcutRef.current = onSaveShortcut;
  onCancelShortcutRef.current = onCancelShortcut;
  onDiagnosticsRef.current = onDiagnostics;

  const isCodeMirrorMode = CODEMIRROR_MODES.has(activeMode);
  const hybridRenderMarkdown = React.useCallback(
    async (blockMarkdown: string, context: { signal?: AbortSignal }) => {
      const activeRegistry = renderers ?? createDefaultRendererRegistry();
      const result = await renderMarkdownToHtml(blockMarkdown, {
        registry: activeRegistry,
        signal: context.signal,
      });
      onDiagnosticsRef.current?.(result.diagnostics);
      return { html: result.html };
    },
    [renderers],
  );
  const wysiwygRenderServices = React.useMemo(
    () => ({
      renderPlantUml: async (source: string, context: { signal?: AbortSignal }) => {
        if (hostServices?.renderPlantUml) {
          const result = await hostServices.renderPlantUml(source, { signal: context.signal });
          return { html: result.html, diagnostics: result.diagnostics };
        }

        const activeRegistry = renderers ?? createDefaultRendererRegistry();
        const result = await renderMarkdownToHtml(`\`\`\`plantuml\n${source}\n\`\`\``, {
          registry: activeRegistry,
          signal: context.signal,
        });
        return { html: result.html, diagnostics: result.diagnostics };
      },
    }),
    [hostServices, renderers],
  );

  React.useEffect(() => {
    if (!isCodeMirrorMode || !hostRef.current) {
      cmRef.current?.destroy();
      cmRef.current = null;
      return;
    }

    const cmMode = activeMode as CodeMirrorEditorMode;
    const handle = createMarkdownEditorView({
      parent: hostRef.current,
      markdown,
      mode: cmMode,
      readOnly,
      attributes: {
        'aria-label': ariaLabel,
        class: 'me-codemirror',
      },
      onChange: (nextMarkdown, meta) => {
        markdownRef.current = nextMarkdown;
        if (value === undefined) {
          setInternalMarkdown(nextMarkdown);
        }
        onChangeRef.current?.(nextMarkdown, {
          ...meta,
          mode: modeRef.current,
        });
      },
      hybridFrontmatterMode: showProperties ? 'table' : 'hidden',
      hybridRenderMarkdown,
    });

    cmRef.current = handle;
    return () => {
      handle.destroy();
      if (cmRef.current === handle) {
        cmRef.current = null;
      }
    };
  }, [ariaLabel, activeMode, hybridRenderMarkdown, isCodeMirrorMode, readOnly, showProperties]);

  React.useEffect(() => {
    const handle = cmRef.current;
    if (!handle) {
      return;
    }
    if (handle.getMarkdown() !== markdown) {
      handle.setMarkdown(markdown);
    }
  }, [markdown]);

  React.useEffect(() => {
    cmRef.current?.setReadOnly(readOnly || activeMode === 'preview');
  }, [activeMode, readOnly]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const save = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
      if (save) {
        event.preventDefault();
        onSaveShortcutRef.current?.();
        return;
      }

      if (event.key === 'Escape') {
        onCancelShortcutRef.current?.();
      }
    };

    const current = hostRef.current;
    current?.addEventListener('keydown', onKeyDown);
    return () => current?.removeEventListener('keydown', onKeyDown);
  }, []);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      focus() {
        cmRef.current?.focus();
      },
      getMarkdown() {
        return markdownRef.current;
      },
      setMarkdown(nextMarkdown: string) {
        updateMarkdown(nextMarkdown, 'programmatic');
      },
      getMode() {
        return modeRef.current;
      },
      setMode(nextMode: EditorMode) {
        selectMode(nextMode, 'programmatic');
      },
      getSelection() {
        const selection = cmRef.current?.getSelection();
        return selection ? cmSelectionToTextSelection(selection) : null;
      },
      setSelection(selection: TextSelection) {
        cmRef.current?.setSelection({
          anchor: selection.from,
          head: selection.to,
        });
      },
      insertMarkdown(insertedMarkdown: string) {
        if (cmRef.current) {
          cmRef.current.insertMarkdown(insertedMarkdown);
          return;
        }
        updateMarkdown(`${markdownRef.current}${insertedMarkdown}`, 'programmatic');
      },
      clearHistory() {
        // Native CodeMirror history is intentionally preserved for now.
      },
      getSnapshot() {
        return {
          markdown: markdownRef.current,
          version: 1,
          mode: modeRef.current,
          selection: undefined,
        };
      },
      replaceMarkdown(nextMarkdown: string, meta?: ChangeMeta) {
        updateMarkdown(nextMarkdown, meta?.source ?? 'programmatic');
        onChangeRef.current?.(nextMarkdown, {
          source: 'programmatic',
          timestamp: Date.now(),
          mode: modeRef.current,
          ...meta,
        });
      },
    }),
    [value],
  );

  function selectMode(nextMode: EditorMode, source: ModeChangeMeta['source'] = 'user') {
    if (!allowedModes.includes(nextMode) || nextMode === activeMode) {
      return;
    }

    const previousMode = activeMode;
    if (mode === undefined) {
      setInternalMode(nextMode);
    }

    onModeChange?.(nextMode, {
      previousMode,
      nextMode,
      source,
      timestamp: Date.now(),
    });
  }

  function updateMarkdown(nextMarkdown: string, source: ChangeMeta['source']) {
    markdownRef.current = nextMarkdown;
    cmRef.current?.setMarkdown(nextMarkdown, { emitChange: true });
    if (value === undefined) {
      setInternalMarkdown(nextMarkdown);
    }
    onChangeRef.current?.(nextMarkdown, {
      source,
      mode: modeRef.current,
      timestamp: Date.now(),
    });
  }

  return (
    <section
      className={['me-editor', className].filter(Boolean).join(' ')}
      data-mode={activeMode}
      data-readonly={readOnly ? 'true' : 'false'}
      aria-label={ariaLabel}
    >
      {showToolbar ? (
        <div className="me-toolbar" role="toolbar" aria-label="Editor controls">
          {allowedModes.length > 1
            ? allowedModes.map((allowedMode) => (
                <button
                  key={allowedMode}
                  type="button"
                  className="me-mode-button"
                  data-active={allowedMode === activeMode ? 'true' : 'false'}
                  aria-pressed={allowedMode === activeMode}
                  onClick={() => selectMode(allowedMode)}
                >
                  {modeLabel(allowedMode)}
                </button>
              ))
            : null}
          {activeMode === 'hybrid' && hasFrontmatter ? (
            <button
              type="button"
              className="me-mode-button me-properties-toggle"
              data-active={showProperties ? 'true' : 'false'}
              aria-pressed={showProperties}
              onClick={() => setShowProperties((current) => !current)}
            >
              {showProperties ? 'Hide properties' : 'Show properties'}
            </button>
          ) : null}
        </div>
      ) : null}

      {isCodeMirrorMode ? (
        <div ref={hostRef} className="me-editor-surface" />
      ) : activeMode === 'preview' ? (
        <PreviewSurface
          markdown={markdown}
          registry={renderers}
          onDiagnostics={(diagnostics) => onDiagnosticsRef.current?.(diagnostics)}
        />
      ) : (
        <React.Suspense fallback={<div className="me-wysiwyg-loading" role="status">Loading WYSIWYG editor...</div>}>
          <LazyWysiwygLexicalEditor
            markdown={markdown}
            readOnly={readOnly}
            ariaLabel={ariaLabel}
            renderServices={wysiwygRenderServices}
            toolbarIcons={wysiwygToolbarIcons}
            onDiagnostics={(diagnostics) => onDiagnosticsRef.current?.(diagnostics)}
            onChange={(nextMarkdown, meta) => {
              markdownRef.current = nextMarkdown;
              if (value === undefined) {
                setInternalMarkdown(nextMarkdown);
              }
              onChange?.(nextMarkdown, {
                ...meta,
                mode: activeMode,
              });
            }}
          />
        </React.Suspense>
      )}
    </section>
  );
});

function PreviewSurface({
  markdown,
  registry,
  onDiagnostics,
}: {
  markdown: string;
  registry?: RendererRegistry;
  onDiagnostics(diagnostics: NonNullable<RenderMarkdownToHtmlResult['diagnostics']>): void;
}) {
  const [result, setResult] = React.useState<RenderMarkdownToHtmlResult | null>(null);
  const registryRef = React.useRef<RendererRegistry | undefined>(registry);
  registryRef.current = registry;

  React.useEffect(() => {
    const controller = new AbortController();
    const activeRegistry = registryRef.current ?? createDefaultRendererRegistry();

    renderMarkdownToHtml(markdown, {
      registry: activeRegistry,
      signal: controller.signal,
    })
      .then((nextResult: RenderMarkdownToHtmlResult) => {
        if (controller.signal.aborted) {
          return;
        }
        setResult(nextResult);
        onDiagnostics(nextResult.diagnostics);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        const diagnostics = [
          {
            code: 'preview.render.failed',
            message,
            severity: 'error' as const,
            source: 'renderer',
          },
        ];
        setResult({
          html: `<pre class="me-preview-error">${escapeHtml(markdown)}</pre>`,
          blocks: [],
          diagnostics,
        });
        onDiagnostics(diagnostics);
      });

    return () => controller.abort();
  }, [markdown, onDiagnostics]);

  return (
    <div
      className="me-preview"
      aria-label="Markdown preview"
      dangerouslySetInnerHTML={{ __html: result?.html ?? '<p>Rendering preview...</p>' }}
    />
  );
}

function normalizeModes(modes: readonly EditorMode[]): EditorMode[] {
  const normalized = modes.filter((modeName, index) => modes.indexOf(modeName) === index);
  return normalized.length > 0 ? normalized : DEFAULT_MODES;
}

function preferredInitialMode(modes: readonly EditorMode[]): EditorMode {
  return modes.includes('hybrid') ? 'hybrid' : modes[0] ?? 'markdown';
}

function modeLabel(mode: EditorMode): string {
  switch (mode) {
    case 'markdown':
      return 'Markdown';
    case 'hybrid':
      return 'Hybrid';
    case 'preview':
      return 'Preview';
    case 'wysiwyg':
      return 'WYSIWYG';
  }
}

function cmSelectionToTextSelection(selection: { anchor: number; head: number }): TextSelection {
  return {
    from: Math.min(selection.anchor, selection.head),
    to: Math.max(selection.anchor, selection.head),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
