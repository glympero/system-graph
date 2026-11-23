import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The explorer is a static site. `out/` (graph.json, findings.json) is its public folder, so the dev server
// serves the latest build and `vite build` copies it next to the app.
export default defineConfig({
  root: 'web',
  base: './',
  publicDir: '../out',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
});
