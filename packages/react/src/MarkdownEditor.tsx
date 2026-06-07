import React from 'react';
import type {
  ChangeMeta,
  EditorMode,
  MarkdownEditorHandle,
  MarkdownEditorProps,
  ModeChangeMeta,
  TextSelection,
} from '@echozedlabs/core';
import {
  createMarkdownEditorView,
  type CodeMirrorEditorMode,
  type MarkdownEditorViewHandle,
} from '@echozedlabs/codemirror';
import {
  createDefaultRendererRegistry,
  renderMarkdownToHtml,
  type RendererRegistry,
} from '@echozedlabs/renderers';
import type { WysiwygToolbarIcons } from '@echozedlabs/wysiwyg-lexical';
import { sanitizePreviewHtml } from './sanitizeHtml.js';
import { PreviewSurface } from './PreviewSurface.js';
import { HostServiceToolbar } from './HostServiceToolbar.js';
import { IconSvg, LIST_ICON_PATH, SLIDERS_ICON_PATH } from './icons.js';

const CODEMIRROR_MODES = new Set<EditorMode>(['markdown', 'hybrid']);
const DEFAULT_MODES: EditorMode[] = ['hybrid', 'markdown', 'preview'];
const LazyWysiwygLexicalEditor = React.lazy(async () => {
  const module = await import('@echozedlabs/wysiwyg-lexical');
  return { default: module.WysiwygLexicalEditor };
});

export interface MarkdownEditorComponentProps
  extends Omit<MarkdownEditorProps, 'extensions' | 'rendererRegistry' | 'renderers'> {
  renderers?: RendererRegistry;
  /** Host-supplied icons for the top-level mode switcher. Keep icon packs out of the reusable package. */
  modeIcons?: Partial<Record<EditorMode, React.ReactNode>>;
  /** Whether host service controls such as the explicit link-search box should render in the toolbar. */
  hostServiceToolbar?: boolean;
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
    hostServiceToolbar = true,
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
  // If `modes` changes so the current internal mode is no longer permitted — e.g.
  // a host reuses this editor instance for a different surface, or React
  // reconciles one usage into another — fall back to a valid mode rather than
  // rendering a mode outside `modes` (which would show no surface at all).
  const fallbackMode = allowedModes.includes(firstMode) ? firstMode : preferredInitialMode(allowedModes);
  const resolvedInternalMode = allowedModes.includes(internalMode) ? internalMode : fallbackMode;
  React.useEffect(() => {
    if (!allowedModes.includes(internalMode)) {
      setInternalMode(fallbackMode);
    }
  }, [allowedModes, internalMode, fallbackMode]);
  const normalizedFrontmatterDisplay = frontmatterDisplay ?? 'expanded';
  const [showProperties, setShowProperties] = React.useState(normalizedFrontmatterDisplay !== 'hidden');
  const markdown = value ?? internalMarkdown;
  const activeMode = mode ?? resolvedInternalMode;
  const hasFrontmatter = /^---\r?\n/.test(markdown);
  const hasHostServiceControls =
    !readOnly && hostServiceToolbar && activeMode !== 'preview' && (hostServices?.searchLinks !== undefined || hostServices?.uploadAsset !== undefined);
  const showToolbar = allowedModes.length > 1 || (activeMode === 'hybrid' && hasFrontmatter) || hasHostServiceControls;
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const cmRef = React.useRef<MarkdownEditorViewHandle | null>(null);
  const markdownRef = React.useRef(markdown);
  const modeRef = React.useRef(activeMode);
  const onChangeRef = React.useRef(onChange);
  const onSaveShortcutRef = React.useRef(onSaveShortcut);
  const onCancelShortcutRef = React.useRef(onCancelShortcut);
  const onDiagnosticsRef = React.useRef(onDiagnostics);
  const hostServicesRef = React.useRef(hostServices);

  markdownRef.current = markdown;
  modeRef.current = activeMode;
  onChangeRef.current = onChange;
  onSaveShortcutRef.current = onSaveShortcut;
  onCancelShortcutRef.current = onCancelShortcut;
  onDiagnosticsRef.current = onDiagnostics;
  hostServicesRef.current = hostServices;

  const isCodeMirrorMode = CODEMIRROR_MODES.has(activeMode);
  const hybridRenderMarkdown = React.useCallback(
    async (blockMarkdown: string, context: { signal?: AbortSignal }) => {
      const activeRegistry = renderers ?? createDefaultRendererRegistry();
      const result = await renderMarkdownToHtml(blockMarkdown, {
        registry: activeRegistry,
        signal: context.signal,
      });
      onDiagnosticsRef.current?.(result.diagnostics);
      // Sanitize before the hybrid widget injects it, exactly as the preview
      // surface does — otherwise hybrid would be an unsanitized XSS path while
      // preview is protected.
      return { html: sanitizePreviewHtml(result.html) };
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
  // Single diagnostics dispatch: both public channels (the onDiagnostics prop and
  // the optional hostServices.reportDiagnostics) receive every diagnostic, so a
  // host can use either without ambiguity.
  const emitDiagnostics = React.useCallback((diagnostics: Parameters<NonNullable<MarkdownEditorProps['onDiagnostics']>>[0]) => {
    onDiagnosticsRef.current?.(diagnostics);
    hostServicesRef.current?.reportDiagnostics?.(diagnostics);
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
    // Recreate ONLY for true surface changes (entering/leaving CodeMirror, a new
    // aria-label, a new property schema, or a new hybrid renderer). markdown<->hybrid,
    // read-only, and show/hide-properties are reconfigured in place below so they
    // keep selection, scroll, and undo history. `readOnly`/`activeMode`/properties
    // values are read at creation and corrected by the in-place effects.
  }, [ariaLabel, hybridRenderMarkdown, isCodeMirrorMode, propertySchema]);

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

  // Reconfigure mode + frontmatter display in place (keeps selection, scroll, and
  // undo history) instead of recreating the view on markdown<->hybrid or
  // show/hide-properties changes.
  React.useEffect(() => {
    const handle = cmRef.current;
    if (!handle || !isCodeMirrorMode) {
      return;
    }
    const hybridFrontmatterMode = showProperties
      ? normalizedFrontmatterDisplay === 'collapsed'
        ? 'collapsed'
        : 'table'
      : 'hidden';
    handle.setMode(activeMode as CodeMirrorEditorMode, hybridFrontmatterMode);
  }, [activeMode, showProperties, normalizedFrontmatterDisplay, isCodeMirrorMode]);

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
        const cmSelection = cmRef.current?.getSelection();
        const textSelection = cmSelection ? cmSelectionToTextSelection(cmSelection) : null;
        return {
          markdown: markdownRef.current,
          version: 1,
          mode: modeRef.current,
          selection: textSelection
            ? { ranges: [{ anchor: textSelection.from, head: textSelection.to }], mainIndex: 0 }
            : undefined,
        };
      },
      replaceMarkdown(nextMarkdown: string, meta?: ChangeMeta) {
        // updateMarkdown emits exactly one onChange (React is the single source).
        updateMarkdown(nextMarkdown, meta?.source ?? 'programmatic', meta);
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

  function updateMarkdown(nextMarkdown: string, source: ChangeMeta['source'], meta?: Partial<ChangeMeta>) {
    markdownRef.current = nextMarkdown;
    // React is the single emit source for imperative paths: set the document
    // silently so CodeMirror does not also fire onChange (avoids a double-fire).
    cmRef.current?.setMarkdown(nextMarkdown, { emitChange: false });
    if (value === undefined) {
      setInternalMarkdown(nextMarkdown);
    }
    onChangeRef.current?.(nextMarkdown, {
      source,
      mode: modeRef.current,
      timestamp: Date.now(),
      ...meta,
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
                {showProperties ? <IconSvg path={SLIDERS_ICON_PATH} dataIcon="sliders" /> : <IconSvg path={LIST_ICON_PATH} dataIcon="list" />}
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
          onDiagnostics={emitDiagnostics}
        />
      ) : (
        <React.Suspense fallback={<div className="me-wysiwyg-loading" role="status">Loading rich text editor...</div>}>
          <LazyWysiwygLexicalEditor
            markdown={markdown}
            readOnly={readOnly}
            ariaLabel={ariaLabel}
            renderServices={wysiwygRenderServices}
            toolbarIcons={wysiwygToolbarIcons}
            onDiagnostics={emitDiagnostics}
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
      // Modern, user-facing name for the WYSIWYG mode. The internal mode key
      // stays 'wysiwyg' for API stability.
      return 'Rich Text';
  }
}

function cmSelectionToTextSelection(selection: { anchor: number; head: number }): TextSelection {
  return {
    from: Math.min(selection.anchor, selection.head),
    to: Math.max(selection.anchor, selection.head),
  };
}
