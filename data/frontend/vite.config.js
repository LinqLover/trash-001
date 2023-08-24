import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  base: '', // relative path to support http server from parent folder

  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

  esbuild: {
    supported: {
      'top-level-await': true
    },
  },
})
