import { WysiwygLexicalEditor } from '../src/index.js';
import { mount, run, flush } from './mount.js';

/**
 * Drives a real <WysiwygLexicalEditor> instance the way a user would: select
 * text in the live contenteditable, then click a toolbar button / change a
 * select, and read back the markdown the editor exports via onChange. This is
 * the "control test" pattern — it proves the button → command → markdown path
 * end to end, not just a helper function.
 */
export interface EditorHarness {
  container: HTMLElement;
  /** Latest markdown emitted by the editor's onChange. */
  markdown(): string;
  /** Select the entire document body (so a format command has a target). */
  selectAll(): Promise<void>;
  /** Collapse the caret to the end of the document. */
  caretToEnd(): Promise<void>;
  /** Click a toolbar control matched by CSS selector. */
  click(selector: string): Promise<void>;
  /** Read a toolbar button's aria-pressed state. */
  pressed(selector: string): boolean;
  /** Choose an <option> on a toolbar <select> and fire its change handler. */
  choose(selectSelector: string, value: string): Promise<void>;
  unmount(): void;
}

export async function mountEditor(initial: string): Promise<EditorHarness> {
  let last = initial;
  const m = mount(
    <WysiwygLexicalEditor
      markdown={initial}
      onChange={(md) => {
        last = md;
      }}
    />,
  );
  await flush();

  const editable = () => m.container.querySelector('[contenteditable="true"]') as HTMLElement;

  async function setSelection(collapseToEnd: boolean): Promise<void> {
    const el = editable();
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    if (collapseToEnd) range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    run(() => document.dispatchEvent(new Event('selectionchange')));
    await flush();
  }

  return {
    container: m.container,
    markdown: () => last,
    selectAll: () => setSelection(false),
    caretToEnd: () => setSelection(true),
    async click(selector: string) {
      const btn = m.container.querySelector(selector) as HTMLButtonElement | null;
      if (!btn) throw new Error(`toolbar control not found: ${selector}`);
      run(() => btn.click());
      await flush();
    },
    pressed(selector: string) {
      const btn = m.container.querySelector(selector);
      return btn?.getAttribute('aria-pressed') === 'true';
    },
    async choose(selectSelector: string, value: string) {
      const select = m.container.querySelector(selectSelector) as HTMLSelectElement | null;
      if (!select) throw new Error(`select not found: ${selectSelector}`);
      run(() => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await flush();
    },
    unmount: m.unmount,
  };
}
