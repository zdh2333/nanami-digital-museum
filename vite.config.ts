/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
      'scripts/**/*.test.mjs',
    ],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
