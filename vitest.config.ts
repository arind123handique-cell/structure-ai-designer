import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    testTimeout: 120000,
    hookTimeout: 120000,
    exclude: ['**/node_modules/**', '**/dist/**', '**/desktop-build/**', '**/release-build/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
