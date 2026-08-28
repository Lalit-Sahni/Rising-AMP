import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const INITIAL_GZIP_BUDGET = 250 * 1024;

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
