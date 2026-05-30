import { describe, it, expect } from 'vitest';
import { roundTripWysiwygMarkdown } from '../src/index.js';

/**
 * Regression rigor for list/checkbox text-handling side-effects in the WYSIWYG
 * (rich text) mode. The user reported a checkbox "causing a bunch of weird blank
 * lines"; these tests pin the good behavior and lock in the known Lexical
 * round-trip limitations so future changes are caught.
 */
describe('WYSIWYG checklist round-trip — good behavior (regression guards)', () => {
  it('a homogeneous checklist round-trips with NO inserted blank lines', () => {
    const out = roundTripWysiwygMarkdown('- [ ] a\n- [ ] b\n- [ ] c\n');
    expect(out).toBe('- [ ] a\n- [ ] b\n- [ ] c');
    expect(out).not.toMatch(/\n\n/); // no blank line between items
  });

  it('preserves checked vs unchecked state', () => {
    const out = roundTripWysiwygMarkdown('- [ ] todo\n- [x] done\n');
    expect(out).toContain('- [ ] todo');
    expect(out).toContain('- [x] done');
  });

  it('keeps a checklist adjacent to a paragraph without doubling blank lines', () => {
    expect(roundTripWysiwygMarkdown('Intro\n\n- [ ] a\n- [x] b\n')).toBe('Intro\n\n- [ ] a\n- [x] b');
    expect(roundTripWysiwygMarkdown('- [ ] a\n- [x] b\n\nOutro\n')).toBe('- [ ] a\n- [x] b\n\nOutro');
  });

  it('preserves empty checklist items', () => {
    const out = roundTripWysiwygMarkdown('- [ ] a\n- [ ] \n- [ ] c\n');
    expect(out.split('\n').filter((l) => l.startsWith('- [ ]')).length).toBe(3);
  });

  it('does NOT insert a blank line when a checkbox item is followed by a plain bullet (B2 fix)', () => {
    // Lexical models check vs bullet lists separately and used to export them
    // with a blank line between; serialization now merges adjacent unordered
    // lists so the markdown reads as a single GFM list.
    expect(roundTripWysiwygMarkdown('- [ ] task\n- bullet\n')).toBe('- [ ] task\n- bullet');
    expect(roundTripWysiwygMarkdown('- bullet\n- [ ] task\n')).toBe('- bullet\n- [ ] task');
  });

  it('preserves nested lists at 4-space / tab indentation', () => {
    expect(roundTripWysiwygMarkdown('- a\n    - nested\n')).toBe('- a\n    - nested');
    expect(roundTripWysiwygMarkdown('- a\n\t- nested\n')).toBe('- a\n    - nested');
  });

  it('does not merge a code-fence line that merely looks like a list item', () => {
    const out = roundTripWysiwygMarkdown('- real item\n\n```\n- not a list\n```\n');
    // The bullet and the fenced block stay separated by a blank line.
    expect(out).toContain('- real item\n\n```');
  });
});

describe('WYSIWYG list — KNOWN limitations (pinned so changes are visible)', () => {
  it('KNOWN: 2-space nested checklist indentation is flattened (Lexical needs 4-space/tab)', () => {
    // Lexical's markdown import treats nesting at 4-space/tab; a 2-space indent
    // is below that threshold and flattens. Use 4-space/tab for nesting.
    const out = roundTripWysiwygMarkdown('- [ ] a\n  - [ ] nested\n');
    expect(out).toBe('- [ ] a\n- [ ] nested');
  });
});
