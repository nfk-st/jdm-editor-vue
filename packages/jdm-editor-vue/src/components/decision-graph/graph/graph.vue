<script lang="ts">
// Ported from components/decision-graph/graph/graph.tsx.
//
// PORTING (reactflow → @vue-flow/core — docs/vue-flow-mapping.md):
//   <ReactFlow>              → <VueFlow> (v-model:nodes / v-model:edges and
//                               apply-default=false — upstream applies the
//                               node/edge changes itself through its store)
//   onInit                   → @pane-ready (yields the VueFlowStore instance)
//   defaultViewport          → :default-viewport
//   <Background>             → @vue-flow/background's <Background>
//   <Controls>/<ControlButton> → @vue-flow/controls (extra buttons in the
//                               default slot)
//   instance.project(pt)     → instance.screenToFlowCoordinate(pt)
//   getOutgoers(...)         → the same-named @vue-flow/core util
//   SelectionMode.Partial    → :selection-mode (the enum is exported as-is)
//   proOptions               → DROPPED (vue-flow is MIT — no attribution to
//                               carry, see docs/vue-flow-mapping.md)
//   useNodesState/useEdgesState → hand-built triples (createGraphNodesState /
//                               createGraphEdgesState below)
//   React.memo(node types)   → plain components — vue-flow's reactivity
//                               covers the re-render granularity
//
// PORTING (antd → Reka UI + --grl-* tokens — ADR-0001):
//   App.useApp().modal.confirm → ui/Modal (graph-node.vue precedent)
//   message.error / notification.error → ui/Toast
//   Typography.Text          → .grl-typography spans
//   Button                   → ui/Button
//   @ant-design/icons        → lucide-vue-next
import type {
  Connection,
  Edge,
  EdgeChange,
  EdgeMouseEvent,
  Node,
  NodeChange,
  ViewportTransform,
  VueFlowStore,
  XYPosition,
} from '@vue-flow/core';

import type {
  DecisionGraphStoreType,
  ExposedStore,
  GraphEdgesState,
  GraphNodesState,
} from '../context/dg-store.context';
import type { DecisionGraphSnapshot } from '../context/serializer.context';
import type { DecisionNode } from '../dg-types';

// upstream: a module-local type (not exported).
type TabsSlice = { openTabs: string[]; activeTab: string };

export type GraphProps = {
  className?: string;
  // PORTING: upstream accepts `onDisableTabs` but never invokes it (the
  // canvas has no tab-disabling trigger) — the prop is kept so dg-wrapper's
  // binding keeps working, and stays unused exactly as upstream.
  onDisableTabs?: (val: boolean) => void;
};

export type GraphRef = DecisionGraphStoreType['actions'] & {
  stateStore: ExposedStore<DecisionGraphStoreType['state']>;
  serialize: () => DecisionGraphSnapshot;
  restore: (snapshot: DecisionGraphSnapshot) => void;
};

// PORTING: reactflow's `selected` lives on its Node/Edge; @vue-flow/core only
// carries it on the parsed GraphNode/GraphEdge. The casts keep the ported
// bodies literal (dg-store.context.ts precedent).
export type SelectableNode = Node & { selected?: boolean };
export type SelectableEdge = Edge & { selected?: boolean };

// PORTING: reactflow's useNodesState()/useEdgesState() return
// [elements, setElements, onElementsChange] — a tuple whose first slot always
// holds the current array. @vue-flow/core has no such helper, so the triples
// are built here with a getter on slot 0 (the same "always current" semantics
// upstream's useState tuple has) and reactflow's value-or-updater shape on
// slot 1.
export const createGraphNodesState = (
  getNodes: () => Node[],
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  applyChanges: (changes: NodeChange[]) => void,
): GraphNodesState => {
  const state: GraphNodesState = [getNodes(), setNodes, applyChanges];
  Object.defineProperty(state, 0, { get: getNodes, enumerable: true, configurable: true });
  return state;
};

export const createGraphEdgesState = (
  getEdges: () => Edge[],
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  applyChanges: (changes: EdgeChange[]) => void,
): GraphEdgesState => {
  const state: GraphEdgesState = [getEdges(), setEdges, applyChanges];
  Object.defineProperty(state, 0, { get: getEdges, enumerable: true, configurable: true });
  return state;
};

// PORTING: reactflow's instance.project(point) converts a CONTAINER-relative
// point into flow coordinates. @vue-flow/core's screenToFlowCoordinate()
// takes CLIENT coordinates (it subtracts the container's own rect itself),
// so the container offset is added back here to keep upstream's math.
// (both sides apply the flow's snapToGrid while projecting: reactflow's
// project() and vue-flow's screenToFlowCoordinate() share the same
// snap-aware helper.)
export const projectToFlowCoordinate = (instance: VueFlowStore, point: XYPosition, bounds: DOMRect): XYPosition =>
  instance.screenToFlowCoordinate({ x: point.x + bounds.left, y: point.y + bounds.top });
</script>

<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { ControlButton, Controls } from '@vue-flow/controls';
import {
  ConnectionMode,
  type EdgeComponent,
  type EdgeTypesObject,
  type NodeProps,
  SelectionMode,
  VueFlow,
  getOutgoers,
} from '@vue-flow/core';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, CircleAlert, Shrink } from 'lucide-vue-next';
import { P, match } from 'ts-pattern';
import { type Component, type VNode, computed, h, ref, shallowRef } from 'vue';

import { nodeSchema } from '../../../helpers/schema';
import Button from '../../ui/Button.vue';
import Modal from '../../ui/Modal.vue';
import { useToast } from '../../ui/toast';
import {
  useDecisionGraphActions,
  useDecisionGraphListeners,
  useDecisionGraphRaw,
  useDecisionGraphReferences,
  useDecisionGraphState,
} from '../context/dg-store.context';
import { useGraphSerializer, useSerializerRegistry } from '../context/serializer.context';
import { mapToDecisionEdge } from '../dg-util';
import { edgeFunction } from '../edge-function';
import { useGraphClipboard } from '../hooks/use-graph-clipboard';
import type { CustomNodeSpecification } from '../nodes/custom-node';
import GraphNode from '../nodes/graph-node.vue';
import type { NodeSpecification } from '../nodes/specifications/specification-types';
import { NodeKind } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';
import GraphComponents from './graph-components.vue';

const props = defineProps<GraphProps>();

const toast = useToast();

const componentsOpenedKey = 'jdm-components-opened';

const reactFlowWrapper = ref<HTMLDivElement | null>(null);
// PORTING: reactflow's ReactFlowInstance → @vue-flow/core's VueFlowStore
// (the store IS the instance). shallowRef on purpose: the store exposes
// ComputedRef getters (getNodes/getEdges) that a deep ref would auto-unwrap,
// breaking use-graph-clipboard's `getEdges.value` reads.
const reactFlowInstance = shallowRef<VueFlowStore | null>(null);

// PORTING: reactflow's useNodesState([])/useEdgesState([]) → local refs
// (the source of truth, exactly like upstream's useState arrays). They are
// handed to <VueFlow> through v-model:nodes / v-model:edges; vue-flow syncs
// them into its own store.
// PORTING: shallowRef, not ref — `ref` deep-unwraps the (recursive)
// @vue-flow/core Node/Edge types and trips TS2589 ("type instantiation is
// excessively deep"). The array identity is what the flow watches anyway.
const nodes = shallowRef<Node[]>([]);
const edges = shallowRef<Edge[]>([]);

const nodesState = createGraphNodesState(
  () => nodes.value,
  (next) => {
    nodes.value = typeof next === 'function' ? next(nodes.value) : next;
  },
  (changes) => {
    reactFlowInstance.value?.applyNodeChanges(changes);
  },
);

const edgesState = createGraphEdgesState(
  () => edges.value,
  (next) => {
    edges.value = typeof next === 'function' ? next(edges.value) : next;
  },
  (changes) => {
    reactFlowInstance.value?.applyEdgeChanges(changes);
  },
);

const raw = useDecisionGraphRaw();
const registry = useSerializerRegistry();
const graphActions = useDecisionGraphActions();
const graphReferences = useDecisionGraphReferences((s) => s);
const onReactFlowInit = useDecisionGraphListeners((s) => s.onReactFlowInit);

// upstream: graph.tsx:113-116 — the references block is re-assigned in the
// render body; the triples and the clipboard are stable for the component's
// lifetime, so they are assigned once here.
graphReferences.value.nodesState.current = nodesState;
graphReferences.value.edgesState.current = edgesState;
graphReferences.value.graphClipboard.current = useGraphClipboard(reactFlowInstance, reactFlowWrapper);

const state = useDecisionGraphState(({ id, disabled, decisionGraph }) => ({
  id,
  disabled,
  hasInputNode: (decisionGraph?.nodes || []).some((n) => n.type === NodeKind.Input),
}));

// PORTING(vue-flow): upstream's nodeTypes useMemo depends on [components,
// customNodeRenderer] — the wrappers are rebuilt only when the component
// list changes. A single selector that also read decisionGraph rebuilt them
// on EVERY graph edit, and vue-flow remounts a node when its component
// function changes identity: the inline condition editor was destroyed and
// recreated after one keystroke. These two selectors read only the
// properties upstream's memo depended on, so the store's per-node state
// changes cannot invalidate them.
const components = useDecisionGraphState((s) => s.components);
const customNodes = useDecisionGraphState((s) => s.customNodes);

// upstream: useState(() => { ... localStorage ... })
// PORTING(SSR): localStorage is read at setup time (upstream's useState
// initializer does the same). Import-safe under Node — the read happens on
// mount, not at module scope — but a server-rendered mount needs
// <ClientOnly>, per the client-only stance in docs/PORTING.md.
const initialComponentsOpened = (): boolean => {
  const localStorageKey = localStorage.getItem(componentsOpenedKey);
  if (!localStorageKey) {
    localStorage.setItem(componentsOpenedKey, 'true');
    return true;
  }
  return localStorage.getItem(componentsOpenedKey) === 'true';
};
const componentsOpened = ref<boolean>(initialComponentsOpened());

const initialViewport = ref<ViewportTransform | undefined>(undefined);

// upstream: React.memo((props: MinimalNodeProps) => value.renderNode({ specification: value, ...props }))
// PORTING: only the minimal props are forwarded — vue-flow hands the whole
// NodeProps to a node component and the extra keys would fall through to the
// rendered element as DOM attributes.
const renderSpecificationNode =
  (specification: NodeSpecification) =>
  (props: NodeProps): VNode =>
    h(specification.renderNode, {
      specification,
      id: props.id,
      data: props.data,
      selected: props.selected,
    });

// upstream: customNodeRenderer useMemo (graph.tsx:118-159)
const customNodeRenderer = (props: NodeProps): VNode => {
  const node = (customNodes.value || []).find((node) => node.kind === props?.data?.kind) as
    CustomNodeSpecification<object, string> | undefined;

  if (!node) {
    console.warn('node not found', props, customNodes.value);
    return h(GraphNode, {
      id: props.id,
      specification: {
        displayName: `${props.data?.kind}`,
        color: 'var(--grl-color-error)',
        // PORTING: antd's <WarningOutlined /> → lucide's CircleAlert (the
        // icon is stored as a component, not a vnode — a vnode must not be
        // re-mounted across node instances).
        icon: CircleAlert,
      },
      name: props?.data?.name,
      isSelected: props.selected,
      displayError: true,
      noBodyPadding: true,
      handleLeft: true,
      handleRight: true,
    });
  }

  return h(node.renderNode, {
    specification: node,
    id: props.id,
    data: props.data,
    selected: props.selected,
  });
};

// upstream: nodeTypes useMemo (graph.tsx:161-178)
// PORTING(vue-flow): upstream's memo rebuilds the wrappers only when the
// component list changes. The built-in specifications are a module constant,
// so their wrappers are created ONCE — vue-flow remounts a node when its
// component function changes identity, and rebuilding them on every graph
// edit remounted every node (the inline condition editor died after one
// keystroke). The host's components are re-wrapped only when that list is
// replaced.
const builtInNodeTypes: Record<string, Component> = Object.fromEntries(
  Object.entries(nodeSpecification).map(([key, value]) => [key, renderSpecificationNode(value)]),
);

const nodeTypes = computed(() => {
  const types: Record<string, Component> = { ...builtInNodeTypes };

  (components.value || []).forEach((component) => {
    types[component.type] = renderSpecificationNode(component);
  });

  types.customNode = customNodeRenderer;

  return types;
});

// upstream: const edgeTypes = { edge: React.memo(edgeFunction(null)) }
// PORTING: upstream's `null` outer props become `{}` — the ported edgeFunction
// spreads them over the edge props (spreading null is a no-op in JS too).
// PORTING: upstream's React.memo wrapper has no vue-flow equivalent — the
// edge type map is a plain component map (docs/vue-flow-mapping.md).
const edgeTypes: EdgeTypesObject = {
  edge: edgeFunction({}) as unknown as EdgeComponent,
};

const addNodeInner = async (type: string, position?: XYPosition, component?: string) => {
  if (!reactFlowWrapper.value || !reactFlowInstance.value) {
    return;
  }

  if (!position) {
    const rect = reactFlowWrapper.value.getBoundingClientRect();
    const rectCenter = {
      x: rect.width / 2,
      y: rect.height / 2,
    };

    position = projectToFlowCoordinate(reactFlowInstance.value, rectCenter, rect);
  }

  const customSpecification = match(type)
    .with('customNode', () => (customNodes.value || []).find((node) => node.kind === component))
    .otherwise(() => {
      const allSpecifications = [...Object.values(nodeSpecification), ...(components.value || [])];
      return allSpecifications.find((s) => s.type === type);
    });
  if (!customSpecification) {
    toast.error(`Unknown node type ${type} - ${component}.`);
    return;
  }

  let newNode: DecisionNode | null = match(customSpecification)
    .with({ kind: P.string }, (specification) => {
      const existingCount =
        (reactFlowInstance.value?.getNodes.value || []).filter((n) => n.data?.kind === specification.kind).length + 1;

      const partialNode = specification.generateNode({ index: existingCount });
      return {
        id: crypto.randomUUID(),
        type: 'customNode',
        name: partialNode.name,
        position: position as XYPosition,
        content: {
          kind: specification.kind,
          config: partialNode?.config,
        },
      } satisfies DecisionNode;
    })
    .with({ type: P.string }, (specification) => {
      const existingCount =
        (reactFlowInstance.value?.getNodes.value || []).filter((n) => n.type === specification.type).length + 1;
      const partialNode = specification.generateNode({ index: existingCount });

      return {
        id: crypto.randomUUID(),
        type: specification.type,
        position: position as XYPosition,
        ...partialNode,
      } satisfies DecisionNode;
    })
    .otherwise(() => null);
  if (!newNode) {
    toast.error(`Unknown node type ${type} - ${component}.`);
    return;
  }

  if (customSpecification.onNodeAdd) {
    try {
      newNode = (await customSpecification.onNodeAdd(newNode as any)) as any;
    } catch {
      return;
    }
  }

  const parsed = nodeSchema.safeParse(newNode);
  if (parsed.success) {
    return graphActions.addNodes([nodeSchema.parse(newNode)]);
  }
  toast.error(parsed.error?.message);
};

const isValidConnection = (connection: Connection): boolean => {
  // PORTING(vue-flow): reactflow consults the flow-level isValidConnection
  // ONLY while a connection is being dragged. vue-flow consults it for EVERY
  // edge it syncs (createGraphEdges → isValidConnection(edge, …)), and
  // rejects the edge with EDGE_INVALID when it returns false.
  //
  // Upstream's validator is ported verbatim below, and it rejects an edge
  // that duplicates an existing one — but the edge being synced IS in the
  // list, so every edge matched itself and was dropped: nothing rendered,
  // and a drawn connection never appeared.
  //
  // vue-flow passes the full Edge (it carries an id) when syncing and an
  // id-less Connection while dragging. Only the drag shape is validated;
  // an edge that is already in the store was validated when it was drawn.
  if ('id' in connection) {
    return true;
  }

  // Disallow self-reference
  if (connection.source === connection.target) {
    return false;
  }

  if (state.value.disabled) {
    return false;
  }

  const [currentNodes] = nodesState;
  const [currentEdges] = edgesState;

  const hasDuplicate = currentEdges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
      (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
  );

  const target = currentNodes.find((node) => node.id === connection.target);
  if (!target || target.id === connection.source) {
    return false;
  }

  const hasCycle = (node: Node, visited = new Set()) => {
    if (visited.has(node.id)) {
      return false;
    }

    visited.add(node.id);

    for (const outgoer of getOutgoers(node, currentNodes, currentEdges)) {
      if (outgoer.id === connection.source) return true;
      if (hasCycle(outgoer, visited)) return true;
    }
  };

  return !hasDuplicate && !hasCycle(target);
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  if (!reactFlowWrapper.value || !reactFlowInstance.value) {
    return;
  }

  const reactFlowBounds = reactFlowWrapper.value.getBoundingClientRect();
  let elementPosition: XYPosition;

  try {
    elementPosition = JSON.parse(event.dataTransfer?.getData('relativePosition') ?? '');
  } catch {
    return;
  }

  const position = projectToFlowCoordinate(
    reactFlowInstance.value,
    {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    },
    reactFlowBounds,
  );

  position.x -= Math.round((elementPosition.x * 226) / 10) * 10;
  position.y -= Math.round((elementPosition.y * 60) / 10) * 10;

  const nodeData = event.dataTransfer?.getData('nodeData');
  if (nodeData) {
    try {
      const jsonData = JSON.parse(nodeData);
      graphActions.addNodes([nodeSchema.parse({ ...jsonData, position })]);
    } catch (err) {
      toast.notificationError({ message: 'Failed to create a node' });
      console.error(err);
    }

    return;
  }

  const type = event.dataTransfer?.getData('nodeType') ?? '';
  const component = match(event.dataTransfer?.getData('customNodeComponent'))
    .with(P.string, (c) => c)
    .otherwise(() => undefined);

  void addNodeInner(type, position, component);
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
};

const onConnect = (params: Connection) => {
  const edge = {
    ...params,
    type: 'edge',
    id: crypto.randomUUID(),
  };

  if (state.value.disabled) return;
  graphActions.addEdges([mapToDecisionEdge(edge)]);
};

const onPaneReady = (instance: VueFlowStore) => {
  // upstream: onInit — the instance lands in the references block.
  reactFlowInstance.value = instance;
  graphReferences.value.reactFlowInstance.current = instance;
  if (initialViewport.value) {
    instance.setViewport(initialViewport.value);
  }
  onReactFlowInit.value?.(instance);
};

const onNodesChange = (changes: NodeChange[]) => {
  // PORTING: reactflow's onNodesDelete has no @vue-flow/core counterpart (the
  // flow has no nodes-delete emit) — the removals are picked out of the
  // change list instead.
  changes
    .filter((change) => change.type === 'remove')
    .forEach((change) => {
      graphActions.closeTab(change.id);
    });

  graphActions.handleNodesChange(changes);
};

const onEdgesChange = (changes: EdgeChange[]) => {
  graphActions.handleEdgesChange(changes);
};

const onEdgeMouseEnter = (event: EdgeMouseEvent) => {
  graphActions.setHoveredEdgeId(event.edge.id);
};

const onEdgeMouseLeave = () => {
  graphActions.setHoveredEdgeId(null);
};

const onRootKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'v' && event.metaKey && !state.value.disabled) {
    graphActions.pasteNodes();
  }
};

// PORTING: antd modal.confirm → local ui/Modal open state (graph-node.vue
// precedent).
const deleteModalOpen = ref(false);
// PORTING: shallowRef — a deep ref would unwrap the recursive
// @vue-flow/core Node/Edge types (TS2589).
const deleteSelection = shallowRef<{ nodes: SelectableNode[]; edges: SelectableEdge[] }>({ nodes: [], edges: [] });

const deleteTitle = computed(() => {
  const length = deleteSelection.value.nodes.length;
  return `Delete ${length > 1 ? 'nodes' : 'node'}`;
});

const deleteDescription = computed(() => {
  const length = deleteSelection.value.nodes.length;
  const text = length > 1 ? 'nodes' : 'node';
  return `Are you sure you want to delete ${length > 1 ? `${length} ${text}` : text}?`;
});

const onConfirmDelete = () => {
  deleteModalOpen.value = false;

  const { nodes: selectedNodes, edges: selectedEdges } = deleteSelection.value;

  if (selectedEdges.length > 0) {
    graphActions.removeEdges(selectedEdges.map((e) => e.id));
  }
  graphActions.removeNodes(selectedNodes.map((n) => n.id));
};

const onContentKeyDown = (event: KeyboardEvent) => {
  const [currentNodes] = nodesState;
  const [currentEdges] = edgesState;

  if (event.key === 'c' && event.metaKey) {
    const selectedNodeIds = currentNodes.filter((n) => (n as SelectableNode).selected).map(({ id }) => id);
    if (selectedNodeIds.length === 0) {
      return;
    }

    graphActions.copyNodes(selectedNodeIds);
    event.preventDefault();
  } else if (event.key === 'd' && event.metaKey) {
    if (!state.value.disabled) {
      const selectedNodeIds = currentNodes.filter((n) => (n as SelectableNode).selected).map(({ id }) => id);
      if (selectedNodeIds.length === 0) {
        return;
      }

      graphActions.duplicateNodes(selectedNodeIds);
    }
    event.preventDefault();
  } else if (event.key === 'Backspace') {
    if (!state.value.disabled) {
      const selectedNodes = currentNodes.filter((n) => (n as SelectableNode).selected) as SelectableNode[];
      const selectedEdges = currentEdges.filter((e) => (e as SelectableEdge).selected) as SelectableEdge[];

      if (selectedNodes.length > 0) {
        deleteSelection.value = { nodes: selectedNodes, edges: selectedEdges };
        deleteModalOpen.value = true;
      } else if (selectedEdges.length > 0) {
        graphActions.removeEdges(selectedEdges.map((e) => e.id));
      }
    }
    event.stopPropagation();
    event.preventDefault();
  }
};

const toggleComponentsOpened = () => {
  const value = !componentsOpened.value;
  componentsOpened.value = !componentsOpened.value;
  localStorage.setItem(componentsOpenedKey, `${value}`);
};

const toggleCompactMode = () => {
  graphActions.toggleCompactMode();
};

useGraphSerializer<ViewportTransform>('viewport', {
  serialize: () => reactFlowInstance.value?.getViewport() ?? { x: 0, y: 0, zoom: 1 },
  restore: (viewport) => {
    if (!viewport) return;
    initialViewport.value = viewport;
    reactFlowInstance.value?.setViewport(viewport);
  },
});

useGraphSerializer<TabsSlice>('tabs', {
  serialize: () => {
    const { openTabs, activeTab } = raw.stateStore.getState();
    return { openTabs, activeTab };
  },
  restore: ({ openTabs, activeTab } = { openTabs: [], activeTab: 'graph' }) => {
    raw.stateStore.setState({ openTabs: openTabs ?? [], activeTab: activeTab ?? 'graph' });
  },
});

useGraphSerializer<boolean>('componentsOpened', {
  serialize: () => componentsOpened.value,
  restore: (value) => {
    if (typeof value !== 'boolean') return;
    componentsOpened.value = value;
    localStorage.setItem(componentsOpenedKey, `${value}`);
  },
});

// upstream: useImperativeHandle(ref, () => ({ ...graphActions, stateStore,
// serialize, restore }))
defineExpose({
  ...graphActions,
  stateStore: raw.stateStore,
  serialize: () => registry?.serialize() ?? {},
  restore: (snapshot: DecisionGraphSnapshot) => registry?.restore(snapshot ?? {}),
});
</script>

<template>
  <div :class="clsx(['tab-content', props.className])" tabindex="0" @keydown="onRootKeyDown">
    <div :style="{ width: '100%', height: '100%', position: 'relative', display: 'flex' }">
      <div tabindex="0" class="content-wrapper" @keydown="onContentKeyDown">
        <div ref="reactFlowWrapper" class="react-flow" @drop="onDrop" @dragover="onDragOver">
          <!-- PORTING(vue-flow): reactflow's default connectionMode is
               Strict; vue-flow's is Loose, which would accept an
               output→output or input→input drag. Pinned to upstream's.
               PORTING(vue-flow): upstream sets edgesUpdatable={!disabled},
               but reactflow only draws the update handles when an
               onEdgeUpdate handler exists — upstream has none, so no
               handle is drawn. vue-flow draws them from the flag alone. -->
          <!-- PORTING(vue-flow): no edge update handles — upstream has no
                 onEdgeUpdate handler, so reactflow draws none. -->
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :delete-key-code="null"
            :elevate-edges-on-select="false"
            :elevate-nodes-on-select="true"
            :zoom-on-double-click="false"
            :connection-radius="35"
            :default-viewport="initialViewport"
            :snap-to-grid="true"
            :snap-grid="[5, 5]"
            :min-zoom="0.25"
            :selection-mode="SelectionMode.Partial"
            :connection-mode="ConnectionMode.Strict"
            :node-types="nodeTypes"
            :edge-types="edgeTypes"
            :is-valid-connection="isValidConnection"
            :nodes-connectable="!state.disabled"
            :nodes-draggable="!state.disabled"
            :edges-updatable="false"
            :apply-default="false"
            @pane-ready="onPaneReady"
            @nodes-change="onNodesChange"
            @edges-change="onEdgesChange"
            @connect="onConnect"
            @edge-mouse-enter="onEdgeMouseEnter"
            @edge-mouse-leave="onEdgeMouseLeave"
          >
            <!-- PORTING: upstream's <Controls id={id} showInteractive={false}>
                 — @vue-flow/controls' Controls renders a Panel and declares no
                 `id` prop, so the id is not forwarded. The extra compact-mode
                 button goes into the default slot. -->
            <Controls :show-interactive="false">
              <ControlButton @click="toggleCompactMode">
                <Shrink :size="14" />
              </ControlButton>
            </Controls>
            <Background :id="state.id" color="var(--grl-color-border)" :gap="20" />
          </VueFlow>
        </div>
      </div>
      <div v-if="!state.disabled" :class="clsx('grl-dg__aside__menu', !componentsOpened && 'collapsed')">
        <div class="grl-dg__aside__menu__heading">
          <div v-if="componentsOpened" class="grl-dg__aside__menu__heading__text">
            <!-- PORTING: antd Typography.Text strong / type='secondary' →
                 .grl-typography spans (strong → font-weight 600). -->
            <span class="grl-typography" :style="{ marginBottom: 0, fontWeight: 600 }">Components</span>
            <span class="grl-typography grl-typography--secondary" :style="{ fontSize: '10px', marginLeft: '5px' }">
              (Drag-and-drop)
            </span>
          </div>
          <Button type="text" size="small" @click="toggleComponentsOpened">
            <template #icon>
              <ChevronRight v-if="componentsOpened" :size="12" />
              <ChevronLeft v-else :size="12" />
            </template>
          </Button>
        </div>
        <div class="grl-dg__aside__menu__content">
          <GraphComponents
            :input-disabled="state.hasInputNode"
            :collapsed="!componentsOpened"
            :disabled="state.disabled"
          />
        </div>
      </div>
    </div>

    <!-- PORTING: antd modal.confirm({ title: 'Delete node', okButtonProps:
         { danger: true } }) → ui/Modal with a danger OK footer button. -->
    <Modal
      confirm
      :open="deleteModalOpen"
      :title="deleteTitle"
      :width="416"
      @update:open="(o) => (deleteModalOpen = o)"
    >
      <span class="grl-typography">{{ deleteDescription }}</span>
      <template #footer>
        <Button @click="deleteModalOpen = false">Cancel</Button>
        <Button type="primary" danger @click="onConfirmDelete">OK</Button>
      </template>
    </Modal>
  </div>
</template>

<style lang="scss">
// PORTING(additive): @vue-flow/background ships no CSS of its own — the
// pattern has to be pinned to the canvas' edges.
.vue-flow__background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
