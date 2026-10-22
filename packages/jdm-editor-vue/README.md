# @nfk.st/jdm-editor-vue

A **Vue 3** port of GoRules' [`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) —
open-source components for crafting and designing JDM (JSON Decision Model) files.

> **Not affiliated with or endorsed by GoRules.** Derived from the upstream React
> library (MIT); see [THIRD_PARTY_NOTICES.md](https://github.com/nfk-st/jdm-editor-vue/blob/main/THIRD_PARTY_NOTICES.md).

Ported from upstream **v1.52.0**. Every upstream module and every upstream
Storybook story is present.

## Installation

```sh
npm i @nfk.st/jdm-editor-vue
```

`vue` is a peer dependency (`^3.5.13` — `@vueuse/core`, a runtime
dependency, requires Vue 3.5.13 or newer).

The shipped types need `skipLibCheck` (as most Vue libraries do): the
declaration rollup writes Vue's `DefineComponent` type arguments out in
full, and Vue 3.5's `GlobalComponents` does not satisfy that
declaration's own constraint.

## Usage

### 1. Load the Zen engine

The Zen expression engine runs in WebAssembly and must be initialised before
the editor renders. `ensureWasmLoaded()` is the exported hook:

```ts
// main.ts
import { ensureWasmLoaded } from '@nfk.st/jdm-editor-vue';
import { createApp } from 'vue';

import App from './App.vue';

void ensureWasmLoaded().finally(() => {
  createApp(App).mount('#app');
});
```

### 2. Import the stylesheet

```ts
import '@nfk.st/jdm-editor-vue/dist/style.css';
```

The build emits the stylesheet as a separate file, so it is not pulled in
automatically.

### 3. Render

```vue
<!-- App.vue -->
<script setup lang="ts">
import { DecisionGraph, JdmConfigProvider } from '@nfk.st/jdm-editor-vue';
import type { DecisionGraphType } from '@nfk.st/jdm-editor-vue';
import '@nfk.st/jdm-editor-vue/dist/style.css';
import { ref } from 'vue';

const graph = ref<DecisionGraphType>({ edges: [], nodes: [] });
</script>

<template>
  <JdmConfigProvider>
    <DecisionGraph v-model="graph" />
  </JdmConfigProvider>
</template>
```

### 4. Keep it client-only

The editor is client-only: the Vue Flow canvas, Monaco and CodeMirror are
browser-bound. The library is **import-safe** under Node — nothing touches
the browser at module scope — but a component that _mounts_ on the server
does (it reads `localStorage` at setup time). In Nuxt, wrap the editor in
`<ClientOnly>`.

### 5. Monaco workers

The function editor runs on Monaco's TypeScript language service, which
needs web workers. This port imports `monaco-editor` directly, so the
consumer's bundler must provide the workers. With Vite:

```ts
// main.ts
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    return label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker();
  },
};
```

Without it the editor still renders, but Monaco's TypeScript diagnostics
never start.

## Components

Upstream's `value`/`onChange` pair becomes `modelValue` + `update:modelValue`
(`v-model`).

| Component           | What it is                                                     | Key props                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DecisionGraph`     | The canvas: nodes, edges, tab bar, node panels, simulator.     | `modelValue`, `defaultValue`, `id`, `name`, `disabled`, `mode`, `components`, `customNodes`, `panels`, `viewConfig`, `simulate`, `dictionaries`, `onChange`                                                     |
| `DecisionTable`     | The rules grid with its hit policy and column schema.          | `modelValue`, `defaultValue`, `tableHeight` (required), `id`, `name`, `disabled`, `disableHitPolicy`, `permission`, `mode`, `minColWidth`, `colWidth`, `inputsSchema`, `outputsSchema`, `debug`, `dictionaries` |
| `Expression`        | A Zen expression with its command bar.                         | `modelValue`, `inputVariableType`, `debug`, `hideCommandBar`                                                                                                                                                    |
| `Function`          | A JavaScript function in a Monaco editor, with the debugger.   | `modelValue`, `defaultValue`, `disabled`, `disableDebug`, `language`, `libraries`, `inputData`, `permission`, `previousValue`, `trace`, `error`                                                                 |
| `CodeEditor`        | The CodeMirror editor behind the expression editors.           | `modelValue`, `type`, `maxRows`, `placeholder`, `disabled`, `lint`, `strict`, `fullHeight`, `noStyle`, `lazy`, `initialSelection`, `extension`, `livePreview`                                                   |
| `ExpressionBuilder` | The structured expression builder.                             | `modelValue` (required), `fieldType`, `disabled`, `maxRows`                                                                                                                                                     |
| `GraphSimulator`    | Runs the graph against test input and shows the trace.         | `loading`, `defaultRequest`, `leftPanel`, `onRun`, `onClear`, `onChange`                                                                                                                                        |
| `JdmConfigProvider` | Provides the theme and the dictionaries; starts the WASM load. | `theme`, `dictionaries`                                                                                                                                                                                         |

`DecisionGraph`'s ref exposes the store's action surface (`setNodes`,
`addNodes`, `updateNode`, `removeNodes`, `copyNodes`, `pasteNodes`,
`setEdges`, `goToNode`, `openTab`, `closeTab`, …) plus `stateStore`,
`serialize()` and `restore(snapshot)`.

## Utilities

`ensureWasmLoaded()`, `useWasmReady()`, `provideDictionaries()`,
`useDictionaries()`, `useThemeMode()`, `useProvideThemeMode()`,
`usePersistentState()`, `useNodeType()`, `codemirror`, and the JDM schemas
under `@nfk.st/jdm-editor-vue/dist/schema`.

`StandardExpressionBuilder` and `focusBuilderRoot` are **not** exported —
upstream does not export them either.

## Documentation

The full API reference, the parity checklist against upstream, and the
deliberate deviations live in the
[repository](https://github.com/nfk-st/jdm-editor-vue/tree/main/docs).

## License

MIT © GoRules.io (original) and nfk.st contributors (Vue port).
