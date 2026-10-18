import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const libSrc = fileURLToPath(new URL('../../packages/jdm-editor-vue/src', import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // consume the library from source in dev — no dist build needed
      '@nfk.st/jdm-editor-vue/dist/style.css': `${libSrc}/styles.scss`,
      '@nfk.st/jdm-editor-vue': `${libSrc}/index.ts`,
    },
  },
});
