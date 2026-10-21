import { ensureWasmLoaded } from '@nfk.st/jdm-editor-vue';
// PORTING: monaco-editor is imported directly by the library (upstream got
// its web workers for free from @monaco-editor/react), so whoever bundles
// the editor has to provision them — the README documents the snippet.
// Without it the editor still renders, but Monaco's TypeScript language
// service logs "Cannot read properties of undefined (reading 'toUrl')" and
// the diagnostics never start.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { createApp } from 'vue';

import App from './App.vue';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    // monaco labels the TypeScript language service 'typescript' AND
    // 'javascript' (the Function editor's default language is javascript).
    return label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker();
  },
};

// The zen engine runs in WebAssembly. Upstream's host application
// initialises it before the editor renders — the editor's expression and
// decision-table components call into the wasm during setup, so rendering
// them before the wasm is ready throws ("__wbindgen_malloc of undefined").
// `ensureWasmLoaded()` is the library's exported hook for exactly that.
void ensureWasmLoaded().finally(() => {
  createApp(App).mount('#app');
});
