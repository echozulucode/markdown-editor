import { EditorView, WidgetType } from '@codemirror/view';
import {
  type TableAlign,
  type TableModel,
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  parseTable,
  serializeTable,
  setAlign,
} from './table-model.js';

/**
 * After a structural edit (add/remove row/column) the widget DOM is rebuilt, so
 * we stash which cell to focus on the next build, keyed by the table's document
 * offset (which is stable across the edit).
 */
let pendingFocus: { from: number; row: number; col: number } | null = null;

/** The single open context menu, if any — so opening another (or destroying the widget) can close it. */
let activeMenu: { element: HTMLElement; dispose: () => void } | null = null;

function closeActiveMenu(): void {
  if (!activeMenu) return;
  const menu = activeMenu;
  activeMenu = null;
  menu.dispose();
  menu.element.remove();
}

interface CellTarget {
  row: number;
  col: number;
}

interface TableOp {
  /** `null` renders a separator. */
  label: string | null;
  run?: (target: CellTarget) => void;
  /** Marks this item active when the target column already has this alignment. */
  align?: TableAlign;
  /** Disables the item when it can't apply to the target. */
  enabled?: (target: CellTarget) => boolean;
  danger?: boolean;
}

/**
 * An inline, editable table for hybrid mode — Obsidian-style. Cells are
 * `contenteditable`; edits are written back to the Markdown source when focus
 * leaves the table (so cell-to-cell navigation never churns the document).
 * Structural operations (insert/delete row or column, alignment, delete table)
 * are available from a Word/Excel-style toolbar (shown while the table is
 * active) and an identical right-click context menu.
 */
export class HybridTableWidget extends WidgetType {
  constructor(
    private readonly markdown: string,
    private readonly from: number,
    private readonly to: number,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof HybridTableWidget && other.markdown === this.markdown && other.from === this.from
    );
  }

  /** Let the widget's own DOM handle all interaction (CM stays out of it). */
  ignoreEvent(): boolean {
    return true;
  }

  /** Make sure a context menu opened from this widget doesn't outlive it. */
  destroy(): void {
    closeActiveMenu();
  }

  toDOM(view: EditorView): HTMLElement {
    const model = parseTable(this.markdown);
    const wrap = document.createElement('div');
    wrap.className = 'cm-me-table-wrap';

    if (!model) {
      const pre = document.createElement('pre');
      pre.textContent = this.markdown;
      wrap.append(pre);
      return wrap;
    }

    const readOnly = view.state.readOnly;
    const cells = new Map<string, HTMLElement>();
    const key = (row: number, col: number): string => `${row}:${col}`;
    let focused: CellTarget | null = null;

    // Read the live cell values back into a model (captures pending edits).
    const liveModel = (): TableModel => ({
      header: model.header.map((fallback, c) => cells.get(key(-1, c))?.textContent ?? fallback),
      aligns: model.aligns.slice(),
      rows: model.rows.map((r, ri) => r.map((fallback, c) => cells.get(key(ri, c))?.textContent ?? fallback)),
    });

    const commit = (next: TableModel, focusAfter?: CellTarget): void => {
      if (readOnly) return;
      const md = serializeTable(next);
      if (md === this.markdown) return;
      if (focusAfter) pendingFocus = { from: this.from, row: focusAfter.row, col: focusAfter.col };
      view.dispatch({ changes: { from: this.from, to: this.to, insert: md }, userEvent: 'input' });
    };

    // Remove the whole table from the document, swallowing one adjacent newline
    // so we don't leave a blank line where the table was.
    const removeTable = (): void => {
      if (readOnly) return;
      const doc = view.state.doc;
      let from = this.from;
      let to = this.to;
      if (to < doc.length && doc.sliceString(to, to + 1) === '\n') to += 1;
      else if (from > 0 && doc.sliceString(from - 1, from) === '\n') from -= 1;
      view.dispatch({ changes: { from, to, insert: '' }, userEvent: 'delete' });
    };

    const focusCell = (row: number, col: number): void => {
      const el = cells.get(key(row, col));
      if (el) {
        el.focus();
        placeCaretAtEnd(el);
      }
    };

    // Tab / Shift-Tab order across header + body cells.
    const tabOrder = (): CellTarget[] => {
      const cols = model.header.length;
      const order: CellTarget[] = [];
      for (let c = 0; c < cols; c += 1) order.push({ row: -1, col: c });
      model.rows.forEach((_, r) => {
        for (let c = 0; c < cols; c += 1) order.push({ row: r, col: c });
      });
      return order;
    };

    const onCellKeydown = (event: KeyboardEvent, cell: HTMLElement, row: number, col: number): void => {
      if (event.key === 'Enter') {
        event.preventDefault(); // table cells can't hold newlines
        const below = row + 1;
        if (below < model.rows.length || row === -1) {
          focusCell(row === -1 ? 0 : below, col);
        } else {
          cell.blur();
        }
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        const order = tabOrder();
        const index = order.findIndex((o) => o.row === row && o.col === col);
        const next = order[index + (event.shiftKey ? -1 : 1)];
        if (next) focusCell(next.row, next.col);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cell.blur();
      }
    };

    // --- the shared operation set (toolbar + context menu both use this) ---
    const operations: TableOp[] = [
      {
        label: 'Insert row above',
        run: (t) => {
          const at = t.row < 0 ? 0 : t.row;
          commit(insertRow(liveModel(), at), { row: at, col: t.col });
        },
      },
      {
        label: 'Insert row below',
        run: (t) => {
          const at = t.row < 0 ? 0 : t.row + 1;
          commit(insertRow(liveModel(), at), { row: at, col: t.col });
        },
      },
      { label: null },
      {
        label: 'Insert column left',
        run: (t) => commit(insertColumn(liveModel(), t.col), { row: t.row, col: t.col }),
      },
      {
        label: 'Insert column right',
        run: (t) => commit(insertColumn(liveModel(), t.col + 1), { row: t.row, col: t.col + 1 }),
      },
      { label: null },
      {
        label: 'Align left',
        align: 'left',
        run: (t) => commit(setAlign(liveModel(), t.col, 'left'), t),
      },
      {
        label: 'Align center',
        align: 'center',
        run: (t) => commit(setAlign(liveModel(), t.col, 'center'), t),
      },
      {
        label: 'Align right',
        align: 'right',
        run: (t) => commit(setAlign(liveModel(), t.col, 'right'), t),
      },
      { label: null },
      {
        label: 'Delete row',
        danger: true,
        enabled: (t) => t.row >= 0 && model.rows.length > 1,
        run: (t) => {
          if (t.row >= 0) commit(deleteRow(liveModel(), t.row), { row: Math.max(0, t.row - 1), col: t.col });
        },
      },
      {
        label: 'Delete column',
        danger: true,
        enabled: () => model.header.length > 1,
        run: (t) => commit(deleteColumn(liveModel(), t.col), { row: t.row, col: Math.max(0, t.col - 1) }),
      },
      {
        label: 'Delete table',
        danger: true,
        run: () => removeTable(),
      },
    ];

    // Where toolbar ops act when no specific cell was clicked: the focused cell,
    // else the first header cell (a sensible default for inserts/alignment).
    const toolbarTarget = (): CellTarget => focused ?? { row: -1, col: 0 };

    const buildCell = (tag: 'th' | 'td', text: string, row: number, col: number, align: TableAlign): HTMLElement => {
      const cell = document.createElement(tag);
      cell.className = `cm-me-table-cell${tag === 'th' ? ' cm-me-table-cell-header' : ''}`;
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      if (align !== 'none') cell.style.textAlign = align;
      cell.textContent = text;
      if (!readOnly) {
        cell.setAttribute('contenteditable', 'true');
        cell.setAttribute('spellcheck', 'false');
        cell.addEventListener('focus', () => {
          focused = { row, col };
        });
        cell.addEventListener('keydown', (event) => onCellKeydown(event, cell, row, col));
        cell.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          focused = { row, col };
          openContextMenu(operations, { row, col }, liveModel().aligns[col], event.clientX, event.clientY);
        });
      }
      cells.set(key(row, col), cell);
      return cell;
    };

    const table = document.createElement('table');
    table.className = 'cm-me-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.className = 'cm-me-table-row';
    model.header.forEach((h, c) => headRow.append(buildCell('th', h, -1, c, model.aligns[c])));
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    model.rows.forEach((r, rowIndex) => {
      const tr = document.createElement('tr');
      tr.className = 'cm-me-table-row';
      r.forEach((value, c) => tr.append(buildCell('td', value, rowIndex, c, model.aligns[c])));
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);

    if (!readOnly) {
      // Commit pending cell edits only when focus leaves the whole table — so
      // moving between cells never touches the document.
      wrap.addEventListener('focusout', (event) => {
        const next = event.relatedTarget as Node | null;
        if (next && wrap.contains(next)) return;
        commit(liveModel());
      });

      wrap.append(buildToolbar(operations, toolbarTarget, liveModel));
    }

    // Restore focus to the target cell after a structural rebuild.
    if (pendingFocus && pendingFocus.from === this.from) {
      const target = pendingFocus;
      pendingFocus = null;
      requestAnimationFrame(() => {
        const el = cells.get(key(target.row, target.col)) ?? cells.get(key(-1, 0));
        if (el) {
          el.focus();
          placeCaretAtEnd(el);
        }
      });
    }

    return wrap;
  }
}

/**
 * The contextual table toolbar (a compact Word/Excel-style ribbon). It surfaces
 * the same operations as the right-click menu, grouped by separators, and acts
 * on the focused cell.
 */
function buildToolbar(operations: TableOp[], target: () => CellTarget, liveModel: () => TableModel): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'cm-me-table-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Table tools');

  for (const op of operations) {
    if (op.label === null) {
      const sep = document.createElement('span');
      sep.className = 'cm-me-table-sep';
      sep.setAttribute('aria-hidden', 'true');
      toolbar.append(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    const icon = TOOLBAR_ICONS[op.label];
    btn.className = `cm-me-table-btn${icon ? ' cm-me-table-btn-icon' : ''}${op.danger ? ' cm-me-table-btn-danger' : ''}`;
    if (icon) btn.append(svgIcon(icon));
    else btn.textContent = op.label;
    btn.title = op.label;
    btn.setAttribute('aria-label', op.label);
    // Keep the focused cell from blurring so its in-progress text is captured by
    // liveModel(); the op then commits everything in one go.
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', () => {
      const t = target();
      if (op.enabled && !op.enabled(t)) return;
      op.run?.(t);
    });
    if (op.align) {
      btn.dataset.align = op.align;
      const t = target();
      if (liveModel().aligns[t.col] === op.align) btn.setAttribute('aria-pressed', 'true');
    }
    toolbar.append(btn);
  }
  return toolbar;
}

/**
 * Inline SVG icons for the toolbar (dependency-free so the widget looks right
 * for every consumer); the full text stays in `title`/aria-label. Each value is
 * the inner markup of a 16×16 currentColor stroke icon.
 */
const TOOLBAR_ICONS: Record<string, string> = {
  'Insert row above': '<rect x="2.5" y="6.5" width="11" height="7" rx="1.2"/><path d="M8 1.4v3.4M6.3 3.1h3.4"/>',
  'Insert row below': '<rect x="2.5" y="2.5" width="11" height="7" rx="1.2"/><path d="M8 11.2v3.4M6.3 12.9h3.4"/>',
  'Insert column left': '<rect x="6.5" y="2.5" width="7" height="11" rx="1.2"/><path d="M1.4 8h3.4M3.1 6.3v3.4"/>',
  'Insert column right': '<rect x="2.5" y="2.5" width="7" height="11" rx="1.2"/><path d="M11.2 8h3.4M12.9 6.3v3.4"/>',
  'Align left': '<path d="M2.5 4h11M2.5 8h7M2.5 12h9"/>',
  'Align center': '<path d="M2.5 4h11M4.5 8h7M3.5 12h9"/>',
  'Align right': '<path d="M2.5 4h11M6.5 8h7M4.5 12h9"/>',
  'Delete row': '<rect x="2.5" y="6" width="11" height="4" rx="1.2"/><path d="M6.6 6.9l2.8 2.2M9.4 6.9l-2.8 2.2"/>',
  'Delete column': '<rect x="6" y="2.5" width="4" height="11" rx="1.2"/><path d="M6.9 6.6l2.2 2.8M6.9 9.4l2.2-2.8"/>',
  'Delete table': '<path d="M3.4 4.6h9.2M6 4.6l.3-1.6h3.4l.3 1.6M4.9 4.6l.6 9h5l.6-9"/>',
};

/** Build an SVG element from the inner markup in `TOOLBAR_ICONS`. */
function svgIcon(innerMarkup: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = innerMarkup;
  return svg;
}

/** Open the right-click context menu at the given viewport coordinates. */
function openContextMenu(
  operations: TableOp[],
  target: CellTarget,
  currentAlign: TableAlign,
  clientX: number,
  clientY: number,
): void {
  closeActiveMenu();

  const menu = document.createElement('div');
  menu.className = 'cm-me-table-menu';
  menu.setAttribute('role', 'menu');

  for (const op of operations) {
    if (op.label === null) {
      const sep = document.createElement('div');
      sep.className = 'cm-me-table-menu-sep';
      sep.setAttribute('role', 'separator');
      menu.append(sep);
      continue;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `cm-me-table-menu-item${op.danger ? ' cm-me-table-menu-item-danger' : ''}`;
    item.setAttribute('role', 'menuitem');
    item.textContent = op.label;
    const disabled = op.enabled ? !op.enabled(target) : false;
    if (disabled) item.setAttribute('aria-disabled', 'true');
    if (op.align) {
      // A check mark shows the column's current alignment.
      item.dataset.align = op.align;
      if (op.align === currentAlign) item.classList.add('cm-me-table-menu-item-active');
    }
    // Don't let the click blur the cell before the op reads liveModel().
    item.addEventListener('mousedown', (event) => event.preventDefault());
    item.addEventListener('click', () => {
      closeActiveMenu();
      if (!disabled) op.run?.(target);
    });
    menu.append(item);
  }

  document.body.append(menu);

  // Position within the viewport (flip if it would overflow the edge).
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = clientX + rect.width > vw ? Math.max(4, vw - rect.width - 4) : clientX;
  const top = clientY + rect.height > vh ? Math.max(4, vh - rect.height - 4) : clientY;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const onPointerDown = (event: Event): void => {
    if (!menu.contains(event.target as Node)) closeActiveMenu();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeActiveMenu();
  };
  // Capture-phase so we see the dismiss before CM/editor handlers.
  document.addEventListener('mousedown', onPointerDown, true);
  document.addEventListener('contextmenu', onPointerDown, true);
  window.addEventListener('scroll', closeActiveMenu, true);
  window.addEventListener('blur', closeActiveMenu);
  document.addEventListener('keydown', onKeyDown, true);

  activeMenu = {
    element: menu,
    dispose: () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('contextmenu', onPointerDown, true);
      window.removeEventListener('scroll', closeActiveMenu, true);
      window.removeEventListener('blur', closeActiveMenu);
      document.removeEventListener('keydown', onKeyDown, true);
    },
  };
}

function placeCaretAtEnd(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
