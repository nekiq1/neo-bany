import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Разрешаем все хосты для деплоя на Railway
  server: {
    allowedHosts: true,
    host: '0.0.0.0' // Важно для контейнера
  },
  preview: {
    allowedHosts: true,
    host: '0.0.0.0'
  }
})