import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/sv-life-reboot/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('/src/data/events')) {
            return 'events-data';
          }
          if (id.includes('/src/data/achievements')) {
            return 'achievements-data';
          }
        }
      }
    }
  }
})

