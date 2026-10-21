import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import wasm from 'vite-plugin-wasm';

import packageJson from './package.json';

const dependencyIds = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.peerDependencies)];

/**
 * The subpaths a package's `exports` map publishes — the only subpaths a
 * consumer's resolver can import by name.
 *
 * A package WITHOUT an exports map resolves its files by path, and Node
 * needs the extension ('fast-deep-equal/es6/react.js'). Externalising such
 * a subpath leaves the published bundle with an import Node cannot resolve
 * — and the bundle then fails to load at all.
 */
const publishedSubpaths = (packageName: string): string[] => {
  try {
    const manifest = require.resolve(`${packageName}/package.json`, { paths: [process.cwd()] });
    const exportsMap = JSON.parse(readFileSync(manifest, 'utf8')).exports;

    if (!exportsMap || typeof exportsMap !== 'object') {
      return [];
    }

    return Object.keys(exportsMap);
  } catch {
    return [];
  }
};

const isExternalDependency = (id: string): boolean => {
  // a Vite query suffix (?raw, ?url) is not part of the module id — and a
  // query cannot be externalised (the consumer has no such file)
  if (id.includes('?')) {
    return false;
  }

  if (id === 'vue') {
    return true;
  }

  if (dependencyIds.includes(id)) {
    return true;
  }

  // a SUBPATH of a dependency ('reka-ui/date') is external too — otherwise
  // the subpath and its own dependencies are BUNDLED (reka-ui/date pulls in
  // @internationalized/date, an undeclared Apache-2.0 dependency). Only when
  // the package's exports map publishes it.
  const slash = id.indexOf('/');

  if (slash < 0) {
    return false;
  }

  const packageName = id.slice(0, slash);
  const subpath = id.slice(slash);

  if (!dependencyIds.includes(packageName)) {
    return false;
  }

  return publishedSubpaths(packageName).some(
    (published) => published === subpath || published.startsWith(`${subpath}/`),
  );
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
      // no notice). A published subpath of a dependency is external too —
      // but only a PUBLISHED one: a package without an exports map needs
      // Node's extension resolution, and externalising its subpath leaves
      // the bundle with an import Node cannot resolve (the bundle then
      // fails to load). `check:dist` guards that.
      external: (id: string) => isExternalDependency(id),
    },
  },
});
