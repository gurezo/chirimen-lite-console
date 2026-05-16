import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  cacheDir: resolve(process.cwd(), 'node_modules/.vite'),
  plugins: [angular({ tsconfig: resolve(__dirname, 'tsconfig.spec.json') })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, './src/test-setup.ts')],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(__dirname, '../../coverage/libs/unsupported-browser'),
    },
    include: [resolve(__dirname, './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}')],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  esbuild: {
    target: 'node22',
  },
});
