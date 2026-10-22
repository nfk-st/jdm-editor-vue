import type { StorybookConfig } from '@storybook/vue3-vite';
import { mergeConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import { safeDocgenInfo } from './vite-plugin-safe-docgen';

// PORTING: the library's own vite.config.ts already sets these up
// (docs/PORTING.md's dependency map) — the storybook builder has its own
// vite config, so the same plugins and dedupe list are merged in.
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
    mergeConfig(viteConfig, {
      plugins: [wasm(), safeDocgenInfo()],
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
      resolve: {
        dedupe: ['@lezer/common', '@lezer/highlight', '@lezer/lr', 'vue'],
      },
    }),
};

export default config;
