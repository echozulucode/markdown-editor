import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    // public-api.test.tsx is a TYPE-only file (no runtime assertions); it is
    // covered by the `typecheck` script (tsc), not the runtime runner.
    exclude: [...configDefaults.exclude, 'test/public-api.test.tsx'],
  },
});
