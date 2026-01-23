import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // Disable source maps in production for smaller bundle size
    minify: 'terser', // Use terser for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.* in production
        drop_debugger: true, // Remove debugger statements
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react'],
          pdf: ['@react-pdf/renderer'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit slightly since app is large
  },
  define: {
    // Define production constants
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
