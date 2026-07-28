import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    clearMocks: true,
    exclude: ['tests/e2e/**', '**/node_modules/**', 'dist/**'],
  },
  server: {
    port: 5173,
  },
})
