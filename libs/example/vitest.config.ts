import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

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
    include: [
      resolve(
        __dirname,
        './src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ),
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: resolve(__dirname, '../../coverage/libs/example'),
    },
  },
  resolve: {
    alias: {
      '@libs-example': resolve(__dirname, './src/index.ts'),
      '@libs-dialogs': resolve(__dirname, '../dialogs/src/index.ts'),
      '@libs-shared': resolve(__dirname, '../shared/src/index.ts'),
      '@libs-editor': resolve(__dirname, '../editor/src/index.ts'),
    },
  },
});
