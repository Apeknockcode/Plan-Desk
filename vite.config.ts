import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        widget: resolve(__dirname, 'widget.html'),
        'quick-add': resolve(__dirname, 'quick-add.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/naive-ui')) return 'naive-ui'
          if (id.includes('node_modules/@icon-park')) return 'icons'
        }
      }
    }
  },
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true
  },
  clearScreen: false
})
