import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from /delta-skins/.
  base: '/delta-skins/',
  build: {
    // jsPDF and JSZip alone are about 450 kB; the app loads them up front, like before.
    chunkSizeWarningLimit: 800,
  },
});
