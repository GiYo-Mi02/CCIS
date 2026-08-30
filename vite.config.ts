import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

function localMediaApi(): Plugin {
  return {
    name: 'ccis-local-media-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?')[0];
        if (pathname !== '/api/media/optimize') {
          next();
          return;
        }
        const { default: handler } = await import('./api/media/optimize.ts');
        await handler(request, response);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.VITE_SUPABASE_URL ??= env.VITE_SUPABASE_URL;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const release = process.env.VITE_APP_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  return {
    define: {
      'import.meta.env.VITE_APP_RELEASE': JSON.stringify(release),
    },
    plugins: [localMediaApi(), react(), tailwindcss()],
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
