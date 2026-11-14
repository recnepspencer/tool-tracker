import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { env } from 'node:process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Saved offline records are discarded when the API contract changes.
const apiRevision = createHash('sha256').update(readFileSync('src/live/schema.d.ts')).digest('hex').slice(0, 12);

// Office pages that field crews rarely open. They are left out of the service
// worker's install download (precache) and cached on first visit instead, so
// installing over weak signal fetches only what crews use.
const officePages = ['operations', 'people', 'catalog', 'workspace-pages', 'logo-cropper'].map(
  (name) => `/src/live/${name}.tsx`,
);
const isOfficePage = (id: string | null | undefined) =>
  !!id && officePages.some((page) => id.replaceAll(String.fromCharCode(92), '/').endsWith(page));

export default defineConfig({
  publicDir: 'public/app',
  // Browser suites serve an owned copy of the exact production build.
  build: {
    outDir: env.NELSON_BROWSER_DIST ?? 'dist',
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) =>
          isOfficePage(chunk.facadeModuleId) ? 'assets/office/[name]-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
  define: { __API_REVISION__: JSON.stringify(apiRevision) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Tool Tracker',
        short_name: 'Tool Tracker',
        description: 'Tools, people, and every handoff.',
        theme_color: '#101822',
        background_color: '#f5f6f8',
        display: 'standalone',
        start_url: '/app',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png}'],
        globIgnores: ['tool-images/**', 'assets/office/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Hashed office-page chunks: fetched on first visit, then served offline.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/office/'),
            handler: 'CacheFirst',
            options: { cacheName: 'office-pages', expiration: { maxEntries: 40, purgeOnQuotaError: true } },
          },
        ],
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8001' } },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: { '/api': env.NELSON_API_TARGET ?? 'http://127.0.0.1:8001' },
  },
});
