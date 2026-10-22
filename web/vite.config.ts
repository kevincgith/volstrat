/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the project under /volstrat/. For a custom domain set
// VITE_BASE=/ in the deploy workflow.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/volstrat/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
