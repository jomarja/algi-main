/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** The Node server (server/index.ts) answers /api and the mock TBC bank on this port in development. */
const apiServer = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiServer,
      '/mock-tbc': apiServer,
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: { charts: ['recharts'] },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
