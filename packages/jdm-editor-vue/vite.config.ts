import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import wasm from 'vite-plugin-wasm';

import packageJson from './package.json';

export default defineConfig({
  plugins: [vue(), wasm(), dts({ insertTypesEntry: true, rollupTypes: true })],
  resolve: {
    dedupe: ['@lezer/common', '@lezer/lr', '@lezer/highlight', 'vue'],
  },
  test: {
    environment: 'jsdom',
    alias: [
      {
        find: /^monaco-editor$/,
        replacement: fileURLToPath(new URL('./src/monaco-test-stub.ts', import.meta.url)),
      },
    ],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        schema: fileURLToPath(new URL('./src/helpers/schema.ts', import.meta.url)),
      },
      name: 'JDM Editor Vue',
      formats: ['es'],
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue', ...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.peerDependencies)],
    },
  },
});
