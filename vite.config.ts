import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // --- PWA Configuration ---
      registerType: 'prompt',
      // Pre-cache essential assets for offline use.
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Runtime caching for external resources (e.g., Google Fonts, CDNs).
        // This ensures the app is fully functional offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 Year
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://cdnjs.cloudflare.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fontawesome-cdn' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://esm.sh',
            handler: 'CacheFirst',
            options: {
              cacheName: 'esm-sh-modules',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 Days
            },
          },
        ],
      },
      manifest: {
        name: 'CloudSongBook',
        short_name: 'SongBook',
        description: 'Your digital stage companion for lyrics and chords.',
        theme_color: '#ffffff',
        background_color: '#f9fafb', // bg-gray-50
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any', // Can be used as a standard icon
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512x512-maskable.png', // A maskable icon for adaptive icons on Android
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});