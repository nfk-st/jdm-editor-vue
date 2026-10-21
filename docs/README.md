# Documentation

The port's documentation. Five documents, each answering one question.

| Document                                                                       | The question it answers                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [PORTING.md](./PORTING.md)                                                     | **What was ported, and how does it map to upstream?** The porting contract, the dependency map, the React→Vue conventions, the public API parity checklist, the port-order status, the visual parity review, the scope decisions, and the known limitations. Start here. |
| [adr/0001-headless-chrome.md](./adr/0001-headless-chrome.md)                   | **Why is antd gone?** The decision to replace antd with Reka UI primitives styled on upstream's own `--grl-*` CSS custom properties.                                                                                                                                     |
| [adr/0002-file-correspondence-port.md](./adr/0002-file-correspondence-port.md) | **Why does the port mirror upstream file-for-file?** The rule that file names map 1:1, that logic ports literally, and that every deviation carries a `// PORTING:` marker.                                                                                              |
| [vue-flow-mapping.md](./vue-flow-mapping.md)                                   | **What happened to reactflow?** The verified mapping from reactflow's API onto Vue Flow, including the features that have no Vue Flow equivalent and the one that was dropped.                                                                                           |
| [../CONTEXT.md](../CONTEXT.md)                                                 | **What do the words mean?** The domain vocabulary inherited from upstream — node kind, hit policy, dictionary, specification, simulator, trace — and the words to avoid.                                                                                                 |

## Where things live

| Path                                                      | What it is                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/jdm-editor-vue/src/`                            | The library that ships. Mirrors upstream's `src/` file-for-file.           |
| `packages/jdm-editor-vue/.storybook/`                     | The Storybook harness. The port's stories are the parity reference.        |
| `packages/jdm-editor-vue/scripts/check-named-imports.mjs` | The guard against phantom named imports; run by `pnpm typecheck`.          |
| `apps/playground/`                                        | A demo app that exercises the editor. Not published.                       |
| `../README.md`                                            | The consumer-facing documentation: installation, usage, the component API. |
| `../THIRD_PARTY_NOTICES.md`                               | The attribution for the upstream MIT library.                              |
