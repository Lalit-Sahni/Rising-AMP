import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
// 250 was Phase 8–10. Part B’s IndexedDB persistence lives in the same
// firebase/firestore module as getDocs, so it cannot be code-split. 275
// covers that ~24 KB and still fails the build on accidental growth.
const INITIAL_GZIP_BUDGET = 275 * 1024;

function jsxInJs() {
  return {
    name: 'jsx-in-js',
    async transform(code, id) {
      if (!/\/src\/.*\.js$/.test(id) || id.includes('node_modules')) return null;
      const result = await esbuild.transform(code, {
        loader: 'jsx',
        jsx: 'automatic',
        sourcefile: id,
        sourcemap: true,
      });
      return { code: result.code, map: result.map };
    },
  };
}

function legalPages() {
  const send = (file) => fs.readFileSync(path.join(root, 'public', file));
  const maybeLegal = (req, res, next) => {
    const url = (req.url || '').split('?')[0];
    if (url === '/privacy' || url === '/privacy/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(send('privacy.html'));
      return;
    }
    if (url === '/terms' || url === '/terms/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(send('terms.html'));
      return;
    }
    if (url === '/clear-sw' || url === '/clear-sw/' || url === '/clear-sw.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(send('clear-sw.html'));
      return;
    }
    next();
  };
  return {
    name: 'legal-pages',
    configureServer(server) {
      server.middlewares.use(maybeLegal);
    },
    configurePreviewServer(server) {
      server.middlewares.use(maybeLegal);
    },
  };
}

function gzipBudget() {
  return {
    name: 'gzip-budget',
    generateBundle(_options, bundle) {
      const chunks = new Map();
      for (const [fileName, piece] of Object.entries(bundle)) {
        if (piece.type === 'chunk') chunks.set(fileName, piece);
      }
      const initial = new Set();
      const queue = [];
      for (const piece of chunks.values()) {
        if (piece.isEntry) {
          initial.add(piece.fileName);
          queue.push(piece);
        }
      }
      while (queue.length) {
        const chunk = queue.pop();
        for (const imported of chunk.imports || []) {
          if (initial.has(imported)) continue;
          const next = chunks.get(imported);
          if (next) {
            initial.add(imported);
            queue.push(next);
          }
        }
      }
      let total = 0;
      for (const fileName of initial) {
        const piece = bundle[fileName];
        if (!piece || piece.type !== 'chunk') continue;
        total += gzipSync(Buffer.from(piece.code)).length;
      }
      const kb = (total / 1024).toFixed(1);
      const budgetKb = (INITIAL_GZIP_BUDGET / 1024).toFixed(0);
      // eslint-disable-next-line no-console
      console.log(`Initial JS gzip: ${kb} KB (budget ${budgetKb} KB)`);
      if (total > INITIAL_GZIP_BUDGET) {
        throw new Error(
          `Initial JS gzip ${kb} KB exceeds the ${budgetKb} KB budget. See build/stats.html.`
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    jsxInJs(),
    react({ include: /\.(js|jsx|ts|tsx)$/ }),
    legalPages(),
    // Shell-only service worker. Do not import virtual:pwa-register in src/
    // (that would spend the 275 KB gzip budget). Inline register stays in
    // index.html. skipWaiting must be set here: the plugin only auto-sets it
    // when injectRegister is "auto".
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      includeAssets: [],
      manifest: {
        name: 'RisingAMP',
        short_name: 'RisingAMP',
        description: 'RisingAMP — construction tracking for Opal SS Constructions',
        theme_color: '#F5F6F8',
        background_color: '#F5F6F8',
        display: 'standalone',
        start_url: '/',
        lang: 'en-AU',
        // Phase 7 skipped new PNG icons on purpose. Do not invent any here.
      },
      devOptions: {
        enabled: false,
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        inlineWorkboxRuntime: true,
        // Hashed JS/CSS only. HTML is network-first below, never precached.
        globPatterns: ['**/*.{js,css,ico,webmanifest}'],
        globIgnores: [
          '**/clear-sw.html',
          '**/privacy.html',
          '**/terms.html',
          '**/stats.html',
        ],
        // Empty: a cached index.html is how a family phone keeps a stale app.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              if (request.mode !== 'navigate') return false;
              const pathName = url.pathname;
              if (pathName.startsWith('/clear-sw')) return false;
              if (pathName.startsWith('/privacy')) return false;
              if (pathName.startsWith('/terms')) return false;
              return true;
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'risingamp-html',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'risingamp-font-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'risingamp-font-files',
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Money, auth, files. Never a service-worker cache.
            urlPattern: ({ url }) => {
              const host = url.hostname;
              return (
                host === 'firestore.googleapis.com'
                || host === 'firebasestorage.googleapis.com'
                || host === 'identitytoolkit.googleapis.com'
                || host === 'securetoken.googleapis.com'
                || host === 'firebaseinstallations.googleapis.com'
                || host.endsWith('cloudfunctions.net')
                || host.endsWith('firebasestorage.app')
                || host.endsWith('firebaseio.com')
                || host.includes('firebaseappcheck')
              );
            },
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
    visualizer({
      filename: path.join(root, 'build', 'stats.html'),
      gzipSize: true,
      template: 'treemap',
    }),
    gzipBudget(),
  ],
  envPrefix: 'VITE_',
  esbuild: {
    jsx: 'automatic',
  },
  optimizeDeps: {
    entries: ['index.html', 'src/index.js'],
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'build', 'functions/node_modules'],
  },
});
