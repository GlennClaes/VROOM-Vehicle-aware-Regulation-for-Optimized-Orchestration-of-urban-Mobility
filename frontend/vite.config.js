import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { 
      usePolling: true,
      ignored: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**', '**/sumo-public/**', '**/__tests__/**']
    },
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
      // Data routes gaan naar de Python server (5000)
      '/map/scenarios': { target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      '/map/state':     { target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      '/map/vehicles':  { target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      '/map/network':   { target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      '/map/additional':{ target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      '/map/water':     { target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      '/map/settings':  { target: 'http://sumo-web3d:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/map/, '') },
      // De 3D engine zelf zit op de Vite server (3000)
      '/map':           { target: 'http://sumo-web3d:3000', changeOrigin: true },
    }
  }
})
