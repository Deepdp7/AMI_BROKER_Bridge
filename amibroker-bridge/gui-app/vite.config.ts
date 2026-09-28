import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      // Ignore src-tauri so we don't reload when rust files change
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7890',
        changeOrigin: true,
      }
    },
    allowedHosts: ['chomp-image-flap.ngrok-free.dev'],
  },
})
