# PORTING.md

Working contract for the Vue 3 port of GoRules' `@gorules/jdm-editor`.

## Upstream pin

|            |                                            |
| ---------- | ------------------------------------------ |
| Repository | https://github.com/gorules/jdm-editor      |
| Commit     | `283bb11da324e0aaa641c790de9dd888ea2d2832` |
| Version    | v1.52.0                                    |
| Date       | 2026-05-13                                 |

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
  `src/components/decision-graph/dg.vue` (same filename, `.vue` for views,
  `.ts` for logic-only files). New files with no upstream counterpart (e.g.
  `components/ui/*`) are ours to name.
- **Token surface is upstream's.** All CSS variables use upstream's `--grl-*`
  names (see `src/design-tokens.scss`, the static equivalent of upstream's
  `GlobalCssVariables`), so ported SCSS works verbatim. Our additions are
  marked "additive". Chrome prefix for classes: `grl-`.
- **Public component props:** upstream `value`/`onChange` pairs become
  `modelValue` + `update:modelValue` (v-model) on OUR public components;
  internal passthrough props keep upstream names (e.g.
  `AutosizeTextArea.value`).
- **Logic ports literally.** Stores, reducers, utils, schema: same function
  names, same signatures where TypeScript allows, same file contents modulo
  framework.
- **React → Vue conventions:**

  | React (upstream)                             | Vue (here)                                                                                                                                                                                                  |
  | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `useState`/`useReducer`                      | `ref` / `computed` / `shallowRef`                                                                                                                                                                           |
  | `useEffect(fn, [deps])`                      | `watch`/`watchEffect`/`onMounted`                                                                                                                                                                           |
  | zustand `create()` store                     | provide/inject composable, same state shape & action names                                                                                                                                                  |
  | React context (`X.context.tsx`)              | keep the filename, drop the suffix's framework: `X.context.tsx` → `X.context.ts` (store + provide/inject in one file, e.g. `expression-store.context.ts`). Provider-only components may use `x-provider.ts` |
  | `.tsx` component                             | `.vue` SFC (`<script setup lang="ts">`)                                                                                                                                                                     |
  | render props (`renderPanel`, `cellRenderer`) | named slots (`#panel-*`, `#cell`, `#node-*`)                                                                                                                                                                |
  | `components?: CustomNodeType[]`              | same prop; `Component` instead of `React.FC`                                                                                                                                                                |
  | `forwardedRef`                               | `ref`/`expose` — public methods exposed via `defineExpose`                                                                                                                                                  |
  | `useMemo`                                    | `computed`                                                                                                                                                                                                  |
  | class util `clsx`                            | `clsx` (kept)                                                                                                                                                                                               |

- **antd → Reka UI + tokens (ADR-0001).** Every antd import becomes a Reka UI
  primitive (or a small local wrapper in `src/components/ui/`) styled with the
  `--grl-*` tokens. Visual target: parity with the React editor (see
  upstream storybook running locally: `pnpm storybook` in the clone).
- **Stance: client-only, SSR-import-safe.** Components render client-side
  only (canvas, Monaco, CodeMirror are browser-bound); Nuxt users wrap in
  `<ClientOnly>`. Importing the library under SSR must not throw — no
  module-level browser API access (see the `PORTING(SSR)` guards in
  `helpers/platform.ts` and `helpers/monaco.ts`; deliberate, documented
  deviations from byte-identical). "Import-safe" means nothing touches the
  browser at **module scope**: setup-time reads (e.g. `localStorage` for the
  store's `compactMode` and the canvas's components-panel state) happen when a
  component mounts, so a server-rendered mount still needs `<ClientOnly>`.
  The published bundle imports cleanly under Node — `pnpm build` then
  `node --input-type=module -e "import('./dist/index.js')"` is the check.
- **Token surface is upstream's** (rule above). Variables upstream defines in
  its own SCSS (`--textarea-*`, `--mono-font-family`, …) are upstream's and
  need no marking; only additions to `design-tokens.scss`'s token surface
  are marked "additive".
- **ThemeConfig is narrowed by design:** upstream's antd `token` map becomes
  `tokens?: Record<string, string>` (inline CSS custom properties on the
  root). `prefixCls` is dropped (antd-only concept). Upstream's
  `DictionaryProvider` component maps to `provideDictionaries()`.
- **Framework-agnostic deps are kept at the same versions**: exceljs, immer,
  zod, lodash, ts-pattern, fast-deep-equal, json5, monaco, codemirror,
  `@gorules/lezer-zen@0.8.1`, `@gorules/lezer-zen-template@0.4.0`,
  `@gorules/zen-engine-wasm@0.23.1`.

## Dependency map

| Upstream                                  | Here                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| reactflow 11                              | `@vue-flow/core` + `@vue-flow/background` + `@vue-flow/controls`                                                    |
| zustand                                   | provide/inject composables on `helpers/mini-store.ts` (certified round 3; expression/dt/dg stores use it; no Pinia) |
| antd 5 + @ant-design/icons                | reka-ui + design tokens + `lucide-vue-next`                                                                         |
| @tanstack/react-table / -virtual          | `@tanstack/vue-table` / `@tanstack/vue-virtual`                                                                     |
| react-dnd                                 | `vue-draggable-plus` (list reorder only); public `manager` prop dropped → `addNode` ref method                      |
| @monaco-editor/react                      | direct `monaco-editor` + local `helpers/monaco.ts` loader (same override story)                                     |
| react-json-tree                           | local `JsonTree` component in `components/ui/`                                                                      |
| react-resizable-panels / re-resizable     | `splitpanes` (+ CSS resize where simpler)                                                                           |
| react-intersection-observer, use-debounce | `@vueuse/core`                                                                                                      |
| transition-hook                           | Vue `<Transition>`                                                                                                  |
| lucide-react                              | `lucide-vue-next`                                                                                                   |

## Public API parity checklist

Everything upstream exports from `src/index.ts` must exist here with a
Vue-idiomatic signature. Component-by-component rows get expanded when that
module is ported.

- [x] `./styles.scss` → `dist/style.css`
- [x] `JdmConfigProvider` (+ `JdmConfigProviderProps`, `ThemeConfig`, `DictionaryMap`,
      `useDictionaries`) — upstream's `DictionaryProvider` maps to
      `provideDictionaries()` (a function, not a component: Vue's `provide()`
      runs once per setup)
- [x] `ensureWasmLoaded`, `useWasmReady` (from `helpers/wasm`)
- [x] `codemirror` (from `helpers/codemirror`)
- [x] `useNodeType` (from `helpers/node-type`) — _ported; the decision-graph
      step-8 wiring is in place (the graph store provides the key)_
- [x] `usePersistentState` (from `helpers/use-persistent-state`)
- [x] `helpers/schema` exports + `./dist/schema` entry
- [x] `components/decision-graph`: `DecisionGraph` - **props** (`DecisionGraphProps`): `id`, `defaultValue`, `modelValue` (v-model — upstream's `value`), `disabled`, `components`, `customNodes`, `hideLeftToolbar`, `name`, `viewConfig`, `viewConfigCta`, `onViewConfigCta`, `defaultActivePanel`, `panels`, `onPanelsChange`, `simulate`, `dictionaries`, `mode`, `onChange`, `onReactFlowInit`, `onCodeExtension`, `onFunctionReady`; `manager` is a deprecated accept-and-ignore stub (upstream's react-dnd `DragDropManager`). - **emits**: `update:modelValue` (upstream's `onChange`; the `onChange` prop is kept alongside it). - **slots**: `#tab-bar-extra-content` (upstream's `tabBarExtraContent` ReactNode prop). - **DROPPED**: `reactFlowProOptions` (vue-flow is MIT — no attribution needed; see docs/vue-flow-mapping.md). - **ref** (`DecisionGraphRef` = `GraphRef`): the store's action surface — `setDecisionGraph`, `handleNodesChange`, `handleEdgesChange`, `setNodes`, `addNodes`, `updateNode`, `removeNodes`, `duplicateNodes`, `copyNodes`, `pasteNodes`, `setEdges`, `addEdges`, `removeEdges`, `removeEdgeByHandleId`, `setHoveredEdgeId`, `closeTab`, `openTab`, `goToNode`, `setActivePanel`, `setCompactMode`, `toggleCompactMode`, `setNodeType`, `removeNodeType`, `triggerNodeSelect` — plus `stateStore`, `serialize()`, `restore()`. NOTE: upstream v1.52 has **no** `addNode` on the public ref (the singular add is the canvas's internal `addNodeInner`, upstream graph.tsx); an earlier draft of this checklist claimed one — corrected. - **module exports** (barrel mirrors upstream's `decision-graph/index.ts`): `DecisionGraph`, `GraphNode`, `GraphDecisionNode`, `GraphSimulator`, `SimulatorEditor`, `createJdmNode`, `nodeSpecification`, `NodeColor`, `NodeTypeKind`, the store/serializer hooks (`useDecisionGraphState`, `useDecisionGraphActions`, `useDecisionGraphReferences`, `useDecisionGraphListeners`, `useDecisionGraphRaw`, `useNodeDiff`, `useEdgeDiff`, `useGraphSerializer`, `useTabSerializer`), the diff helpers (`addStrikethrough`, `buildDiffString`, `compareAndUnifyLists`, `compareStringFields`, `calculateDiffGraph`, `processNodes`, `processEdges`) and the type surface (`DecisionGraphProps`, `DecisionGraphRef`, `NodeSpecification`, `MinimalNodeSpecification`, `MinimalNodeProps`, `CustomNodeSpecification`, `DecisionEdge`, `DecisionNode`, `DecisionGraphType`, `DiffMetadata`, `Diff`, `Position`, `DiffStatus`, the `Simulation*` family, `DecisionGraphSnapshot`, `TabSnapshot`, `Slice`).
- [x] `components/function`: `Function` (public FunctionProps incl. v-model + trace/error), `FunctionDebugger`,
      `FunctionDebuggerLog`, functionLibraries/Definitions, variableTypeToTypescript
- [x] `components/expression`: `Expression` (+ store, controller, list/item, command bar, context menu)
- [x] `components/code-editor`: `CodeEditor` (modelValue v-model; type/lint/strict/noStyle/lazy),
      `ExpressionBuilder`, `DiffIcon`; `diff-ce` landed (`DiffCodeEditor`).
      `StandardExpressionBuilder` and `focusBuilderRoot` live in the **business
      barrel** — upstream's `code-editor/index.ts` re-exports only `CodeEditor`
      and `ExpressionBuilder` from it, and so does the port. They are internal
      (the decision table's output column uses the builder), NOT public API.
- [x] `components/decision-table`: `DecisionTable` (props: `id`, `name`, `defaultValue`, `modelValue` (v-model — upstream's `value`), `tableHeight` (required), `mountDialogsOnBody`, `disabled`, `disableHitPolicy`, `permission`, `mode`, `dictionaries`, `inputVariableType`, `debug`, `minColWidth`, `colWidth`, `inputsSchema`, `outputsSchema`; `manager` deprecated accept-and-ignore stub; `scrollContainerRef`/`scrollApiRef` Ref props + exposed scroll surface; `cellRenderer` prop via the `#cell` slot adapter on dt.vue; reorder + excel dialogs)
- [x] `components/shared`, `diff-icon`

### The additive public surface

Upstream's public surface is 119 names. The port exports those, except
`DictionaryProvider` (see above), **plus 19 names upstream does not
export**. Each is marked `// PORTING(additive):` in its barrel and listed
here, so the difference is declared rather than accidental:

| Module                  | Additive exports                                                                                                                                                                       | Why                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/expression` | `ExpressionControllerProps`, `ExpressionEntry`, `ExpressionPermission`, `ExpressionStore`, `createExpression`, `useExpressionStore`, `useExpressionStoreRaw`, `provideExpressionStore` | `ExpressionEntry` is the type of `<Expression>`'s `modelValue` — a consumer cannot type its own state without it. The store hooks let a host read the expression list.                                                             |
| `components/function`   | `FunctionDebugger`, `FunctionDebuggerLog`, `FunctionDebuggerLogData`, `FunctionDebuggerTrace`, `functionDefinitions`, `functionLibraries`, `variableTypeToTypescript`                  | The debugger components are what the function editor renders; the libraries and the type helper are what a host needs to offer the same globals to its own functions.                                                              |
| `theme`                 | `provideDictionaries`, `useThemeMode`, `useProvideThemeMode`, `JdmThemeMode`                                                                                                           | `provideDictionaries` is upstream's `DictionaryProvider` (renamed — a function, not a component). The theme-mode trio is the port's own dark mode: upstream leaves the mode to antd's algorithm, so a host needs a way to read it. |

## Port order & status

Bottom-up so every module lands with its dependencies already present:

| #   | Module                                           | Upstream LOC | Status                                                                                                                                                              |
| --- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | scaffold, tokens, theme, wasm                    | —            | ✅ done                                                                                                                                                             |
| 2   | `helpers/*` (16 files, ~1.1k)                    | 1056         | ✅ done                                                                                                                                                             |
| 3   | `components/shared` (diff-* inputs)              | 203          | ✅ done (diff-ce deferred to #4 — depends on code-editor)                                                                                                           |
| 4   | `components/code-editor` (+ zen grammar wiring)  | 3084         | ✅ done (business/ kept nested under code-editor/ per upstream; ui/ +Popover/InputNumber/DatePicker/TimePicker/MultiSelect)                                         |
| 5   | `components/expression`                          | 753          | ✅ done (react-dnd → vue-draggable-plus; +stack/spaced-text/confirm-action + ui/Button/Tooltip)                                                                     |
| 6   | `components/decision-table`                      | 4039         | ✅ done (react-dnd → vue-draggable-plus; +ui/Checkbox, Select allowClear, Modal getContainer/centered, Input focus/select)                                          |
| 7   | `components/function`                            | 3868         | ✅ done (2.9k zod.d.ts by copy; Monaco via helpers/monaco loader; splitpanes; ui/Tabs + ui/JsonNode)                                                                |
| 8   | `components/decision-graph` (+ simulator + diff) | 9102         | ✅ done (reactflow → @vue-flow/core; react-dnd dropped (HTML5 DnD); antd → Reka UI + `--grl-*` tokens; public `DecisionGraph` + wrapper + barrels)                  |
| 9   | stories → Storybook (vue3-vite), parity review   | —            | ✅ done (57 stories; the parity review against upstream's own storybook is below)                                                                                   |
| 10  | docs site / README polish, publish prep          | —            | ✅ done (README with the full component API; docs/ index; publish prep — LICENSE, prepublishOnly, repository, sideEffects, changelog, publish + validate workflows) |     |

Testing rule: each module lands with vitest coverage of its logic core
(pure functions, store reducers) — upstream has no tests, so this coverage is
new, not ported.

## The visual parity review (step 9)

Upstream's own storybook runs from the pinned clone (`pnpm storybook` in
`/tmp/jdm-editor/packages/jdm-editor`, port 9009); this port's runs on 6006.
Every story the two share was rendered in both and compared.

**57 port stories; 55 ids shared with upstream** (the port adds
`expression--disabled` and `expression--read-only`; upstream's ids match
one-for-one otherwise).

### What the review found

- `ui/MultiSelect.vue` rendered a chip's remove affordance as a **text
  `×`, always visible**. antd shows a close **icon**, revealed on hover.
  The port now renders the icon, hidden until the chip is hovered.
  _(CORRECTED — see below: antd's tag remove icon is NOT hover-only, and
  the port now shows it always, like antd.)_
- `ui/TimePicker.vue` rendered reka-ui's `TimeFieldInput` with **no slot
  content** — reka-ui draws a segment's value through the input's default
  slot — so the field showed an **empty box** where antd shows the time. The
  segments now render their value.
- `ui/TimePicker.vue` used reka-ui's default **12-hour** cycle; upstream's
  builders use antd's `HH:mm` (24-hour). The cycle is now pinned to 24.
- The Storybook harness could not push **live control updates** into a
  story: `@storybook/vue3` reads them off the root vnode's props, and the
  preview's decorator made that root the `JdmConfigProvider` (its `theme`
  prop). The provider is now rendered without props, so the root falls back
  to the story context's args and the Controls panel works.

The review also needed two harness fixes that are not port changes: the
zen-engine wasm must be excluded from the dependency optimizer (its
`new URL('...wasm', import.meta.url)` 404s otherwise) and awaited before
the stories render.

### What the review could NOT see — and what it got wrong

The review compared the two storybooks by their **extracted text**. That
method cannot see an SVG edge, a colour, a hover state, or an overlay that
is not open. It therefore reported the decision-graph stories as "identical
apart from reactflow's attribution", and the date/time builder stories as
differing only in how the value is expressed.

**That conclusion was wrong.** The pre-ship review (below) found that the
decision-graph stories were not comparable at all:

- **no edge ever rendered** — vue-flow validates every edge it syncs, and
  upstream's validator rejected each edge against itself;
- **the canvas CSS was dead** — the stylesheet targeted reactflow's
  `react-flow__*` class names, and vue-flow emits `vue-flow__*`;
- **primary buttons were unstyled** — no `--primary` rule existed;
- **no tooltip could open** — an absent Boolean prop became `false`, which
  made reka's tooltip controlled-and-closed;
- **every portalled overlay was unthemed** — the tokens live on `.grl-root`
  and reka teleports to `body`.

The method, not the port, was the blind spot. **Comparing extracted text
is not a visual comparison**: it needs the pixels, the computed styles, and
an interaction. The parity claims in this section are therefore scoped to
what the method could reach — the text — and the visual claims are covered
by the pre-ship review's findings instead.

## The pre-ship review

An external adversarial review (two axes — fidelity and standards) ran over
the whole port before the publish. It found 39 fidelity and 27 standards
findings; every one was checked against the code before anything was
changed. The findings that were real are fixed and pinned by tests; the
ones that were not are recorded below.

### Fixed — the canvas (all blocking)

- **No edge ever rendered.** vue-flow runs the flow-level
  `isValidConnection` for **every** edge it syncs; reactflow runs it only
  while a connection is dragged. Upstream's validator (ported verbatim)
  rejects an edge that duplicates an existing one — and the edge being
  synced _is_ in the list, so every edge matched itself and was dropped
  with `EDGE_INVALID`. The port now distinguishes the two call shapes:
  vue-flow passes the full Edge (it has an `id`) when syncing and an
  id-less Connection while dragging; only the drag shape is validated.
- **Every graph change remounted every node.** The `nodeTypes` map was
  built by a computed whose selector also read `decisionGraph`, so it was
  rebuilt on every edit — and vue-flow remounts a node when its component
  function changes identity. The inline condition editor died after one
  keystroke. The built-in specifications' wrappers are now created once.
- **The canvas CSS was dead.** The stylesheet targeted reactflow's
  `react-flow__*` class names; vue-flow emits `vue-flow__*`. The handles
  had no size or colour, the edges had no hover zone, the panel had no
  border, and the controls were unstyled.
- **Primary buttons were unstyled** — `grl-btn--primary` was emitted but no
  rule existed for it.

### Fixed — the theme and the primitives

- **Every portalled overlay was unthemed.** The design tokens live on
  `.grl-root`; reka teleports overlays to `body`. A portalled tooltip,
  modal, select or menu resolved no `var(--grl-*)` at all — no background,
  no border, no shadow, no dark mode. The provider now tells reka to
  portal **into** `.grl-root` (reka's `ConfigProvider` renders no element,
  so the DOM shape is unchanged).
- **A tooltip without an explicit `open` could never open.** Vue casts an
  absent Boolean prop to `false`, and the port bound `:open="open"`
  unconditionally — which made reka's `TooltipRoot` controlled-and-closed.
  21 of the 22 call sites were affected.
- **The dictionaries were frozen at mount.** `provide()` runs once per
  setup, so a dictionary loaded later never reached the expression
  builders. The provider now hands over a reactive holder — and the
  decision table's bridge watches it DEEPLY (the holder's identity never
  changes, only its contents).
- **The multi-select chip's remove icon** was hidden until hover — antd's
  is always visible (the opacity rule belongs to the select's _clear_
  icon). It is also omitted entirely when the select is disabled, like
  rc-select's `closable = !disabled`.
- **Numeric inline styles were dropped.** React appends `px` to a numeric
  style value; Vue does not, so `fontSize: 12` reached the DOM as the
  invalid `font-size: 12`. Every DOM style of that shape was given its
  unit — including the diff icon's 3px dot.

### Fixed — the data and the types

- **The custom node's form lost its edits.** antd's form store resolves
  `a.b` into a path and keeps the value nested; the port read the flat key
  and wrote with lodash's `_.set`, which nests a name that is not already a
  key — and then wrote into the immer-frozen object on the next edit, so
  the edit was silently lost. The form store's shape is now ported
  literally, and the write is immutable.
- **The shipped types referenced a phantom binding.** The declaration
  rollup turned `typeof import('monaco-editor')` into
  `import { monacoEditor } from 'monaco-editor'` — a name the package does
  not export. (One rollup defect remains: vue's `$nextTick: nextTick` is
  written as a value in a type position, so the shipped types need
  `skipLibCheck` — see Known temp debt.)
- **The public `JdmConfigProviderProps` type was missing.**
- **The run payload could hold a Vue proxy** — `structuredClone` of it
  throws `DataCloneError`.
- **The nodes were pinned to their first measured size** — reactflow
  ignores a node's width/height; vue-flow writes them as inline px.
- **The Decision View showed descriptions** upstream never shows.
- **`JdmConfigProvider` was missing from the public checklist**, and the
  checklist presented the additive exports as upstream parity.

### Fixed — the tooling

- **The Monaco worker snippet was wrong.** monaco labels the TypeScript
  language service `typescript` _and_ `javascript`; the function editor's
  default language is `javascript`, so the language service never started.
- **An undeclared dependency was bundled.** `vite.config.ts`'s `external`
  was a list of exact ids, so `reka-ui/date` — a subpath — was bundled
  together with `@internationalized/date` (Apache-2.0, undeclared, shipped
  with no notice). The dist shrank by 37 KB.
- **The `vue` peer range was too low** (`>=3.4`): `@vueuse/core`, a runtime
  dependency, requires Vue 3.5.13.
- **The publish workflow published from any branch** and re-published a
  version that was already on the registry. It is now master-only, runs
  the gates first, and skips a version that is already published.
- **The import guard missed `.js` sources** and never checked default
  imports. It now does both.

### The deviations this round added

Every one is marked `// PORTING:` in the code; they are listed here
because PORTING.md's rule is "marked AND listed":

- **`.grl-dg .switch`** — upstream's `.switch` is a top-level rule and
  reaches every `.switch` element on the host's page. The port scopes it
  to the editor.
- **The empty node body collapses** — upstream renders the body only when
  the node has children; Vue always has a slot, so the port collapses an
  empty body with `:empty`.
- **The decision table's panel defaults to 300px** — upstream's
  `Number.parseFloat(...) ?? 300` never fires (parseFloat('') is NaN and
  `??` does not catch NaN); the port maps NaN to 300 and keeps the
  150-500 clamp.
- **`Modal.confirm`** — the port's `confirm` prop focuses the OK button,
  like antd's `Modal.confirm` (reka focuses the first focusable element).
- **The button's size and shape classes** — `grl-btn--small` and
  `grl-btn--round` only; the default size and shape emit nothing, so they
  cannot collide with the type class `grl-btn--default`.

### Round 2 — what the second pass found

The first pass's own fixes were re-reviewed, and three of them were
wrong. They are the most instructive part of this log:

- **The published bundle did not load.** The first pass made
  `vite.config.ts`'s `external` a function that externalised every
  subpath of a dependency. A package WITHOUT an `exports` map resolves its
  files by path, and Node needs the extension —
  `fast-deep-equal/es6/react` cannot be resolved, so
  `import('./dist/index.js')` threw. **Every gate stayed green.** The
  check PORTING.md prescribes (`node --input-type=module -e "import(…)"`)
  is now a script (`check:dist`), it runs in CI after the build, and
  `prepublishOnly` runs it — a publish cannot ship a bundle that does not
  load. Only a subpath the package's `exports` map PUBLISHES is
  externalised.
- **The custom node's config shape was inverted.** The first pass read
  antd's `Form.Item` documentation instead of rc-field-form 2.4.0's
  implementation: `getNamePath(path)` is `toArray(path)` — a string name
  is ONE path segment, never split on dots. Upstream keeps the literal
  key ('hello.nested.something': 'My'), exactly as its own fixture stores
  it. The port had started rewriting the config into a nested shape that
  upstream never writes.
- **A danger primary button was red on red.** The first pass gave the
  button a `shape` prop that emitted `grl-btn--default` for the default
  shape — the same class name as the TYPE — so every button matched
  `.grl-btn--danger.grl-btn--default` and the primary's light text was
  replaced by the error colour. The size and the shape now emit nothing
  for their defaults.

Also fixed in round 2: the confirm modal's autofocus (a template ref on
reka's `DialogContent` exposes the component's props, not the element, so
`ref.value.querySelector` was not a function); the switch's checked hover
(antd: `colorPrimaryHover`); the decision table's dictionaries (the bridge
watched the holder shallowly, and the holder's identity never changes);
the tooltip's empty bubble (antd's `noTitle`); the diff icon's 3px dot
(the numeric-style sweep missed it); the popover's latent Boolean-`open`
trap; the diff text area's swallowed `change` event; and the four stale
"stand-in swapped" comments — the stand-ins are now ACTUALLY swapped for
the canonical types.

### Not fixed — deliberate

- **Upstream's `inferNodeTypes` bug** (its `return` aborts the immer recipe
  on the first node) is kept 1:1 — see Known temp debt.
- **The `excel` dialog's "Enter field name" input sits inside reka's
  `SelectContent`**, whose typeahead moves focus to a matching option and
  blocks Space and Tab; antd's select has no typeahead. The fix needs a
  browser to confirm, and it is not yet applied.

## Publish prep (step 10)

The package publishes as `@nfk.st/jdm-editor-vue`, built by Vite in library
mode. The manifest's `files` list is what npm ships: `dist/`,
`package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`.

**The stylesheet is a separate file.** Vite's library mode extracts the CSS
to `dist/style.css` and does _not_ leave an import of it in `dist/index.js`,
so the consumer imports it explicitly
(`import '@nfk.st/jdm-editor-vue/dist/style.css'`). That makes the
manifest's `sideEffects` field load-bearing.

Upstream's manifest has **no** `sideEffects` field at all — npm then treats
every file as side-effectful, which is the safe default. Declaring
`"sideEffects": false` (or the glob `"None"`, which matches nothing) is
what breaks the stylesheet. Measured on a scratch consumer (webpack 5,
`css-loader`), with the package installed from the packed tarball:

| `sideEffects`               | Bundled output | `--grl-*` rules survive |
| --------------------------- | -------------- | ----------------------- |
| `["**/*.css", "**/*.scss"]` | 95,603 B       | yes                     |
| `false`                     | **44 B**       | **no**                  |

With `false`, webpack drops the CSS import as an unused side-effect-free
module and the consumer gets an **unstyled editor** — a 44-byte bundle
instead of 95 KB. The port therefore declares the stylesheets as
side-effectful.

The other publish-prep changes: `LICENSE` copied into the package (the
`files` list promised it; the tarball shipped without it),
`prepublishOnly: "vite build"` (a publish can no longer ship a stale
`dist/`), `repository` + `bugs`, `publishConfig.access: "public"` (a scoped
package otherwise defaults to restricted and the publish fails), a
keep-a-changelog `CHANGELOG.md` at 0.1.0, and CI: `validate.yaml` runs the
gates, `publish.yaml` publishes on a `chore(release)` commit (upstream's
trigger).

## Deferred before 0.1.0

The pre-ship review found these; none is a defect that blocks the publish,
and each is listed here rather than left unrecorded (the rule is "marked
AND listed").

**Deferred — a browser must confirm it:**

- The **excel dialog's "Enter field name" input** sits inside reka's
  `SelectContent`, whose typeahead moves the focus to a matching option
  and blocks Space and Tab; antd's select has no typeahead.
- The **Storybook has no dark-mode toggle** (upstream's preview has one),
  so the dark parity was never reviewed side by side.
- The **handle offsets** — the port restores reactflow's
  `translate(0, -50%)` base (vue-flow's own is `translate(-50%, -50%)`), so
  the handles sit where upstream's do. The pixels are unverified.
- The **empty node body** collapses with `:empty` — spec-compliant
  browsers agree, jsdom does not.

**Deferred — a token value differs from antd's** (the port's value is a
reasonable approximation, not upstream's):

- The dark `--grl-color-error-hover` (#e86062 vs antd's #e86e6b).
- The warning / info text colours, the dark primary-border-hover, the
  control outline, the bg-text-hover, the error bg and border, and the
  font-family (antd's includes 'Noto Sans' and the emoji fallbacks).
- The `--grl-color-text-tertiary` the port added for the switch's hover
  (antd's own variable is left undefined there, so its handle inherits the
  0.88 text colour).

**Deferred — cosmetic or invisible:**

- The **button's loading state** looks disabled (antd uses opacity 0.65
  and keeps the colours) and renders the icon and the spinner side by side
  (antd swaps them).
- The **multi-select chip's remove control** is a focusable `<button>`
  (rc-select uses a non-focusable `<span>`), so every chip adds a tab
  stop; and its colour is 0.65 rather than antd's colorIcon at 0.45.
- The **edge's delete icon** is lucide's `Delete` (a backspace glyph);
  upstream uses antd's DeleteOutlined.
- The **switch's Popconfirm** lacks antd's default ExclamationCircleFilled
  icon.
- The **simulator's Spin** dims the content instead of drawing a spinner.
- **`#tab-bar-extra-content`** is always forwarded and loses antd's
  `{left, right}` form.
- **Dead code**: `ui/TimePicker.vue`'s `SEGMENTS`, `helpers/traversal.ts`'s
  unused `DecisionEdge`, `expression.stories.ts`'s unused action.
- The **graph's node components are handed reactive host props** (a Vue
  dev-mode warning).
- The **upstream portal-bubbled menu clicks** also select the node in
  upstream; the port's do not.

## Definition of done

- Public API checklist green.
- All upstream stories ported to Storybook; visual side-by-side review
  against upstream storybook completed.
- `pnpm typecheck`, `pnpm test`, `pnpm build` green.
- Playground app exercises the full editor.
- No phantom named imports (see below) — and the playground must actually
  BOOT in a browser, not just type-check.
- A pre-ship external review has run against the whole port and its
  findings are resolved (see `REVIEW-PROMPT.md`).

## Scope decisions

Decisions that bound this port's work, recorded here so they are not
re-litigated. Each is a choice, not an accident.

- **The "docs site" is this repo's `docs/` folder plus the README — not a
  generated site.** `docs/PORTING.md` (the porting contract), the two ADRs
  (the decisions) and `docs/vue-flow-mapping.md` (the reactflow→vue-flow
  mapping) are the documentation, indexed by `docs/README.md`. A published
  docs site (VitePress, Docusaurus, …) is a separate piece of work with
  its own build and hosting, and is deliberately NOT part of the port.
- **The port stops at the library.** The playground is a demo, not a
  product; its quality bar is "it boots and exercises the editor".
- **Behaviour parity, not improvement.** A port that renders _better_ than
  upstream is drift, not progress. Deviations are allowed only when marked
  and listed.

## The phantom-named-import trap

A named import of a name a package does not actually export type-checks
happily (a local `.d.ts` shim will happily declare it) but throws at runtime
in a real ESM bundler:

```
Uncaught SyntaxError: The requested module '.../splitpanes.js' does not
provide an export named 'Splitpane'
```

That error kills the whole application, and **no gate catches it**: `vue-tsc`
trusts the shim, vitest's SSR transform turns named imports into property
accesses, and `vite build` leaves external dependencies unresolved. The
splitpanes case shipped green through all three and broke the app on load.

`packages/jdm-editor-vue/scripts/check-named-imports.mjs` resolves every
named import (and named re-export) against the package's real runtime
exports and fails on any that does not exist. It runs as part of
`pnpm --filter @nfk.st/jdm-editor-vue typecheck`, and standalone as
`check:imports`.

The same reasoning applies to the _type shims_ the port writes for JS-only
packages (`src/splitpanes.d.ts`): a shim must mirror the package's real
export surface, not the surface the port wishes it had.

## Known temp debt

- ~~`DiffMetadata` / `SimulationTrace*` type stand-ins~~ RETIRED at step 8:
  all sites (expression-store, dt-store, dt-empty, table-row, function/types,
  helpers/traversal) import the canonical decision-graph/dg-types +
  simulator/simulation.types — the sweep is complete.
- Toasts are `console` stand-ins (upstream uses antd message). The first real
  consumers have landed (decision-graph's canvas + clipboard), so `ui/Toast`
  (reka-ui Toast) is now worth building.
- Stale-closure fixes where upstream's `useMemo` / `useState` dependency
  lists omit a value the body reads. Upstream's trace list (the simulator)
  and its graph tab therefore froze at their first render; ours recompute.
  Each site carries a `// PORTING:` marker — the dependency lists are a
  React-era artifact, not a contract worth keeping.
- Upstream's `inferNodeTypes` returns from the immer recipe on the first
  node it walks, and the walk yields the input node first — so upstream's
  type inference never reaches a downstream node. Kept 1:1 (ADR-0002) and
  pinned by a test, so changing it to `continue` stays a deliberate
  decision rather than an accidental drift.
- Table drop-direction uses Sortable's `willInsertAfter` (insertion side)
  where upstream reads the pointer delta — same in the common case, differs
  dragging down onto a target's upper half. Marked in table.vue.
- The **excel dialog's "Enter field name" input sits inside reka's
  `SelectContent`**, whose typeahead moves the focus to a matching option
  and blocks Space and Tab; antd's select has no typeahead. The fix needs a
  browser to confirm, so it is not applied.
- The **Storybook harness has no dark-mode toggle** — upstream's preview
  has one. The dark parity was therefore never reviewed side by side.
- The **shipped types need `skipLibCheck`** (as most Vue libraries do):
  the declaration rollup writes Vue's `DefineComponent` type arguments out
  in full, and Vue 3.5's `GlobalComponents` does not satisfy that
  declaration's own constraint. The two defects the rollup DID cause —
  a phantom `monacoEditor` import and a type parameter shadowing Vue's
  `Component` — are fixed (see the pre-ship review above).

## Changelog (pin advances)

- (none yet)
