# @nfk.st/jdm-editor-vue

An unofficial **Vue 3** port of GoRules' [`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) —
open-source components for crafting and designing JDM (JSON Decision Model) files.

> **Not affiliated with or endorsed by GoRules.** Derived from the upstream React
> library (MIT); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Status

Port in progress — see [PORTING.md](./docs/PORTING.md) for scope, parity checklist and progress.

## Installation

```sh
npm i @nfk.st/jdm-editor-vue
```

## Usage

The Zen expression engine runs in WebAssembly and must be initialised before
the editor renders — upstream's host application does this at boot, and so
must yours. `ensureWasmLoaded()` is the exported hook:

```ts
// main.ts
import { createApp } from 'vue';
import { ensureWasmLoaded } from '@nfk.st/jdm-editor-vue';
import App from './App.vue';

void ensureWasmLoaded().finally(() => {
  createApp(App).mount('#app');
});
```

```vue
<!-- App.vue -->
<script setup>
import { ref } from 'vue';
import { JdmConfigProvider, DecisionGraph } from '@nfk.st/jdm-editor-vue';
import '@nfk.st/jdm-editor-vue/dist/style.css';

const graph = ref({ edges: [], nodes: [] });
</script>

<template>
  <JdmConfigProvider>
    <DecisionGraph v-model="graph" />
  </JdmConfigProvider>
</template>
```

The editor is client-only (Vue Flow canvas, Monaco, CodeMirror are
browser-bound). In Nuxt, wrap it in `<ClientOnly>`.

### Monaco workers

The function editor runs on Monaco's TypeScript language service, which
needs web workers. Unlike upstream (whose `@monaco-editor/react` dependency
provisions them), this port imports `monaco-editor` directly, so the
consumer's bundler must provide the workers. With Vite:

```ts
// main.ts
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    return label === 'typescript' ? new tsWorker() : new editorWorker();
  },
};
```

Without it the editor still renders, but Monaco's TypeScript diagnostics
never start (the console logs `Cannot read properties of undefined (reading
'toUrl')`).

## License

MIT © GoRules.io (original) and nfk.st contributors (Vue port).
