import vue from '@vitejs/plugin-vue';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import wasm from 'vite-plugin-wasm';

import packageJson from './package.json';

const require = createRequire(import.meta.url);

const dependencyIds = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.peerDependencies)];

/** The manifest of an installed package, found through its entry point. */
const packageManifest = (packageName: string): Record<string, unknown> | undefined => {
  // the entry point is always exported; the manifest itself often is not
  // (an `exports` map without './package.json' blocks the deep import)
  let directory = dirname(require.resolve(packageName));

  while (directory !== dirname(directory)) {
    const manifestPath = join(directory, 'package.json');

    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

      if (manifest.name === packageName) {
        return manifest;
      }

      return undefined;
    }

    directory = dirname(directory);
  }

  return undefined;
};

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
  const manifest = packageManifest(packageName);

  if (!manifest) {
    throw new Error(`Cannot read the manifest of '${packageName}' — it is a declared dependency.`);
  }

  const exportsMap = manifest.exports;

  if (!exportsMap || typeof exportsMap !== 'object') {
    return [];
  }

  return Object.keys(exportsMap as Record<string, unknown>);
};

/** Does the package's exports map publish this subpath? */
const publishes = (packageName: string, subpath: string): boolean =>
  publishedSubpaths(packageName).some((published) => {
    if (published === subpath) {
      return true;
    }

    if (published.includes('*')) {
      const [prefix, suffix] = published.split('*');
      return subpath.startsWith(prefix) && subpath.endsWith(suffix);
    }

    return false;
  });

/** Split a bare specifier into its package and its subpath ('./…'). */
const splitPackageId = (id: string): { packageName: string; subpath: string } | undefined => {
  const parts = id.split('/');
  // a scoped package's name is two segments ('@scope/pkg')
  const packageName = id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const rest = id.slice(packageName.length);

  if (!rest) {
    return undefined;
  }

  return { packageName, subpath: `.${rest}` };
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
  const split = splitPackageId(id);

  if (!split || !dependencyIds.includes(split.packageName)) {
    return false;
  }

  return publishes(split.packageName, split.subpath);
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
      // fails to load). `check:dist` guards that, and it also checks that no
      // UNDECLARED package ended up in the bundle.
      external: (id: string) => isExternalDependency(id),
    },
  },
});
