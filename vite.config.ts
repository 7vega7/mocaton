import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: ['@ton/ton', '@ton/core', '@ton/crypto'],
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
});
