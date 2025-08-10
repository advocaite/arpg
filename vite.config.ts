import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve as resolvePath } from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
    open: false
  },
  preview: {
    host: '127.0.0.1',
    port: 5181,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': resolvePath(rootDir, 'src')
    }
  },
  build: {
    target: 'es2020'
  }
})
