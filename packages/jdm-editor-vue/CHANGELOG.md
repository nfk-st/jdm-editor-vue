# Changelog

All notable changes to `@nfk.st/jdm-editor-vue` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-10-21

The first release: a complete Vue 3 port of GoRules' React
[`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) v1.52.0 (upstream
commit `283bb11da324e0aaa641c790de9dd888ea2d2832`).

### Added

- **Components** — `DecisionGraph`, `DecisionTable`, `Expression`, `Function`,
  `CodeEditor`, `ExpressionBuilder`, `StandardExpressionBuilder`,
  `GraphSimulator`, `JdmConfigProvider`.
- **Utilities** — `ensureWasmLoaded()`, `useWasmReady()`, `provideDictionaries()`,
  `useDictionaries()`, `useThemeMode()`, `useProvideThemeMode()`,
  `usePersistentState()`, `useNodeType()`, `codemirror`.
- **JDM schemas** — the zod schemas, `NodeKind` and the field-type options,
  published as the `@nfk.st/jdm-editor-vue/dist/schema` entry point.
- **Storybook** — 57 stories covering all seven upstream modules, used as the
  parity reference for the port.

### Notes for consumers

- The Zen engine runs in WebAssembly: call `ensureWasmLoaded()` before the
  editor renders.
- The editor is client-only. The library is import-safe under Node, but a
  component that mounts on the server must be wrapped in `<ClientOnly>`.
- Monaco's TypeScript language service needs web workers, which the consumer's
  bundler must provide (this port imports `monaco-editor` directly rather than
  through `@monaco-editor/react`).

### Known limitations

- Upstream's `inferNodeTypes` returns from the immer recipe on the first node
  it walks, so upstream's type inference never reaches a downstream node. The
  port keeps this behaviour as-is; changing it would be a behaviour change,
  not a port.
- Toasts are `console` stand-ins; upstream uses antd's `message` API.
- Upstream's react-dnd `DragDropManager` (`manager`) is accepted and ignored.
- reactflow's "React Flow" attribution is not reproduced — Vue Flow is MIT and
  carries none.

See [docs/PORTING.md](https://github.com/nfk-st/goruleditor/blob/main/docs/PORTING.md)
for the full parity checklist and the deliberate deviations from upstream.

[Unreleased]: https://github.com/nfk-st/goruleditor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nfk-st/goruleditor/releases/tag/v0.1.0
