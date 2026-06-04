import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    // Laad env variabelen (zoals VITE_BASE_URL)
    const env = loadEnv(mode, process.cwd(), '')
    
    return {
        base: env.VITE_BASE_URL || '/',
        plugins: [vue()],
        resolve: {
            alias: {
                '@': '/src'
            }
        },
        server: {
            port: 3000,
            host: '0.0.0.0',
            cors: true,
            allowedHosts: true,
            watch: {
                ignored: ['**/scenarios/**', '**/rl/**', '**/backend/**']
            },
            proxy: {
                '/map/state':        { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/network':      { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/scenarios':    { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/additional':   { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/water':        { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/settings':     { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/vehicle_route':{ target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/vehicles':     { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/arrows':       { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
                '/map/sky':          { target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/map/, ''), changeOrigin: true },
            },
        },
        build: {
            outDir: 'sumo_web3d/static',
            emptyOutDir: false,
        },
        optimizeDeps: {
            include: ['three', 'proj4', 'lodash-es', 'dat.gui', 'stats.js'],
        },
    }
})
