import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_URL || 'http://server:8000',
      '/health': process.env.VITE_API_URL || 'http://server:8000',
    },
  },
})
