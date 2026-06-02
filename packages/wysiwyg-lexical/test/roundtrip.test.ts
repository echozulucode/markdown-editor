import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '@echozedlabs/core';
import {
  applyWysiwygTableActionForTests,
  inspectWysiwygMarkdownForTests,
  inspectWysiwygMarkdownTablesForTests,
  roundTripWysiwygMarkdown,
} from '../src';

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

  it('imports checkbox list markdown as checklist nodes instead of literal marker text', () => {
    const markdown = ['- [ ] Draft toolbar', '- [x] Render checkbox state'].join('\n');

    const [list] = inspectWysiwygMarkdownForTests(markdown);

    expect(list).toEqual({
      type: 'list',
      listType: 'check',
      items: [
        { checked: false, text: 'Draft toolbar' },
        { checked: true, text: 'Render checkbox state' },
      ],
    });
  });

  it('round-trips PlantUML diagrams as source-backed WYSIWYG diagram nodes', () => {
    const markdown = ['```plantuml', '@startuml', 'Alice -> Bob: Hello', '@enduml', '```'].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('```plantuml');
    expect(result).toContain('@startuml');
    expect(result).toContain('Alice -> Bob: Hello');
    expect(result).toContain('@enduml');
  });

  it('round-trips Markdown images as editable WYSIWYG image nodes', () => {
    const markdown = '![Architecture diagram](https://example.test/diagram.png "System overview")';

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('![Architecture diagram](https://example.test/diagram.png "System overview")');
  });

  it('imports GFM tables as editable WYSIWYG table nodes', () => {
    const markdown = [
      '| Name | Owner | Status |',
      '| --- | --- | --- |',
      '| Runbook | Platform | Draft |',
      '| Release notes | Docs | Ready |',
    ].join('\n');

    const [table] = inspectWysiwygMarkdownTablesForTests(markdown);

    expect(table).toEqual({
      type: 'table',
      rows: [
        ['Name', 'Owner', 'Status'],
        ['Runbook', 'Platform', 'Draft'],
        ['Release notes', 'Docs', 'Ready'],
      ],
    });
  });

  it('round-trips GFM tables through Markdown table syntax', () => {
    const markdown = [
      'Before',
      '',
      '| Name | Owner | Status |',
      '| --- | --- | --- |',
      '| Runbook | Platform | Draft |',
      '',
      'After',
    ].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('| Name | Owner | Status |');
    expect(result).toContain('| --- | --- | --- |');
    expect(result).toContain('| Runbook | Platform | Draft |');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('documents accepted WYSIWYG table normalizations', () => {
    const markdown = [
      '| Feature | State | Notes |',
      '| :--- | ---: | :---: |',
      '| Tables | MVP | keeps escaped A \\| B |',
      '| Missing note | padded |',
      '| Extra | cells | are | ignored |',
    ].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toBe([
      '| Feature | State | Notes |',
      '| --- | --- | --- |',
      '| Tables | MVP | keeps escaped A \\| B |',
      '| Missing note | padded |  |',
      '| Extra | cells | are |',
    ].join('\n'));
  });

  it('preserves the frontmatter envelope when the body contains a table', () => {
    const markdown = [
      '---',
      'title: Table fixture',
      '---',
      '| Key | Value |',
      '| --- | --- |',
      '| owner | docs |',
    ].join('\n');

    const result = roundTripWysiwygMarkdown(markdown);

    expect(result).toContain('---\ntitle: Table fixture\n---\n');
    expect(result).toContain('| Key | Value |');
    expect(result).toContain('| owner | docs |');
    expect(parseMarkdown(result).frontmatter.title).toBe('Table fixture');
  });

  it('applies WYSIWYG table row insertion while preserving simple Markdown table export', () => {
    const markdown = [
      '| Name | Owner |',
      '| --- | --- |',
      '| Runbook | Platform |',
    ].join('\n');

    const result = applyWysiwygTableActionForTests(markdown, 'insert-row', { rowIndex: 1 });

    expect(result).toBe([
      '| Name | Owner |',
      '| --- | --- |',
      '| Runbook | Platform |',
      '|  |  |',
    ].join('\n'));
  });

  it('applies WYSIWYG table column insertion while preserving simple Markdown table export', () => {
    const markdown = [
      '| Name | Owner |',
      '| --- | --- |',
      '| Runbook | Platform |',
    ].join('\n');

    const result = applyWysiwygTableActionForTests(markdown, 'insert-column', { columnIndex: 0 });

    expect(result).toBe([
      '| Name |  | Owner |',
      '| --- | --- | --- |',
      '| Runbook |  | Platform |',
    ].join('\n'));
  });

  it('applies WYSIWYG table row and column deletion while keeping a valid table shape', () => {
    const markdown = [
      '| Name | Owner | Status |',
      '| --- | --- | --- |',
      '| Runbook | Platform | Draft |',
      '| Release notes | Docs | Ready |',
    ].join('\n');

    const withoutBodyRow = applyWysiwygTableActionForTests(markdown, 'delete-row', { rowIndex: 1 });
    const withoutOwnerColumn = applyWysiwygTableActionForTests(withoutBodyRow, 'delete-column', { columnIndex: 1 });

    expect(withoutOwnerColumn).toBe([
      '| Name | Status |',
      '| --- | --- |',
      '| Release notes | Ready |',
    ].join('\n'));
  });

  it('keeps the last table row or column instead of exporting an invalid empty table', () => {
    const markdown = ['| Only |', '| --- |'].join('\n');

    expect(applyWysiwygTableActionForTests(markdown, 'delete-row')).toBe(markdown);
    expect(applyWysiwygTableActionForTests(markdown, 'delete-column')).toBe(markdown);
  });
});
