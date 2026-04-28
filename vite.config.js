export default defineConfig({
  base: '/lc360/',
  // ... le reste de ta config existante
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@services': resolve(__dirname, './src/services'),
      '@store': resolve(__dirname, './src/store'),
      '@styles': resolve(__dirname, './src/styles'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    include: ['@photo-sphere-viewer/core'],
  },
})
