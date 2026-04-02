import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/*.png', 'icons/*.svg'],
    manifest: false,
    minify: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
      disableDevLogs: true,
      runtimeCaching: [
        {
          urlPattern: /^https?:\/\/.*\/api\/.*$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-runtime-cache',
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true,
    },
  }), cloudflare()],
  server: {
    host: true,
  },
});