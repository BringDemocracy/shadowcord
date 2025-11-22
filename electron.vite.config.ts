import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ['@libp2p/crypto', '@libp2p/peer-id']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            libp2p: ['@libp2p/crypto', '@libp2p/peer-id']
          }
        }
      }
    }
  }
})
