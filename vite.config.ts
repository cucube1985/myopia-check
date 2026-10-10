import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 상대 경로로 빌드한다. GitHub Pages의 하위 주소(/myopia-check/)와
  // Capacitor(Android 앱 내부 https://localhost/) 양쪽에서 같은 빌드가 열린다.
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
})
