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
      reportsDirectory: resolve(__dirname, '../../coverage/libs/shared'),
    },
    include: [resolve(__dirname, './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}')],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@libs-shared': resolve(__dirname, './src/index.ts'),
      '@libs-web-serial': resolve(__dirname, '../web-serial/src/index.ts'),
      '@libs-terminal-util': resolve(__dirname, '../terminal/util/src/index.ts'),
    },
  },
  esbuild: {
    target: 'node22',
  },
});
