/// <reference types="vitest/config" />
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BASE = process.env.VITE_BASE ?? '/volstrat/';
const SITE_DATA = resolve(__dirname, '../data/site');

/** Serve ../data/site at <base>data/ in dev and copy it into dist/data on build. */
function siteData(): Plugin {
  return {
    name: 'volstrat-site-data',
    configureServer(server) {
      server.middlewares.use(`${BASE}data/`, (req, res, next) => {
        const file = resolve(SITE_DATA, (req.url ?? '').split('?')[0]!.replace(/^\//, ''));
        if (!file.startsWith(SITE_DATA) || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      if (existsSync(SITE_DATA)) {
        cpSync(SITE_DATA, resolve(__dirname, 'dist/data'), {
          recursive: true,
          filter: (src) => !src.endsWith('.gitkeep'),
        });
      }
    },
  };
}

// GitHub Pages serves the project under /volstrat/. For a custom domain set
// VITE_BASE=/ in the deploy workflow.
export default defineConfig({
  base: BASE,
  plugins: [react(), siteData()],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    environment: 'node',
  },
});
