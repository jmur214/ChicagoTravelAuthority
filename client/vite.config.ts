/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Compile the shared workspace package from source (instant HMR, no build step).
        '@cta/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      },
    },
    server: {
      // In dev, the client calls same-origin /api/* and Vite forwards it to the API server.
      proxy: {
        '/api': env.VITE_DEV_API_PROXY || 'http://localhost:3000',
      },
    },
    test: {
      include: ['src/**/*.test.ts'],
    },
  }
})
