import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  cacheDir: resolve(process.cwd(), 'node_modules/.vite'),
  resolve: {
    alias: {
      '@libs-terminal-util': resolve(__dirname, '../../terminal/util/src/index.ts'),
      '@libs-web-serial-util': resolve(__dirname, '../util/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: [
      resolve(__dirname, './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'),
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: resolve(__dirname, '../../../coverage/libs/web-serial/data-access'),
    },
  },
});
