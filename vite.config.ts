import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Strip all console.* calls from the production bundle.
      // Dev server is unaffected — logs still work during development.
      minify: 'esbuild' as const,
      target: 'esnext',
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('pdfjs-dist')) return 'vendor-pdf';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('html5-qrcode')) return 'vendor-scanner';
            if (id.includes('html2canvas-pro') || id.includes('qrcode.react')) return 'vendor-export';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('gsap') || id.includes('motion')) return 'vendor-motion';
            return undefined;
          },
        },
      },
    },
    esbuild: {
      // Drop console logs and debugger statements in production only
      drop: process.env.NODE_ENV === 'production' ? (['console', 'debugger'] as ('console' | 'debugger')[]) : [],
    },
  };
});
