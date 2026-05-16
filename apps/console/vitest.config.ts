import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: resolve(process.cwd(), 'node_modules/.vite'),
  plugins: [
    angular({ tsconfig: resolve(__dirname, 'tsconfig.spec.json') }),
    nxViteTsPaths(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, './vitest.setup.ts')],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(__dirname, '../../coverage/apps/console'),
    },
    include: [
      resolve(
        __dirname,
        './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ),
    ],
  },
  resolve: {
    alias: {
      '^src/(.*)$': resolve(__dirname, './src/$1'),
      '^app/(.*)$': resolve(__dirname, './src/app/$1'),
      '^@constants/(.*)$': resolve(__dirname, './src/app/constants/$1'),
      '^@containers/(.*)$': resolve(__dirname, './src/app/containers/$1'),
      '^@guards/(.*)$': resolve(__dirname, './src/app/guards/$1'),
      '^@pages/(.*)$': resolve(__dirname, './src/app/pages/$1'),
      '^@services/(.*)$': resolve(__dirname, './src/app/services/$1'),
    },
  },
  esbuild: {
    target: 'node22',
  },
});
