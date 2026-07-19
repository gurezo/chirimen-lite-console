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
    include: [
      resolve(
        __dirname,
        './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ),
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: resolve(__dirname, '../../coverage/libs/connect'),
    },
  },
  resolve: {
    alias: {
      '@libs-connect': resolve(__dirname, './src/index.ts'),
      '@libs-web-serial': resolve(__dirname, '../web-serial/src/index.ts'),
    },
  },
  esbuild: {
    target: 'node22',
  },
});
