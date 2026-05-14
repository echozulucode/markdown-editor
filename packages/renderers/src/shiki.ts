import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { escapeAttribute, escapeHtml } from './escape';
import type { AsyncCodeRenderer, CodeRendererOptions, RendererDiagnostic, RendererResult } from './types';

type ShikiLanguage = keyof typeof LANGUAGE_LOADERS;
type ShikiTheme = keyof typeof THEME_LOADERS;

export interface ShikiCodeRendererOptions {
  theme?: ShikiTheme;
  languages?: ShikiLanguage[];
  fallbackLanguage?: 'text' | 'plaintext';
}

const DEFAULT_THEME: ShikiTheme = 'github-light';
const DEFAULT_FALLBACK_LANGUAGE = 'text';
const DEFAULT_LANGUAGES: ShikiLanguage[] = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'json',
  'yaml',
  'markdown',
  'html',
  'css',
  'sql'
];

const LANGUAGE_LOADERS = {
  bash: () => import('shiki/langs/bash.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs')
};

const THEME_LOADERS = {
  'github-light': () => import('shiki/themes/github-light.mjs')
};

const LANGUAGE_ALIASES: Record<string, ShikiLanguage> = {
  cjs: 'javascript',
  js: 'javascript',
  jsx: 'jsx',
  md: 'markdown',
  mjs: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  tsx: 'tsx',
  yml: 'yaml'
};

export function createShikiCodeRenderer(options: ShikiCodeRendererOptions = {}): AsyncCodeRenderer {
  const theme = options.theme ?? DEFAULT_THEME;
  const fallbackLanguage = options.fallbackLanguage ?? DEFAULT_FALLBACK_LANGUAGE;
  const languages: ShikiLanguage[] = [
    ...new Set<ShikiLanguage>([...(options.languages ?? DEFAULT_LANGUAGES), 'shellscript'])
  ];
  let highlighterPromise: Promise<HighlighterCore> | undefined;

  return async ({ language, source, blockId }: CodeRendererOptions): Promise<RendererResult> => {
    const requestedLanguage = language?.trim().toLowerCase();
    const normalizedLanguage = normalizeLanguage(requestedLanguage);
    const diagnostics =
      requestedLanguage && !normalizedLanguage ? fallbackDiagnostic(requestedLanguage, blockId, undefined) : undefined;

    try {
      const highlighter = await getHighlighter();
      const html = highlighter.codeToHtml(source, {
        lang: normalizedLanguage ?? fallbackLanguage,
        theme
      });
      return ok(wrapHighlightedCode(html, requestedLanguage), diagnostics);
    } catch (cause) {
      const highlighter = await getHighlighter();

      try {
        const html = highlighter.codeToHtml(source, {
          lang: fallbackLanguage,
          theme
        });
        return ok(wrapHighlightedCode(html, requestedLanguage), fallbackDiagnostic(requestedLanguage, blockId, cause));
      } catch (fallbackCause) {
        return failure(source, requestedLanguage, blockId, fallbackCause);
      }
    }
  };

  function getHighlighter(): Promise<HighlighterCore> {
    highlighterPromise ??= createHighlighterCore({
      themes: [THEME_LOADERS[theme]],
      langs: languages.map((languageName) => LANGUAGE_LOADERS[languageName]),
      langAlias: {
        cjs: 'javascript',
        js: 'javascript',
        md: 'markdown',
        mjs: 'javascript',
        py: 'python',
        sh: 'bash',
        shell: 'bash',
        ts: 'typescript',
        yml: 'yaml'
      },
      engine: createJavaScriptRegexEngine()
    });

    return highlighterPromise;
  }
}

function wrapHighlightedCode(html: string, requestedLanguage?: string): string {
  const language = requestedLanguage ? ` data-language="${escapeAttribute(requestedLanguage)}"` : '';
  return `<div class="me-renderer-code-highlight"${language}>${html}</div>`;
}

function fallbackDiagnostic(
  requestedLanguage: string | undefined,
  blockId: string,
  cause: unknown
): RendererDiagnostic[] | undefined {
  if (!requestedLanguage) {
    return undefined;
  }

  return [
    {
      severity: 'warning',
      code: 'renderer.code.language.unsupported',
      message: `Language "${requestedLanguage}" is not available to Shiki; rendered with plaintext highlighting.`,
      blockId,
      cause
    }
  ];
}

function normalizeLanguage(language: string | undefined): ShikiLanguage | undefined {
  if (!language) {
    return undefined;
  }

  if (language in LANGUAGE_LOADERS) {
    return language as ShikiLanguage;
  }

  return LANGUAGE_ALIASES[language];
}

function failure(source: string, requestedLanguage: string | undefined, blockId: string, cause: unknown): RendererResult {
  const language = requestedLanguage ? ` data-language="${escapeAttribute(requestedLanguage)}"` : '';
  const error: RendererDiagnostic = {
    severity: 'error',
    code: 'renderer.code.shiki.failed',
    message: 'Shiki highlighter failed; rendered plaintext fallback.',
    blockId,
    cause
  };

  return {
    ok: false,
    html: `<pre class="me-renderer-error"${language}><code>${escapeHtml(source)}</code></pre>`,
    error,
    diagnostics: [error]
  };
}

function ok(html: string, diagnostics?: RendererDiagnostic[]): RendererResult {
  return diagnostics?.length ? { ok: true, html, diagnostics } : { ok: true, html };
}
