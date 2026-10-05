import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['teampulse-icon-dark.png'],
      manifest: {
        name: 'TeamPulse',
        short_name: 'TeamPulse',
        description: 'Team project management and KPI tracking',
        theme_color: '#5e6ad2',
        background_color: '#010102',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'teampulse-icon-dark.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'teampulse-icon-dark.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        injectionPoint: 'self.__WB_MANIFEST',
      },
    }),
  ],
  build: {
    outDir: path.resolve(__dirname, '../backend/static'),
    emptyOutDir: true,
    assetsDir: 'assets'
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
}) 