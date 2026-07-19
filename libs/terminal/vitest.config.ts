import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { resolve } from 'path';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  cacheDir: resolve(process.cwd(), 'node_modules/.vite'),
  plugins: [
    angular({
      tsconfig: resolve(__dirname, 'tsconfig.spec.json'),
    }),
    nxViteTsPaths(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, './src/test-setup.ts')],
    passWithNoTests: true,
    /** xterm schedules viewport refresh timers that can throw after dispose() in jsdom */
    dangerouslyIgnoreUnhandledErrors: true,
    include: [
      resolve(
        __dirname,
        './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(__dirname, '../../coverage/libs/terminal'),
    },
  },
  resolve: {
    alias: {
      '@libs-terminal': resolve(__dirname, './src/index.ts'),
      '@libs-web-serial': resolve(__dirname, '../web-serial/src/index.ts'),
    },
  },
  esbuild: {
    target: 'node22',
  },
});
