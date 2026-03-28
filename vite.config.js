import { defineConfig } from 'vite';
import { resolve } from 'path';

// Detect which build target via env var
// npm run build         → component library (ES + UMD, oauth lib external)
// npm run build:callback → callback page app (bundles all deps)
const isCallback = process.env.BUILD_TARGET === 'callback';

export default defineConfig(
  isCallback
    ? {
        // App build for the callback page — bundles all dependencies
        build: {
          outDir: 'dist/oauth/callback',
          rollupOptions: {
            input: resolve(__dirname, 'public/oauth/callback/index.html'),
          },
        },
      }
    : {
        // Library build for the web component — keeps oauth lib external
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
      }
);
