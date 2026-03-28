import { defineConfig } from 'vite';
import { resolve } from 'path';

// Detect which build target via env var
// npm run build          → component library (ES + UMD, oauth lib external)
// npm run build:callback → callback page app (bundles all deps)
// npm run build:demo     → demo site app (bundles all deps)
const target = process.env.BUILD_TARGET;

const configs = {
  callback: {
    // App build for the callback page — bundles all dependencies
    build: {
      outDir: 'dist/oauth/callback',
      rollupOptions: {
        input: resolve(__dirname, 'public/oauth/callback/index.html'),
      },
    },
  },
  demo: {
    // App build for the demo site — bundles all dependencies
    build: {
      outDir: 'dist/demo',
      rollupOptions: {
        input: resolve(__dirname, 'public/demo/index.html'),
      },
    },
  },
  lib: {
    // Library build — oauth lib external (only used same-origin on atshare.social)
    build: {
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/atshare-selector.js'),
        name: 'AtshareSelector',
        fileName: 'atshare-selector',
        formats: ['es', 'umd'],
      },
      rollupOptions: {
        external: ['@atproto/oauth-client-browser'],
      },
    },
  },
};

export default defineConfig(configs[target] || configs.lib);
