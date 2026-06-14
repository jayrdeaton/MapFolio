import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
const pkg: { displayName: string; description: string } = JSON.parse(readFileSync('./package.json', 'utf-8'))
export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  srcDir: 'src',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxtjs/color-mode', '@vite-pwa/nuxt'],
  colorMode: {
    classSuffix: '',
    storageKey: 'mapfolio_color_mode'
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['leaflet']
    }
  },
  devServer: {
    port: 3000
  },
  pwa: {
    devOptions: { enabled: false },
    registerType: 'autoUpdate',
    manifest: {
      name: pkg.displayName,
      short_name: pkg.displayName,
      description: pkg.description,
      theme_color: '#09090b',
      background_color: '#09090b',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icon-180.png', sizes: '180x180', type: 'image/png' },
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'carto-tiles',
            expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /^https:\/\/server\.arcgisonline\.com\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'esri-tiles',
            expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'nominatim',
            expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }
      ]
    }
  },
  app: {
    head: {
      title: pkg.displayName,
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: pkg.displayName },
        { name: 'theme-color', content: '#ffffff' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icon-180.png' }
      ]
    }
  },
  css: ['leaflet/dist/leaflet.css', 'leaflet.markercluster/dist/MarkerCluster.css', 'leaflet.markercluster/dist/MarkerCluster.Default.css', '~/assets/css/main.css'],
  typescript: {
    strict: true,
    typeCheck: true
  }
})
