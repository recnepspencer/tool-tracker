import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { env } from 'node:process';

export default defineConfig({
  publicDir: 'public/app',
  // Browser suites serve an owned copy of the exact production build.
  build: { outDir: env.NELSON_BROWSER_DIST ?? 'dist' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Nelson Electric — Tool custody',
        short_name: 'Nelson',
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
        globIgnores: ['tool-images/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
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
