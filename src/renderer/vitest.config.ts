
// renderer/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom', // gives you window, document, localStorage, etc.
    include: [
      'src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'src/tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    globals: true,
  },
})
