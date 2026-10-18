# PORTING.md

Working contract for the Vue 3 port of GoRules' `@gorules/jdm-editor`.

## Upstream pin

| | |
|---|---|
| Repository | https://github.com/gorules/jdm-editor |
| Commit | `283bb11da324e0aaa641c790de9dd888ea2d2832` |
| Version | v1.52.0 |
| Date | 2026-05-13 |

Never advance the pin silently. When pulling upstream changes: read the diff
against the old pin, translate affected files, bump the pin here, and note what
came across in the changelog section below.

A shallow clone for reference lives outside the repo; re-clone with:

```sh
git clone https://github.com/gorules/jdm-editor.git /tmp/jdm-editor
git -C /tmp/jdm-editor checkout 283bb11da324e0aaa641c790de9dd888ea2d2832
```

## Correspondence rules (ADR-0002)

- **File/module names map 1:1.** `src/components/decision-graph/dg.tsx` →
  `src/components/decision-graph/Dg.vue` (or `dg.ts` for logic-only files).
  A renames commit must justify itself against this rule.
- **Logic ports literally.** Stores, reducers, utils, schema: same function
  names, same signatures where TypeScript allows, same file contents modulo
  framework.
- **React → Vue conventions:**

  | React (upstream) | Vue (here) |
  |---|---|
  | `useState`/`useReducer` | `ref` / `computed` / `shallowRef` |
  | `useEffect(fn, [deps])` | `watch`/`watchEffect`/`onMounted` |
  | zustand `create()` store | provide/inject composable, same state shape & action names |
  | React context (`X.context.tsx`) | `x-provider.ts` (provide + `useX` inject) |
  | `.tsx` component | `.vue` SFC (`<script setup lang="ts">`) |
  | render props (`renderPanel`, `cellRenderer`) | named slots (`#panel-*`, `#cell`, `#node-*`) |
  | `components?: CustomNodeType[]` | same prop; `Component` instead of `React.FC` |
  | `forwardedRef` | `ref`/`expose` — public methods exposed via `defineExpose` |
  | `useMemo` | `computed` |
  | class util `clsx` | `clsx` (kept) |

- **antd → Reka UI + tokens (ADR-0001).** Every antd import becomes a Reka UI
  primitive (or a small local wrapper in `src/components/ui/`) styled with the
  `--jdm-*` tokens. Visual target: parity with the React editor (see
  upstream storybook running locally: `pnpm storybook` in the clone).
- **Framework-agnostic deps are kept at the same versions**: exceljs, immer,
  zod, lodash, ts-pattern, fast-deep-equal, json5, monaco, codemirror,
  `@gorules/lezer-zen@0.8.1`, `@gorules/lezer-zen-template@0.4.0`,
  `@gorules/zen-engine-wasm@0.23.1`.

## Dependency map

| Upstream | Here |
|---|---|
| reactflow 11 | `@vue-flow/core` + `@vue-flow/background` + `@vue-flow/controls` |
| zustand | provide/inject composables (no Pinia) |
| antd 5 + @ant-design/icons | reka-ui + design tokens + `lucide-vue-next` |
| @tanstack/react-table / -virtual | `@tanstack/vue-table` / `@tanstack/vue-virtual` |
| react-dnd | `vue-draggable-plus` (list reorder only); public `manager` prop dropped → `addNode` ref method |
| @monaco-editor/react | direct `monaco-editor` + local `helpers/monaco.ts` loader (same override story) |
| react-json-tree | local `JsonTree` component in `components/ui/` |
| react-resizable-panels / re-resizable | `splitpanes` (+ CSS resize where simpler) |
| react-intersection-observer, use-debounce | `@vueuse/core` |
| transition-hook | Vue `<Transition>` |
| lucide-react | `lucide-vue-next` |

## Public API parity checklist

Everything upstream exports from `src/index.ts` must exist here with a
Vue-idiomatic signature. Component-by-component rows get expanded when that
module is ported.

- [x] `./styles.scss` → `dist/style.css`
- [x] `JdmConfigProvider` (+ `ThemeConfig`, `DictionaryMap`, `useDictionaries`)
- [x] `ensureWasmLoaded`, `useWasmReady` (from `helpers/wasm`)
- [x] `codemirror` (from `helpers/codemirror`)
- [x] `useNodeType` (from `helpers/node-type`)
- [x] `usePersistentState` (from `helpers/use-persistent-state`)
- [x] `helpers/schema` exports + `./dist/schema` entry
- [ ] `components/decision-graph`: `DecisionGraph` (props: `id`, `defaultValue`, `value`, `disabled`, `viewConfig`, `components`, `onChange`, `reactFlowProOptions`→dropped?, `onReactFlowInit`→`onInit`; ref: `addNode`, …) — expand on port
- [ ] `components/decision-table`: `DecisionTable` (props: `id`, `defaultValue`, `value`, `activeRules`, `permission`, `disabled`, `disableHitPolicy`, `minColWidth`, `colWidth`, `inputsSchema`, `outputsSchema`; `cellRenderer` → `#cell` slot)
- [ ] `components/function`: Function editor exports
- [ ] `components/expression`: Expression builder exports
- [ ] `components/code-editor`: `CodeEditor` + code-editor exports
- [ ] `components/shared`, `diff-icon`

## Port order & status

Bottom-up so every module lands with its dependencies already present:

| # | Module | Upstream LOC | Status |
|---|---|---|---|
| 1 | scaffold, tokens, theme, wasm | — | ✅ done |
| 2 | `helpers/*` (16 files, ~1.1k) | 1056 | ✅ done |
| 3 | `components/shared` (diff-* inputs) | 203 | ⬜ |
| 4 | `components/code-editor` (+ zen grammar wiring) | 3084 | ⬜ |
| 5 | `components/expression` | 753 | ⬜ |
| 6 | `components/decision-table` | 4039 | ⬜ |
| 7 | `components/function` | 3868 | ⬜ |
| 8 | `components/decision-graph` (+ simulator + diff) | 9102 | ⬜ |
| 9 | stories → Storybook (vue3-vite), parity review | — | ⬜ |
| 10 | docs site / README polish, publish prep | — | ⬜ |

Testing rule: each module lands with vitest coverage of its logic core
(pure functions, store reducers) — upstream has no tests, so this coverage is
new, not ported.

## Definition of done

- Public API checklist green.
- All upstream stories ported to Storybook; visual side-by-side review
  against upstream storybook completed.
- `pnpm typecheck`, `pnpm test`, `pnpm build` green.
- Playground app exercises the full editor.

## Changelog (pin advances)

- (none yet)
