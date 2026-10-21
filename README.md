# @nfk.st/jdm-editor-vue

An unofficial **Vue 3** port of GoRules' [`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) —
open-source components for crafting and designing JDM (JSON Decision Model) files.

> **Not affiliated with or endorsed by GoRules.** Derived from the upstream React
> library (MIT); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Status

Feature-complete port of upstream **v1.52.0**. Every upstream module is
ported and every upstream Storybook story exists here — 57 in all, and the
two were rendered side by side (the method, and what it could not see, are
in [docs/PORTING.md](./docs/PORTING.md)). The parity checklist, the
deviations from upstream, and the known limitations are there too.

The changelog is in
[packages/jdm-editor-vue/CHANGELOG.md](./packages/jdm-editor-vue/CHANGELOG.md).

## Installation

```sh
npm i @nfk.st/jdm-editor-vue
```

`vue` is a peer dependency (`^3.5.13` — `@vueuse/core`, a runtime
dependency, requires Vue 3.5.13 or newer).

## Usage

### 1. Load the Zen engine

The Zen expression engine runs in WebAssembly and must be initialised before
the editor renders — upstream's host application does this at boot, and so
must yours. `ensureWasmLoaded()` is the exported hook:

```ts
// main.ts
import { ensureWasmLoaded } from '@nfk.st/jdm-editor-vue';
import { createApp } from 'vue';

import App from './App.vue';

void ensureWasmLoaded().finally(() => {
  createApp(App).mount('#app');
});
```

`useWasmReady()` is the reactive counterpart, for components that need to
wait for the engine (the simulator does).

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
browser-bound. The library itself is **import-safe** under Node — nothing
touches the browser at module scope — but a component that _mounts_ on the
server does (it reads `localStorage` at setup time). In Nuxt, wrap the
editor in `<ClientOnly>`:

```vue
<template>
  <ClientOnly>
    <JdmConfigProvider>
      <DecisionGraph v-model="graph" />
    </JdmConfigProvider>
  </ClientOnly>
</template>
```

### 5. Monaco workers

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
    return label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker();
  },
};
```

Without it the editor still renders, but Monaco's TypeScript diagnostics
never start (the console logs `Cannot read properties of undefined (reading
'toUrl')`).

## Components

All components follow the same convention: upstream's `value`/`onChange`
pair becomes `modelValue` + `update:modelValue` (`v-model`).

### `DecisionGraph`

The canvas — a decision graph of nodes and edges, with the tab bar, the node
panels and the simulator.

| Prop                                               | Type                        | Notes                                                            |
| -------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `modelValue`                                       | `DecisionGraphType`         | v-model. Upstream's `value`.                                     |
| `defaultValue`                                     | `DecisionGraphType`         | Uncontrolled initial value.                                      |
| `id`                                               | `string`                    |                                                                  |
| `name`                                             | `string`                    | File name shown in the tab bar. Defaults to `graph.json`.        |
| `disabled`                                         | `boolean`                   | Read-only mode.                                                  |
| `mode`                                             | `'dev' \| 'business'`       | UI mode.                                                         |
| `components`                                       | `NodeSpecification[]`       | Node specifications registered by the host.                      |
| `customNodes`                                      | `CustomNodeSpecification[]` | Custom node kinds.                                               |
| `hideLeftToolbar`                                  | `boolean`                   |                                                                  |
| `panels` / `defaultActivePanel` / `onPanelsChange` |                             | The host-registered side panels.                                 |
| `viewConfig` / `viewConfigCta` / `onViewConfigCta` |                             | Which tabs a user may open.                                      |
| `simulate`                                         | `Simulation`                | Simulation configuration.                                        |
| `dictionaries`                                     | `DictionaryMap`             | Named option sets for expression building.                       |
| `onChange`                                         | `(graph) => void`           | Kept alongside `update:modelValue`.                              |
| `onReactFlowInit`                                  | `(instance) => void`        | The canvas is ready (the vue-flow store).                        |
| `onCodeExtension` / `onFunctionReady`              |                             | Host hooks for code and function nodes.                          |
| `manager`                                          | `unknown`                   | **Deprecated, ignored.** Upstream's react-dnd `DragDropManager`. |

Emits `update:modelValue`. Slot `#tab-bar-extra-content` (upstream's
`tabBarExtraContent` prop).

The component's **ref** exposes the store's action surface — `setNodes`,
`addNodes`, `updateNode`, `removeNodes`, `duplicateNodes`, `copyNodes`,
`pasteNodes`, `setEdges`, `addEdges`, `removeEdges`, `goToNode`, `openTab`,
`closeTab`, `setActivePanel`, `setCompactMode`, `setNodeType`,
`removeNodeType` and more — plus `stateStore`, `serialize()` and
`restore(snapshot)`.

### `DecisionTable`

The rules grid, with its hit policy, column schema and reorder/excel
dialogs.

| Prop                             | Type                                           | Notes                                  |
| -------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `modelValue`                     | `DecisionTableType`                            | v-model. Upstream's `value`.           |
| `defaultValue`                   | `DecisionTableType`                            | Uncontrolled initial value.            |
| `id` / `name`                    | `string`                                       |                                        |
| `tableHeight`                    | `string \| number`                             | **Required.**                          |
| `disabled` / `disableHitPolicy`  | `boolean`                                      |                                        |
| `permission`                     | `'edit:full' \| 'edit:rules' \| 'edit:values'` |                                        |
| `mode`                           | `'dev' \| 'business'`                          |                                        |
| `minColWidth` / `colWidth`       | `number`                                       | Column sizing.                         |
| `inputsSchema` / `outputsSchema` | `SchemaSelectProps[]`                          | Column type pickers.                   |
| `inputVariableType`              | `VariableType`                                 |                                        |
| `debug`                          | `{ trace, inputData?, snapshot }`              | Simulation trace to highlight.         |
| `dictionaries`                   | `DictionaryMap`                                |                                        |
| `mountDialogsOnBody`             | `boolean`                                      | Render the dialogs on `document.body`. |
| `manager`                        | `unknown`                                      | **Deprecated, ignored.**               |

Slot `#cell` (upstream's `cellRenderer` prop) receives the cell's props and
returns a VNode. Ref props `scrollContainerRef` and `scrollApiRef` receive
the scroll container and the scroll API.

### `Expression`

A Zen expression with the command bar and the context menu. The value is a
list of entries — an expression can hold more than one.

| Prop                | Type                              |
| ------------------- | --------------------------------- |
| `modelValue`        | `ExpressionEntry[]` — v-model     |
| `inputVariableType` | `VariableType`                    |
| `debug`             | `{ trace, inputData?, snapshot }` |
| `hideCommandBar`    | `boolean`                         |

### `Function`

A JavaScript function in a Monaco editor, with the debugger panel.

| Prop            | Type                            | Notes                               |
| --------------- | ------------------------------- | ----------------------------------- |
| `modelValue`    | `string`                        | v-model. Upstream's `value`.        |
| `defaultValue`  | `string`                        | Uncontrolled initial value.         |
| `disabled`      | `boolean`                       |                                     |
| `disableDebug`  | `boolean`                       | Hide the debugger panel.            |
| `language`      | `string`                        | Defaults to `javascript`.           |
| `libraries`     | `FunctionLibrary[]`             | Globals available to the function.  |
| `inputData`     | `unknown`                       | Input for the debugger.             |
| `permission`    | `'edit:full'`                   |                                     |
| `previousValue` | `string`                        | Previous source, for the diff view. |
| `trace`         | `SimulationTrace`               | Trace to highlight.                 |
| `error`         | `{ data: { nodeId, source? } }` | Error to show.                      |

### `CodeEditor`

The CodeMirror-based editor behind the expression editors.

| Prop                                    | Type                                  | Notes                                  |
| --------------------------------------- | ------------------------------------- | -------------------------------------- |
| `modelValue`                            | `string`                              | v-model.                               |
| `type`                                  | `'unary' \| 'standard' \| 'template'` | Editor flavour.                        |
| `maxRows`                               | `number`                              |                                        |
| `placeholder` / `disabled`              |                                       |                                        |
| `lint` / `strict`                       | `boolean`                             | Zen linting and strict parsing.        |
| `fullHeight` / `noStyle`                | `boolean`                             |                                        |
| `lazy`                                  | `boolean`                             | Render the editor only on first focus. |
| `initialSelection`                      | `{ anchor, head? }`                   |                                        |
| `extension`                             | `(params) => Extension`               | CodeMirror extension.                  |
| `livePreview`                           | `{ input, fromSimulation, result? }`  |                                        |
| `variableType` / `expectedVariableType` | `VariableType`                        |                                        |

Emits `update:modelValue`, `stateChange` and `blur`.

### `ExpressionBuilder`

The structured expression builder — a visual operator/value editor rather
than raw Zen.

| Prop         | Type              | Notes                  |
| ------------ | ----------------- | ---------------------- |
| `modelValue` | `string`          | **Required.** v-model. |
| `fieldType`  | `ColumnFieldType` |                        |
| `disabled`   | `boolean`         |                        |
| `maxRows`    | `number`          | Defaults to 3.         |

It exposes a `focus()` method through its ref. The sibling
`StandardExpressionBuilder` (for output fields) is **not** part of the
public API — upstream does not export it either; it is what the decision
table's output column uses.

### `GraphSimulator`

The simulator panel: runs the current graph against test input with the Zen
engine and shows the trace.

| Prop             | Type                            |
| ---------------- | ------------------------------- |
| `loading`        | `boolean`                       |
| `defaultRequest` | `string`                        |
| `leftPanel`      | `Component`                     |
| `onRun`          | `({ graph, context }) => void`  |
| `onClear`        | `() => void`                    |
| `onChange`       | `(contextJson: string) => void` |

Emits `run`, `clear` and `change`.

### `JdmConfigProvider`

Wraps the editor: provides the theme and the dictionaries, and starts the
WASM load.

| Prop           | Type                                                            | Notes                                                                        |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `theme`        | `{ mode?: 'light' \| 'dark', tokens?: Record<string, string> }` | `tokens` are applied as inline CSS custom properties on the root.            |
| `dictionaries` | `Record<string, { label, value }[]>`                            | Named option sets for expression building — domain data, not UI translation. |

## Utilities

| Export                                        | Purpose                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ensureWasmLoaded()` / `useWasmReady()`       | Initialise the Zen engine.                                                                                 |
| `provideDictionaries()` / `useDictionaries()` | Share option sets with the editor's internals.                                                             |
| `useThemeMode()` / `useProvideThemeMode()`    | Read or provide the light/dark mode.                                                                       |
| `usePersistentState(key, default?)`           | An in-memory `[ref, setter]` tuple, keyed (upstream's `useState` + a module cache).                        |
| `useNodeType(id, options?)`                   | The inferred variable type of a node in the enclosing decision graph.                                      |
| `codemirror`                                  | CodeMirror's `linter`, re-exported for host extensions.                                                    |
| `@nfk.st/jdm-editor-vue/dist/schema`          | The zod schemas, `NodeKind`, and the field-type options — for validating JDM documents outside the editor. |

## Storybook

The port's Storybook is the **parity reference** for it: every upstream
story exists here, and the two were reviewed side by side.

```sh
pnpm --filter @nfk.st/jdm-editor-vue storybook   # http://localhost:6006
```

It covers all seven upstream modules — expression, decision table, function,
code editor, expression builder, standard expression builder and decision
graph — plus the date/time builder stories.

## Development

```sh
pnpm install
pnpm typecheck    # vue-tsc + the phantom-named-import guard
pnpm test         # vitest
pnpm build        # the library bundle + type declarations
pnpm format:check # prettier
pnpm dev          # the playground app
```

The repository is a pnpm monorepo:

- `packages/jdm-editor-vue` — the library that ships.
- `apps/playground` — a demo app that exercises the editor. Not part of the
  published package.

`pnpm typecheck` also runs `scripts/check-named-imports.mjs`, which resolves
every named import against the package's real runtime exports. A named
import of a name a package does not export type-checks happily and throws
in a real bundler; the guard is what catches it.

CI (`.github/workflows/`) runs the gates on every push and pull request, and
publishes to npm when a commit message starts with `chore(release)`.

## Documentation

| Document                                                                                 | Answers                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [docs/README.md](./docs/README.md)                                                       | Which document to read for which question.                                   |
| [docs/PORTING.md](./docs/PORTING.md)                                                     | What was ported, how it maps to upstream, and where it deliberately differs. |
| [docs/adr/0001-headless-chrome.md](./docs/adr/0001-headless-chrome.md)                   | Why antd was replaced by Reka UI and CSS tokens.                             |
| [docs/adr/0002-file-correspondence-port.md](./docs/adr/0002-file-correspondence-port.md) | Why the port mirrors upstream file-for-file.                                 |
| [docs/vue-flow-mapping.md](./docs/vue-flow-mapping.md)                                   | How reactflow's API maps onto Vue Flow.                                      |
| [CONTEXT.md](./CONTEXT.md)                                                               | The domain vocabulary (node kind, hit policy, dictionary, …).                |

## License

MIT © GoRules.io (original) and nfk.st contributors (Vue port).
