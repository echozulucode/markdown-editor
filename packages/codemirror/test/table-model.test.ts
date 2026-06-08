import { describe, expect, it } from 'vitest';
import {
  parseTable,
  serializeTable,
  setCell,
  insertRow,
  deleteRow,
  insertColumn,
  deleteColumn,
  setAlign,
} from '../src/table-model.js';

const TABLE = ['| A | B |', '| :--- | ---: |', '| 1 | 2 |', '| 3 | 4 |'].join('\n');

describe('table-model', () => {
  it('parses header, alignment, and rows', () => {
    const m = parseTable(TABLE);
    expect(m).not.toBeNull();
    expect(m!.header).toEqual(['A', 'B']);
    expect(m!.aligns).toEqual(['left', 'right']);
    expect(m!.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('returns null for non-tables', () => {
    expect(parseTable('not a table')).toBeNull();
    expect(parseTable('| just one line |')).toBeNull();
  });

  it('round-trips through serialize (preserving alignment)', () => {
    const m = parseTable(TABLE)!;
    expect(serializeTable(m)).toBe(TABLE);
  });

  it('normalizes ragged rows to the column count', () => {
    const m = parseTable('| A | B | C |\n| --- | --- | --- |\n| 1 |')!;
    expect(m.rows[0]).toEqual(['1', '', '']);
  });

  it('escapes and unescapes pipes in cells', () => {
    const m = parseTable('| A |\n| --- |\n| x \\| y |')!;
    expect(m.rows[0][0]).toBe('x | y');
    expect(serializeTable(m)).toContain('x \\| y');
  });

  it('sets header and body cells', () => {
    let m = parseTable(TABLE)!;
    m = setCell(m, -1, 0, 'Header');
    m = setCell(m, 0, 1, 'two');
    expect(m.header[0]).toBe('Header');
    expect(m.rows[0][1]).toBe('two');
  });

  it('inserts and deletes rows', () => {
    let m = parseTable(TABLE)!;
    m = insertRow(m, 1);
    expect(m.rows).toHaveLength(3);
    expect(m.rows[1]).toEqual(['', '']);
    m = deleteRow(m, 1);
    expect(m.rows).toHaveLength(2);
  });

  it('inserts and deletes columns (keeping at least one)', () => {
    let m = parseTable(TABLE)!;
    m = insertColumn(m, 1);
    expect(m.header).toEqual(['A', '', 'B']);
    expect(m.aligns).toEqual(['left', 'none', 'right']);
    expect(m.rows[0]).toEqual(['1', '', '2']);
    m = deleteColumn(m, 1);
    expect(m.header).toEqual(['A', 'B']);
    // can't delete the last remaining column
    const single = parseTable('| only |\n| --- |\n| x |')!;
    expect(deleteColumn(single, 0)).toEqual(single);
  });

  it('sets column alignment (reflected in the separator row)', () => {
    let m = parseTable(TABLE)!;
    m = setAlign(m, 0, 'center');
    expect(m.aligns).toEqual(['center', 'right']);
    expect(serializeTable(m)).toContain('| :--: | ---: |');
    // out-of-range is a no-op
    expect(setAlign(m, 5, 'left')).toEqual(m);
  });
});
