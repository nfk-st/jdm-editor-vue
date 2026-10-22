# Changelog

All notable changes to `@nfk.st/jdm-editor-vue` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-10-22

The first release: a complete Vue 3 port of GoRules' React
[`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) v1.52.0 (upstream
commit `283bb11da324e0aaa641c790de9dd888ea2d2832`).

### Added

- **Components** — `DecisionGraph`, `DecisionTable`, `Expression`, `Function`,
  `CodeEditor`, `ExpressionBuilder`, `GraphSimulator`, `JdmConfigProvider`.
  (`StandardExpressionBuilder` is internal — upstream does not export it
  either.)
- **Utilities** — `ensureWasmLoaded()`, `useWasmReady()`, `provideDictionaries()`,
  `useDictionaries()`, `useThemeMode()`, `useProvideThemeMode()`,
  `usePersistentState()`, `useNodeType()`, `codemirror`.
- **JDM schemas** — the zod schemas, `NodeKind` and the field-type options,
  published as the `@nfk.st/jdm-editor-vue/dist/schema` entry point.
- **Storybook** — 60 stories covering all seven upstream modules, used as the
  parity reference for the port.

### Notes for consumers

- The Zen engine runs in WebAssembly: call `ensureWasmLoaded()` before the
  editor renders.
- The editor is client-only. The library is import-safe under Node, but a
  component that mounts on the server must be wrapped in `<ClientOnly>`.
- Monaco's TypeScript language service needs web workers, which the consumer's
  bundler must provide (this port imports `monaco-editor` directly rather than
  through `@monaco-editor/react`).

### Fixed before the first publish

The pre-ship review found defects that no gate caught. All are fixed:

- no edge ever rendered on the canvas (vue-flow validates every edge it
  syncs, and upstream's validator rejected each edge against itself);
- every graph edit remounted every node, which killed the inline
  condition editor;
- the canvas stylesheet targeted reactflow's class names, so the handles,
  edges, panel and controls were unstyled;
- the portalled overlays (tooltip, modal, select, menu) resolved no design
  tokens — the tokens live on `.grl-root` and reka teleports to `body`;
- a tooltip without an explicit `open` could never open (Vue casts an
  absent Boolean prop to `false`);
- primary buttons had no style;
- the custom node's form lost its edits (a write into the immer-frozen
  config);
- the shipped types referenced a phantom `monacoEditor` binding;
- the Monaco worker snippet did not route the `javascript` label to the
  TypeScript worker, so the function editor's language service never
  started;
- `reka-ui/date` — and with it the undeclared `@internationalized/date` —
  was bundled into the published bundle;
- the `vue` peer range allowed a version `@vueuse/core` does not support.

### Known limitations

- Upstream's `inferNodeTypes` returns from the immer recipe on the first node
  it walks, so upstream's type inference never reaches a downstream node. The
  port keeps this behaviour as-is; changing it would be a behaviour change,
  not a port.
- Upstream's react-dnd `DragDropManager` (`manager`) is accepted and ignored.
- reactflow's "React Flow" attribution is not reproduced — Vue Flow is MIT and
  carries none.

See [docs/PORTING.md](https://github.com/nfk-st/jdm-editor-vue/blob/main/docs/PORTING.md)
for the full parity checklist and the deliberate deviations from upstream.

[Unreleased]: https://github.com/nfk-st/jdm-editor-vue/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nfk-st/jdm-editor-vue/releases/tag/v0.1.0
