import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';

export interface Mounted {
  container: HTMLElement;
  root: Root;
  rerender: (element: ReactElement) => void;
  unmount: () => void;
}

/**
 * Minimal React-DOM mount helper (no @testing-library dependency). Renders into
 * a real jsdom container under document.body and flushes through act() so
 * effects and state updates settle before assertions.
 */
export function mount(element: ReactElement): Mounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    root,
    rerender(next: ReactElement) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Run a callback inside act() — use to wrap user interactions / event dispatch. */
export function run(fn: () => void): void {
  act(() => {
    fn();
  });
}

/** Flush microtasks/timers inside act() — for async effects (e.g. lazy WYSIWYG). */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
