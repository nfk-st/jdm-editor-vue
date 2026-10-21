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
- Event props → kebab-case emits (`@edge-mouse-enter`, `@nodes-change`,
  `@edges-change`). Vue Flow 1.48 has no `@nodes-delete` emit — the delete
  events are `onNodesDelete` / `onEdgesDelete` on the store, not component
  emits.
- Upstream's `React.memo` custom-equality node wrappers — rely on vue-flow
  reactivity (no equivalent).
- `@vue-flow/core`, `@vue-flow/background` and `@vue-flow/controls` all
  import cleanly under Node (verified — no module-level browser access), so
  the library stays SSR-import-safe. The canvas itself must still mount
  `VueFlow` in `onMounted`, never at module scope.

## The differences that bite

Reactflow and Vue Flow agree on the API names and differ on the
**semantics**. These are the ones that changed the port's behaviour (each
is marked `// PORTING(vue-flow):` at the site):

| Reactflow                                                           | Vue Flow                                             | Consequence                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `isValidConnection` runs only while a connection is dragged         | it runs for EVERY edge it syncs (`createGraphEdges`) | upstream's validator rejected each synced edge against itself — no edge ever rendered   |
| `connectionMode` defaults to `Strict`                               | it defaults to `Loose`                               | output→output and input→input drags were accepted                                       |
| an edge's update handles need an `onEdgeUpdate` handler             | the flag alone draws them                            | the port drew handles upstream never shows                                              |
| a node's `width`/`height` are ignored (the DOM is measured)         | they are written as inline px                        | the nodes were pinned to their first measured size                                      |
| the class names are `react-flow__*`                                 | `vue-flow__*`                                        | the ported stylesheet matched nothing                                                   |
| a handle is placed with `left: -4px; transform: translate(0, -50%)` | `left: 0; transform: translate(-50%, -50%)`          | the handles sat further out, and jumped on the hover scale                              |
| the visible edge path comes first, then the interaction path        | the same order                                       | upstream's "hover the transparent path to recolour the edge" rule never fires in either |
| `nodeTypes` is a plain map                                          | a changed component function REMOUNTS the node       | rebuilding the map on every edit remounted every node                                   |

The store has no `onNodesDelete` / `onEdgesDelete`: Vue Flow 1.48 exposes
the removals through the change events only.
