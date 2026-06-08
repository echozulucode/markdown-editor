import React from 'react';
import type { HostServices, LinkSuggestion, MarkdownEditorProps } from '@echozedlabs/core';

/** Optional toolbar controls backed by host services (link search + asset upload). */
export function HostServiceToolbar({
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

function escapeMarkdownLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}
