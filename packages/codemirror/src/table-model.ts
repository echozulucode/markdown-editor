/**
 * A small, dependency-free model for GFM tables used by the hybrid editable
 * table widget. Parses a table's Markdown into `{ header, aligns, rows }`,
 * serializes it back (preserving column alignment), and offers immutable
 * row/column operations.
 */

export type TableAlign = 'left' | 'center' | 'right' | 'none';

export interface TableModel {
  /** Header cells (one per column). */
  header: string[];
  /** Column alignment, one per column. */
  aligns: TableAlign[];
  /** Body rows; each row has one cell per column. */
  rows: string[][];
}

/** Parse a GFM table block. Returns `null` if it isn't a valid table. */
export function parseTable(markdown: string): TableModel | null {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');
  if (lines.length < 2) return null;

  const header = splitRow(lines[0]);
  const aligns = parseAligns(lines[1]);
  if (!aligns) return null;

  const cols = Math.max(header.length, aligns.length);
  const norm = (cells: string[]): string[] => {
    const out = cells.slice(0, cols);
    while (out.length < cols) out.push('');
    return out;
  };

  return {
    header: norm(header),
    aligns: normalizeAligns(aligns, cols),
    rows: lines.slice(2).map((line) => norm(splitRow(line))),
  };
}

/** Serialize a model back to GFM Markdown (no padding; valid + compact). */
export function serializeTable(model: TableModel): string {
  const cols = Math.max(1, model.header.length);
  const header = model.header.slice(0, cols);
  while (header.length < cols) header.push('');
  const aligns = normalizeAligns(model.aligns, cols);

  const row = (cells: string[]): string => {
    const padded = cells.slice(0, cols);
    while (padded.length < cols) padded.push('');
    return `| ${padded.map(escapeCell).join(' | ')} |`;
  };

  return [
    row(header),
    `| ${aligns.map(alignMarker).join(' | ')} |`,
    ...model.rows.map(row),
  ].join('\n');
}

// --- immutable operations ---

/** Set a cell. `rowIndex === -1` targets the header row. */
export function setCell(model: TableModel, rowIndex: number, colIndex: number, value: string): TableModel {
  const clean = value.replace(/\r?\n/g, ' ');
  if (rowIndex < 0) {
    const header = model.header.slice();
    header[colIndex] = clean;
    return { ...model, header };
  }
  const rows = model.rows.map((r, i) => {
    if (i !== rowIndex) return r;
    const next = r.slice();
    next[colIndex] = clean;
    return next;
  });
  return { ...model, rows };
}

/** Insert an empty body row at `atIndex` (clamped to [0, rows.length]). */
export function insertRow(model: TableModel, atIndex: number): TableModel {
  const cols = model.header.length;
  const at = clamp(atIndex, 0, model.rows.length);
  const rows = model.rows.slice();
  rows.splice(at, 0, Array.from({ length: cols }, () => ''));
  return { ...model, rows };
}

/** Delete the body row at `index` (no-op if out of range). */
export function deleteRow(model: TableModel, index: number): TableModel {
  if (index < 0 || index >= model.rows.length) return model;
  const rows = model.rows.slice();
  rows.splice(index, 1);
  return { ...model, rows };
}

/** Insert an empty column at `atIndex` (clamped to [0, cols]). */
export function insertColumn(model: TableModel, atIndex: number): TableModel {
  const cols = model.header.length;
  const at = clamp(atIndex, 0, cols);
  const header = model.header.slice();
  header.splice(at, 0, '');
  const aligns = model.aligns.slice();
  aligns.splice(at, 0, 'none');
  const rows = model.rows.map((r) => {
    const next = r.slice();
    next.splice(at, 0, '');
    return next;
  });
  return { header, aligns, rows };
}

/** Delete the column at `index`. Keeps at least one column. */
export function deleteColumn(model: TableModel, index: number): TableModel {
  if (model.header.length <= 1 || index < 0 || index >= model.header.length) return model;
  const header = model.header.slice();
  header.splice(index, 1);
  const aligns = model.aligns.slice();
  aligns.splice(index, 1);
  const rows = model.rows.map((r) => {
    const next = r.slice();
    next.splice(index, 1);
    return next;
  });
  return { header, aligns, rows };
}

/** Set the alignment of the column at `index` (no-op if out of range). */
export function setAlign(model: TableModel, index: number, align: TableAlign): TableModel {
  if (index < 0 || index >= model.aligns.length) return model;
  const aligns = model.aligns.slice();
  aligns[index] = align;
  return { ...model, aligns };
}

// --- helpers ---

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);

  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|';
      i += 1;
      continue;
    }
    if (s[i] === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function parseAligns(line: string): TableAlign[] | null {
  const cells = splitRow(line);
  const aligns: TableAlign[] = [];
  for (const cell of cells) {
    const t = cell.trim();
    if (!/^:?-{1,}:?$/.test(t)) return null;
    const left = t.startsWith(':');
    const right = t.endsWith(':');
    aligns.push(left && right ? 'center' : right ? 'right' : left ? 'left' : 'none');
  }
  return aligns.length > 0 ? aligns : null;
}

function normalizeAligns(aligns: TableAlign[], cols: number): TableAlign[] {
  const out = aligns.slice(0, cols);
  while (out.length < cols) out.push('none');
  return out;
}

function alignMarker(align: TableAlign): string {
  switch (align) {
    case 'left':
      return ':---';
    case 'center':
      return ':--:';
    case 'right':
      return '---:';
    default:
      return '---';
  }
}

function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
