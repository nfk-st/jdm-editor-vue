# reactflow 11.11.4 → @vue-flow/core 1.48.2 — port mapping

Verified against installed .d.ts files (round: step-8 fact-finding). Feed this
into every decision-graph port brief.

## Components

| reactflow                                                              | vue-flow 1.48.2                     | Notes                                                                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ReactFlow`                                                            | `VueFlow`                           | `nodes`/`edges` → `v-model:nodes` / `v-model:edges`                                                                                        |
| `onNodesChange`/`onEdgesChange`                                        | `@nodes-change` / `@edges-change`   | store also applies changes itself unless `applyDefault:false` — upstream handles changes manually via produce, so set `applyDefault:false` |
| `Background`                                                           | `@vue-flow/background` `Background` | `color`,`gap`; `variant` (not `patternType`); ships NO css                                                                                 |
| `Controls`/`ControlButton`                                             | `@vue-flow/controls`                | extra buttons via default slot                                                                                                             |
| `ReactFlowProvider`                                                    | **none needed**                     | `useVueFlow()` creates/injects globally — delete provider layer                                                                            |
| `Handle`, `Position`, `BaseEdge`, `EdgeLabelRenderer`, `getBezierPath` | same names                          |                                                                                                                                            |
| `proOptions`                                                           | **DOES NOT EXIST**                  | MIT, no attribution — drop prop + `reactFlowProOptions` plumbing (PORTING-marked public API deviation)                                     |

CSS (already imported in our styles.scss): `@vue-flow/core/dist/style.css`,
`theme-default.css`, `@vue-flow/controls/dist/style.css`.

## Hooks

- `useReactFlow` → `useVueFlow(options?)` returns `VueFlowStore` = hooks +
  `ToRefs<State>` + actions; `store.nodes` is `Ref<GraphNode[]>`.
- `useNodesState`/`useEdgesState` → **no equivalent**: `ref([])` +
  `useVueFlow().setNodes` + `applyDefault:false`.
- `applyNodeChanges`/`applyEdgeChanges` exist but upstream doesn't use them.

## Types

- `Node`→`Node`/runtime `GraphNode`; `Edge`→`Edge`/`GraphEdge`. `Node<Data>` same.
- `NodeProps`/`EdgeProps` exist, but custom components receive the whole
  `GraphNode`; forward `connectable` to Handles.
- `NodeChange`/`EdgeChange` same names/unions (incl. `{type:'position',
position, dragging}`). `MarkerType.ArrowClosed`, `Position` identical.
- `HandleProps`: `id/type/position/connectable/isValidConnection` — no
  `isConnectable`.
- `Viewport`→`ViewportTransform`. `ProOptions` — drop.

## Instance

- No `ReactFlowInstance` — the store IS the instance (`useVueFlow()` or
  `@pane-ready`). Methods used upstream all exist as Actions:
  `getNodes/setNodes/addNodes/getEdges/setEdges/addEdges/removeNodes/
removeEdges/findNode/updateNode/updateNodeData/toObject/getViewport/
setViewport/fitView({nodes,duration,maxZoom})`.
- `project()` deprecated → `screenToFlowCoordinate` (Coordinate, not Position).
- `domNode` → `vueFlowRef`/`viewportRef`.
- `getOutgoers/getIncomers`: pure utils `(nodeOrId, nodes, edges)` or store methods.

## Gotchas

- `nodeTypes` map values are Vue components (or `#node-{type}` slots).
- `onInit` → `@pane-ready`; `onDrop/onDragOver` stay on the wrapper div.
- Event props → kebab-case emits (`@nodes-delete`, `@edge-mouse-enter`).
- Upstream's `React.memo` custom-equality node wrappers — rely on vue-flow
  reactivity (no equivalent).
