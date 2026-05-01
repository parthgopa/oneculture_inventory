import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allows ngrok to connect without needing to update the URL every time it changes
    allowedHosts: true, 
  }
})