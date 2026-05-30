import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom so the live Lexical editor + toolbar can mount for control tests.
    // The existing headless codec round-trip tests run fine under jsdom too.
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
