import vue from '@vitejs/plugin-vue';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

const libSrc = fileURLToPath(new URL('../../packages/jdm-editor-vue/src', import.meta.url));

export default defineConfig({
  // PORTING: the playground consumes the library from source, so it needs the
  // same wasm plugin the library's own build uses — without it the
  // zen-engine wasm is served without the `application/wasm` MIME type and
  // `initWasm()` fails ("__wbindgen_malloc of undefined"). A published
  // consumer of the built package is unaffected: the wasm is bundled there.
  plugins: [vue(), wasm()],
  optimizeDeps: {
    // PORTING: the zen-engine wasm glue resolves its binary with
    // `new URL('...wasm', import.meta.url)`. When the package is pre-bundled
    // into node_modules/.vite/deps, that URL points at a directory that does
    // not contain the binary, so the dev server answers with index.html
    // (text/html) and `WebAssembly.instantiateStreaming` rejects the MIME
    // type. Serving the package unoptimized keeps import.meta.url pointing
    // at the real package directory.
    exclude: ['@gorules/zen-engine-wasm'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // consume the library from source in dev — no dist build needed
      '@nfk.st/jdm-editor-vue/dist/style.css': `${libSrc}/styles.scss`,
      '@nfk.st/jdm-editor-vue': `${libSrc}/index.ts`,
    },
  },
});
