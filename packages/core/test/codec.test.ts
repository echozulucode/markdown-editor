import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseMarkdown,
  replaceBody,
  roundTripMarkdown,
  serializeMarkdown,
  splitFrontmatter,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

function loadFixtures(): { name: string; raw: string }[] {
  return readdirSync(FIXTURES_DIR)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort()
    .map((name) => ({
      name,
      raw: readFileSync(join(FIXTURES_DIR, name), 'utf8'),
    }));
}

describe('Markdown codec fixture corpus', () => {
  const fixtures = loadFixtures();

  it('includes the Knowledge E3 fixture corpus', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
  });

  for (const { name, raw } of fixtures) {
    it(`round-trips ${name} byte-identically`, () => {
      expect(roundTripMarkdown(raw)).toBe(raw);
      expect(serializeMarkdown(parseMarkdown(raw))).toBe(raw);
    });
  }

  it('covers the Phase 5 hardening fixture categories', () => {
    const fixtureNames = fixtures.map((fixture) => fixture.name);

    expect(fixtureNames).toEqual(expect.arrayContaining([
      '03-frontmatter-arrays.md',
      '09-tables-gfm.md',
      '11-callouts.md',
      '12-inline-html.md',
      '15-wiki-links.md',
      '24-very-long-lines.md',
      '29-mixed-line-endings.md',
      '34-diagrams.md',
    ]));
  });
});

describe('Phase 5 hardening round trips', () => {
  const hardeningFixtures = [
    {
      name: 'GFM table alignment, task lists, and wiki-links',
      raw: [
        '---',
        'title: Hardening Fixture',
        'tags: [gfm, links]',
        '---',
        '',
        '# Hardening',
        '',
        '- [x] Keep task state',
        '- [ ] Preserve [[Wiki Link|label]] and [docs](https://example.test/a_(b))',
        '',
        '| Name | Status |',
        '| :--- | ---: |',
        '| codec | stable |',
        '',
      ].join('\n'),
    },
    {
      name: 'callouts, inline HTML, and diagrams',
      raw: [
        '> [!warning] Renderer fallback',
        '> Keep callout markers byte-stable.',
        '',
        '<details><summary>Raw HTML</summary>',
        '',
        'HTML body with <span data-kind="inline">inline tags</span>.',
        '',
        '</details>',
        '',
        '```mermaid',
        'sequenceDiagram',
        '  participant Host',
        '  participant Editor',
        '  Host->>Editor: Render diagram',
        '```',
        '',
        '```plantuml',
        '@startuml',
        'Host -> Editor: Render via service',
        '@enduml',
        '```',
        '',
      ].join('\n'),
    },
    {
      name: 'very long line and mixed line endings',
      raw: [
        '---\r\n',
        'title: Mixed Endings\r\n',
        '---\r\n',
        '\n',
        'A long line '.repeat(150),
        '\r\n',
        'LF line\n',
        'CRLF line\r\n',
        'Final line',
      ].join(''),
    },
  ];

  for (const { name, raw } of hardeningFixtures) {
    it(`round-trips ${name}`, () => {
      expect(roundTripMarkdown(raw)).toBe(raw);
      expect(serializeMarkdown(parseMarkdown(raw))).toBe(raw);
    });
  }
});

describe('frontmatter handling', () => {
  it('replaces only the body while preserving raw frontmatter bytes', () => {
    const raw = '---\r\ntitle: T\r\ntags: [a, b]\r\n---\r\n\r\nOld body.\r\n';
    const parsed = parseMarkdown(raw);

    expect(replaceBody(parsed, '\r\nNew body.\r\n')).toBe(
      '---\r\ntitle: T\r\ntags: [a, b]\r\n---\r\n\r\nNew body.\r\n',
    );
  });

  it('replaces the whole document body when no frontmatter exists', () => {
    expect(replaceBody('# Title\n\nBody.\n', 'Replacement.\n')).toBe('Replacement.\n');
  });

  it('recovers from invalid YAML without crashing or changing bytes', () => {
    const raw = '---\nthis: is: not: valid: yaml\n---\n\nBody preserved.\n';

    expect(() => parseMarkdown(raw)).not.toThrow();
    const parsed = parseMarkdown(raw);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.frontmatter).toEqual({});
    expect(serializeMarkdown(parsed)).toBe(raw);
    expect(splitFrontmatter(raw).frontmatter).toEqual({});
  });
});
