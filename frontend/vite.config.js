import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/inventory': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      // Add more proxies if needed
    },
  },
})