import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const basePath = process.env.VITE_BASE_PATH || '/Sandbox/'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    // Fix for SockJS - define global as window
    global: 'globalThis',
  },
  server: {
    port: 3000,
    host: true,
    // Proxy backend API to Spring Boot sandbox-backend
    proxy: {
      '/api/sandbox': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/api/scenarios': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/api/simulate': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/api/auth': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['echarts', 'echarts-gl'],
          'deck': ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/geo-layers', '@deck.gl/react'],
        }
      }
    }
  },
  optimizeDeps: {
    include: ['papaparse', 'zustand', '@stomp/stompjs', 'sockjs-client'],
  },
  publicDir: 'public',
})
