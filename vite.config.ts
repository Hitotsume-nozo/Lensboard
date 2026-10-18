import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lensboard/core': path.resolve(import.meta.dirname, 'packages/core/src'),
      '@lensboard/render': path.resolve(import.meta.dirname, 'packages/render/src'),
      '@lensboard/storage': path.resolve(import.meta.dirname, 'packages/storage/src'),
      '@lensboard/ui': path.resolve(import.meta.dirname, 'packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
});
