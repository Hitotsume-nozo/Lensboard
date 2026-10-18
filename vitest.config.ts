import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/*',
      {
        test: {
          name: 'boundaries',
          include: ['tests/boundaries.test.ts'],
          environment: 'node',
          testTimeout: 20000,
        },
      },
      {
        test: {
          name: 'showcase',
          include: ['showcase/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
    environment: 'node',
    globals: true,
    reporters: ['default'],
    testTimeout: 15000,
    hookTimeout: 10000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.agents/**',
        '**/test/**',
        '**/tests/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
});
