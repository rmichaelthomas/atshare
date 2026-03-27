import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  build: {
    outDir: '../dist',
    lib: {
      entry: '../src/atshare-selector.js',
      name: 'AtshareSelector',
      fileName: 'atshare-selector',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@atproto/oauth-client-browser'],
    },
  },
});
