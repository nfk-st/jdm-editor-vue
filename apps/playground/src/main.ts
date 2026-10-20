import { ensureWasmLoaded } from '@nfk.st/jdm-editor-vue';
import { createApp } from 'vue';

import App from './App.vue';

// The zen engine runs in WebAssembly. Upstream's host application
// initialises it before the editor renders — the editor's expression and
// decision-table components call into the wasm during setup, so rendering
// them before the wasm is ready throws ("__wbindgen_malloc of undefined").
// `ensureWasmLoaded()` is the library's exported hook for exactly that.
void ensureWasmLoaded().finally(() => {
  createApp(App).mount('#app');
});
