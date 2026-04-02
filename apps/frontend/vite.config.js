import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Optional build controls via env
const enableSourcemaps = !!(process.env.VITE_SOURCEMAP || process.env.VITE_SOURCEMAPS)
// Allow minifier override to help isolate prod-only minifier issues
// Values: 'esbuild' (default) or 'terser'
const minifyChoice = process.env.VITE_MINIFY === 'terser' ? 'terser' : 'esbuild'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: enableSourcemaps,
    assetsDir: 'assets',
    minify: minifyChoice,
  }
})
