import type { StorybookConfig } from '@storybook/vue3-vite';
import { mergeConfig } from 'vite';

import { safeDocgenInfo } from './vite-plugin-safe-docgen';

// The storybook builder loads the library's own vite.config.ts — its vue,
// wasm and dts plugins and its dedupe list — and merges viteFinal on top.
// The dts plugin is removed: its declaration rollup belongs to the library
// build, and it fails the static storybook build.
const config: StorybookConfig = {
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      // PORTING: the default docgen plugin (vue-docgen-api) parses the
      // compiled output of a dual-script SFC (a `<script>` block plus a
      // `<script setup>` block — the pattern this port uses throughout) and
      // throws, which breaks the module graph the story loads. The
      // TypeScript-based docgen plugin handles it.
      docgen: { plugin: 'vue-component-meta' },
    },
  },
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  // PORTING: upstream's preview has a dark-mode toggle (the
  // `storybook-dark-mode` addon) — the port's preview now has the same one,
  // so the dark parity can be reviewed side by side.
  addons: ['@storybook/addon-essentials', 'storybook-dark-mode'],
  viteFinal: (viteConfig) =>
    mergeConfig(
      {
        ...viteConfig,
        plugins: viteConfig.plugins
          ?.flat()
          .filter((plugin) => !(plugin && 'name' in plugin && plugin.name === 'vite:dts')),
      },
      {
        plugins: [safeDocgenInfo()],
        optimizeDeps: {
          // PORTING: the zen-engine wasm glue resolves its binary with
          // `new URL('...wasm', import.meta.url)`. When the package is
          // pre-bundled into the dep cache, that URL points at a directory
          // that does not contain the binary — the request 404s and the whole
          // import graph fails. Serving the package unoptimized keeps
          // import.meta.url pointing at the real package directory (the
          // playground's vite config does the same).
          exclude: ['@gorules/zen-engine-wasm'],
        },
      },
    ),
};

export default config;
