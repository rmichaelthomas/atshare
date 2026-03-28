import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/atshare-selector.js',
      name: 'AtshareSelector',
      fileName: 'atshare-selector',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@atproto/oauth-client-browser'],
    },
  },
});
