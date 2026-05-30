// Tell React we're in an act() environment so state updates flush deterministically.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Shared jsdom polyfills for component tests that mount CodeMirror / Lexical.
// jsdom does not implement layout, so editors that measure ranges need these.
const range = document.createRange();
const prototype = Object.getPrototypeOf(range) as Range & {
  getClientRects?: () => DOMRectList;
  getBoundingClientRect?: () => DOMRect;
};

prototype.getClientRects ??= () =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterator() {},
  } as unknown as DOMRectList);
prototype.getBoundingClientRect ??= () => new DOMRect();

// Some editor chrome consults matchMedia (reduced-motion); jsdom omits it.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
