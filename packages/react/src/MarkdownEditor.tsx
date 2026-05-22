import React from 'react';
import type {
  ChangeMeta,
  EditorMode,
  HostServices,
  LinkSuggestion,
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
  /** Host-supplied icons for the top-level mode switcher. Keep icon packs out of the reusable package. */
  modeIcons?: Partial<Record<EditorMode, React.ReactNode>>;
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
    propertySchema,
    frontmatterDisplay,
    modeIcons,
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
  const normalizedFrontmatterDisplay = frontmatterDisplay ?? 'expanded';
  const [showProperties, setShowProperties] = React.useState(normalizedFrontmatterDisplay !== 'hidden');
  const markdown = value ?? internalMarkdown;
  const activeMode = mode ?? internalMode;
  const hasFrontmatter = /^---\r?\n/.test(markdown);
  const hasHostServiceControls =
    !readOnly && activeMode !== 'preview' && (hostServices?.searchLinks !== undefined || hostServices?.uploadAsset !== undefined);
  const showToolbar = allowedModes.length > 1 || (activeMode === 'hybrid' && hasFrontmatter) || hasHostServiceControls;
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
  const emitDiagnostics = React.useCallback((diagnostics: Parameters<NonNullable<MarkdownEditorProps['onDiagnostics']>>[0]) => {
    onDiagnosticsRef.current?.(diagnostics);
  }, []);

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
      hybridFrontmatterMode: showProperties
        ? normalizedFrontmatterDisplay === 'collapsed'
          ? 'collapsed'
          : 'table'
        : 'hidden',
      frontmatterSchema: propertySchema,
      hybridRenderMarkdown,
    });

    cmRef.current = handle;
    return () => {
      handle.destroy();
      if (cmRef.current === handle) {
        cmRef.current = null;
      }
    };
  }, [ariaLabel, activeMode, hybridRenderMarkdown, isCodeMirrorMode, normalizedFrontmatterDisplay, propertySchema, readOnly, showProperties]);

  React.useEffect(() => {
    setShowProperties(normalizedFrontmatterDisplay !== 'hidden');
  }, [normalizedFrontmatterDisplay]);

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

  function insertHostMarkdown(insertedMarkdown: string) {
    if (!insertedMarkdown || readOnly || activeMode === 'preview') {
      return;
    }

    if (cmRef.current) {
      cmRef.current.insertMarkdown(insertedMarkdown);
      return;
    }

    const separator = markdownRef.current.length > 0 && !markdownRef.current.endsWith('\n') ? '\n' : '';
    updateMarkdown(`${markdownRef.current}${separator}${insertedMarkdown}`, 'host');
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
            ? allowedModes.map((allowedMode) => {
                const label = modeLabel(allowedMode);
                const icon = modeIcons?.[allowedMode];
                return (
                  <button
                    key={allowedMode}
                    type="button"
                    className="me-mode-button"
                    data-active={allowedMode === activeMode ? 'true' : 'false'}
                    data-icon-only={icon ? 'true' : 'false'}
                    aria-label={label}
                    title={label}
                    aria-pressed={allowedMode === activeMode}
                    onClick={() => selectMode(allowedMode)}
                  >
                    {icon ? <span className="me-mode-button-icon" aria-hidden="true">{icon}</span> : null}
                    <span className={icon ? 'me-sr-only' : undefined}>{label}</span>
                  </button>
                );
              })
            : null}
          {activeMode === 'hybrid' && hasFrontmatter ? (
            <button
              type="button"
              className="me-mode-button me-properties-toggle"
              data-active={showProperties ? 'true' : 'false'}
              data-icon-only="true"
              aria-label={showProperties ? 'Hide properties' : 'Show properties'}
              title={showProperties ? 'Hide properties' : 'Show properties'}
              aria-pressed={showProperties}
              onClick={() => setShowProperties((current) => !current)}
            >
              <span className="me-mode-button-icon" aria-hidden="true">
                {showProperties ? <IconSvg path={EYE_SLASH_ICON_PATH} /> : <IconSvg path={EYE_ICON_PATH} />}
              </span>
              <span className="me-sr-only">{showProperties ? 'Hide properties' : 'Show properties'}</span>
            </button>
          ) : null}
          {hasHostServiceControls ? (
            <HostServiceToolbar
              services={hostServices}
              onInsertMarkdown={insertHostMarkdown}
              onDiagnostics={emitDiagnostics}
            />
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

function IconSvg({ path }: { path: string }) {
  return (
    <svg className="me-inline-icon" viewBox="0 0 576 512" focusable="false" aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

const EYE_ICON_PATH = 'M288 80c-65.2 0-118.8 29.6-159.9 67.7C89.6 183.5 63 226 49.4 256c13.6 30 40.2 72.5 78.7 108.3C169.2 402.4 222.8 432 288 432s118.8-29.6 159.9-67.7c38.5-35.8 65.1-78.3 78.7-108.3c-13.6-30-40.2-72.5-78.7-108.3C406.8 109.6 353.2 80 288 80zm0 304a128 128 0 1 1 0-256 128 128 0 1 1 0 256zm0-208a80 80 0 1 0 0 160 80 80 0 1 0 0-160z';
const EYE_SLASH_ICON_PATH = 'M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l528 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L432 350.5c37.1-33.2 63.7-73.2 77.6-94.5C474.2 201.8 397.3 96 288 96c-31.3 0-60.6 8.7-87.2 22.8L38.8 5.1zM288 416c31.3 0 60.6-8.7 87.2-22.8L302.7 329.4c-4.7 1.7-9.6 2.6-14.7 2.6a44 44 0 0 1-44-44c0-5.1 .9-10 2.6-14.7L159.9 197C119.8 227.3 91.7 268.8 76.4 288C111.8 342.2 178.7 416 288 416z';

function HostServiceToolbar({
  services,
  onInsertMarkdown,
  onDiagnostics,
}: {
  services?: HostServices;
  onInsertMarkdown(markdown: string): void;
  onDiagnostics(diagnostics: Parameters<NonNullable<MarkdownEditorProps['onDiagnostics']>>[0]): void;
}) {
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<LinkSuggestion[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputId = React.useId();

  React.useEffect(() => {
    if (!services?.searchLinks || query.trim().length === 0) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    services.searchLinks(query.trim(), controller.signal)
      .then((nextSuggestions) => {
        if (!controller.signal.aborted) {
          setSuggestions(nextSuggestions);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        onDiagnostics([{
          code: 'host.searchLinks.failed',
          message,
          severity: 'error',
          source: 'host-service',
        }]);
        setSuggestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      });

    return () => controller.abort();
  }, [onDiagnostics, query, services]);

  async function uploadFile(file: File) {
    if (!services?.uploadAsset) {
      return;
    }

    const controller = new AbortController();
    setUploading(true);
    try {
      const asset = await services.uploadAsset(file, controller.signal);
      const alt = (asset.alt ?? file.name.replace(/\.[^.]+$/, '')) || 'Uploaded image';
      onInsertMarkdown(`\n\n![${escapeMarkdownLabel(alt)}](${asset.url})\n`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      onDiagnostics([{
        code: 'host.uploadAsset.failed',
        message,
        severity: 'error',
        source: 'host-service',
      }]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="me-host-tools" aria-label="Host services">
      {services?.searchLinks ? (
        <div className="me-link-search">
          <label className="me-visually-hidden" htmlFor={`${fileInputId}-link-search`}>
            Search pages
          </label>
          <input
            id={`${fileInputId}-link-search`}
            type="search"
            value={query}
            placeholder="Search pages"
            aria-label="Search pages"
            aria-controls={`${fileInputId}-link-suggestions`}
            aria-expanded={suggestions.length > 0}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query.trim().length > 0 ? (
            <div
              id={`${fileInputId}-link-suggestions`}
              className="me-link-suggestions"
              role="listbox"
              aria-label="Page suggestions"
            >
              {searching ? <div className="me-link-suggestion-status">Searching...</div> : null}
              {!searching && suggestions.length === 0 ? (
                <div className="me-link-suggestion-status">No matches</div>
              ) : null}
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  className="me-link-suggestion"
                  onClick={() => {
                    onInsertMarkdown(suggestion.insertText);
                    setQuery('');
                    setSuggestions([]);
                  }}
                >
                  <span>{suggestion.label}</span>
                  {suggestion.description ? <small>{suggestion.description}</small> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {services?.uploadAsset ? (
        <div className="me-upload-control">
          <input
            id={`${fileInputId}-asset-upload`}
            type="file"
            accept="image/*"
            aria-label="Upload image"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) {
                void uploadFile(file);
              }
            }}
          />
          <label className="me-upload-button" htmlFor={`${fileInputId}-asset-upload`}>
            {uploading ? 'Uploading...' : 'Upload image'}
          </label>
        </div>
      ) : null}
    </div>
  );
}

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

function escapeMarkdownLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}
