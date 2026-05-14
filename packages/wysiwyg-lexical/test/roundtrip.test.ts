import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '@markdown-editor/core';
import { roundTripWysiwygMarkdown } from '../src';

describe('roundTripWysiwygMarkdown', () => {
  it('preserves leading frontmatter while round-tripping body markdown', () => {
    const markdown = ['---', 'title: WYSIWYG', 'tags: editor, mvp', '---', '# Heading', '', 'Plain body.'].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('---\ntitle: WYSIWYG\ntags: editor, mvp\n---\n');
    expect(result).toContain('# Heading');
    expect(result).toContain('Plain body.');
    expect(parseMarkdown(result).frontmatter.title).toBe('WYSIWYG');
  });

  it('keeps common prose constructs editable through Lexical markdown import and export', () => {
    const markdown = [
      '## Work item',
      '',
      'A paragraph with **bold**, *italic*, `code`, and [docs](https://example.test).',
      '',
      '- one',
      '- two',
      '',
      '> quoted',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('## Work item');
    expect(result).toContain('**bold**');
    expect(result).toContain('*italic*');
    expect(result).toContain('`code`');
    expect(result).toContain('[docs](https://example.test)');
    expect(result).toContain('- one');
    expect(result).toContain('> quoted');
    expect(result).toContain('```ts');
    expect(result).toContain('const value = 1;');
  });

  it('round-trips Mermaid diagrams as rendered WYSIWYG diagram nodes', () => {
    const markdown = ['Before', '', '```mermaid', 'graph TD', '  A-->B', '```', '', 'After'].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('```mermaid');
    expect(result).toContain('graph TD');
    expect(result).toContain('A-->B');
    expect(result).toContain('```');
  });

  it('keeps checkbox list items editable through WYSIWYG round trips', () => {
    const markdown = ['- [ ] Draft toolbar', '- [x] Render checkbox state'].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('- [ ] Draft toolbar');
    expect(result).toContain('- [x] Render checkbox state');
  });
});
