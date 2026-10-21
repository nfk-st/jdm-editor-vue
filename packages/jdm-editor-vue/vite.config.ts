import vue from '@vitejs/plugin-vue';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import wasm from 'vite-plugin-wasm';

import packageJson from './package.json';

const dependencyIds = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.peerDependencies)];

const isExternalDependency = (id: string): boolean => {
  // a Vite query suffix (?raw, ?url) is not part of the module id
  const bare = id.split('?')[0];

  if (bare === 'vue') {
    return true;
  }

  return dependencyIds.some((dependency) => bare === dependency || bare.startsWith(`${dependency}/`));
};

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
      // PORTING: a bare id list only externalises the dependency itself.
      // reka-ui's DatePicker imports 'reka-ui/date' — a SUBPATH — which was
      // bundled into dist/index.js together with its own dependency
      // @internationalized/date (Apache-2.0, undeclared, and shipped with
      // no notice). A subpath of a dependency is external too.
      external: (id: string) => isExternalDependency(id),
    },
  },
});
