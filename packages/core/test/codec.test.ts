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
