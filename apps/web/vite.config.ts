import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Jika sedang build untuk web, folder output berubah menjadi 'dist-web'
  // Jika tidak (misal untuk Electron), tetap menggunakan bawaan 'dist'
  const outDir = mode === 'web' ? 'dist-web' : 'dist'

return {
  base: './',
  plugins: [vue()],
                            build: {
                              outDir: outDir, // Mengatur folder output dinamis
                            },
                            server: {
                              proxy: {
                                '/api': {
                                  target: 'http://localhost:4000',
                            changeOrigin: true,
                            secure: false,
                                },
                              },
                            },
}
})
