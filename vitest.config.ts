import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __API_REVISION__: JSON.stringify('test') },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    css: true,
    restoreMocks: true,
  },
});
