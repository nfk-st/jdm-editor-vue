// Ported from components/decision-graph/context/dg-store.context.tsx.
// PORTING: zustand ×3 (state + listeners + references) + plain actions →
// three MiniStores + actions, on the pattern certified in
// expression-store.context.ts / dt-store.context.ts (helpers/mini-store.ts).
// reactflow → @vue-flow/core adaptations are marked inline; action bodies
// otherwise stay literal (immer produce flows through setState over the
// toRaw'd tree — the dt-store freeze-invariant lesson).
import { type VariableType } from '@gorules/zen-engine-wasm';
import type { Edge, EdgeChange, Node, NodeChange, VueFlowStore } from '@vue-flow/core';
import equal from 'fast-deep-equal/es6/react';
import type { WritableDraft } from 'immer';
import { produce } from 'immer';
import { match } from 'ts-pattern';
import { type Component, type ComputedRef, type InjectionKey, type VNode, computed, inject, provide, toRaw } from 'vue';

import { type MiniStore, createMiniStore } from '../../../helpers/mini-store';
import type { Monaco } from '../../../helpers/monaco';
import type { DictionaryMap } from '../../../theme';
import type { CodeEditorProps } from '../../code-editor';
import type { JdmUiMode } from '../../decision-table/context/dt-store.context';
import type { DecisionEdge, DecisionGraphType, DecisionNode } from '../dg-types';
import { privateSymbol } from '../dg-types';
import { mapToGraphEdge, mapToGraphEdges, mapToGraphNode, mapToGraphNodes } from '../dg-util';
import type { useGraphClipboard } from '../hooks/use-graph-clipboard';
import type { CustomNodeSpecification } from '../nodes/custom-node';
import { NodeKind, type NodeSpecification } from '../nodes/specifications/specification-types';
import type { Simulation } from '../simulator/simulation.types';

export type PanelType = {
  id: string;
  // PORTING: React.ReactNode → VNode | Component; renderPanel React.FC → Component.
  icon: VNode | Component;
  title: string;
  renderPanel?: Component;
  hideHeader?: boolean;
  onClick?: () => void;
};

type DraftUpdateCallback<T> = (draft: WritableDraft<T>) => WritableDraft<T>;

export type ViewConfigPermission = 'edit:values' | 'edit:rules' | 'edit:full';

export type ViewConfig = {
  enabled: boolean;
  description?: string;
  permissions?: Record<string, ViewConfigPermission | null | undefined> | null;
};

export enum NodeTypeKind {
  Input,
  Output,
  InferredInput,
  InferredOutput,
}

export type SetDecisionGraphOptions = {
  skipOnChangeEvent?: boolean;
};

// PORTING: reactflow's useNodesState()/useEdgesState() triples
// [nodes, setNodes, onNodesChange] don't exist in @vue-flow/core; the
// VueFlowStore provides the same operations. graph (phase C) builds each
// triple from it — [nodes, setNodes, applyNodeChanges] — and keeps it fresh
// by re-assigning on node/edge state changes (upstream re-assigns in the
// render body, graph.tsx:113-116). The slots take reactflow's
// value-or-updater shape; @vue-flow/core's setNodes/setEdges and
// applyNodeChanges/applyEdgeChanges are directly assignable to them.
export type GraphNodesState = [
  Node[],
  (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  (changes: NodeChange[]) => void,
];
export type GraphEdgesState = [
  Edge[],
  (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  (changes: EdgeChange[]) => void,
];

// PORTING: upstream stores React refs (MutableRefObject) in the reference
// store, assigned by graph (upstream graph.tsx:113-116). Plain { current }
// wrappers — NOT Vue Refs — because the MiniStore is reactive() and would
// auto-unwrap nested Vue refs on property access.
export type MutableRefObject<T> = { current: T };

const createRef = <T>(): MutableRefObject<T | null> => ({ current: null });

export type DecisionGraphStoreType = {
  state: {
    id?: string;
    hideLeftToolbar?: boolean;
    components: NodeSpecification[];
    disabled?: boolean;
    decisionGraph: DecisionGraphType;
    hoveredEdgeId: string | null;
    openTabs: string[];
    activeTab: string;

    viewConfigCta?: string;
    viewConfig?: ViewConfig;

    name: string;

    customNodes: CustomNodeSpecification<object, any>[];

    panels?: PanelType[];
    activePanel?: string;
    onPanelsChange?: (val?: string) => void;

    simulate?: Simulation;

    compactMode?: boolean;

    dictionaries?: DictionaryMap;
    mode?: JdmUiMode;

    nodeTypes: Record<string, Partial<Record<NodeTypeKind, VariableType>>>;
    globalType: Record<string, VariableType>;
  };

  references: {
    // PORTING: non-null like upstream's createRef() cast, but null at
    // runtime until graph assigns; the actions' optional paths null-guard.
    nodesState: MutableRefObject<GraphNodesState>;
    edgesState: MutableRefObject<GraphEdgesState>;
    // PORTING: ReactFlowInstance → @vue-flow/core's VueFlowStore (the
    // useVueFlow()/onInit instance type).
    reactFlowInstance: MutableRefObject<VueFlowStore | null>;
    graphClipboard: MutableRefObject<ReturnType<typeof useGraphClipboard> | null>;
  };

  actions: {
    setDecisionGraph: (val: Partial<DecisionGraphType>, options?: SetDecisionGraphOptions) => void;

    handleNodesChange: (nodesChange: NodeChange[]) => void;
    handleEdgesChange: (edgesChange: EdgeChange[]) => void;

    setNodes: (nodes: DecisionNode[]) => void;
    addNodes: (nodes: DecisionNode[]) => void;
    updateNode: (id: string, updater: DraftUpdateCallback<DecisionNode>) => void;
    removeNodes: (ids: string[]) => void;

    duplicateNodes: (ids: string[]) => void;
    copyNodes: (ids: string[]) => void;
    pasteNodes: () => void;

    setEdges: (edges: DecisionEdge[]) => void;
    addEdges: (edge: DecisionEdge[]) => void;
    removeEdges: (ids: string[]) => void;
    removeEdgeByHandleId: (handleId: string) => void;
    setHoveredEdgeId: (edgeId: string | null) => void;

    closeTab: (id: string, action?: string) => void;
    openTab: (id: string) => void;
    goToNode: (id: string) => void;

    setActivePanel: (panel?: string) => void;

    setCompactMode: (mode: boolean) => void;
    toggleCompactMode: () => void;

    setNodeType: (id: string, kind: NodeTypeKind, vt: VariableType) => void;
    removeNodeType: (id: string, kind?: NodeTypeKind) => void;

    triggerNodeSelect: (id: string, mode: 'toggle' | 'only') => void;
  };

  listeners: {
    onChange?: (val: DecisionGraphType) => void;
    onPanelsChange?: (val?: string) => void;
    // PORTING: ReactFlowInstance → VueFlowStore.
    onReactFlowInit?: (instance: VueFlowStore) => void;
    onCodeExtension?: CodeEditorProps['extension'];
    // PORTING: upstream's Monaco type comes from @monaco-editor/react; ours
    // is helpers/monaco's direct `type Monaco`.
    onFunctionReady?: (monaco: Monaco) => void;
    onViewConfigCta?: () => void;
  };
};

export type DecisionGraphStoreBundle = {
  stateStore: MiniStore<DecisionGraphStoreType['state']>;
  listenerStore: MiniStore<DecisionGraphStoreType['listeners']>;
  referenceStore: MiniStore<DecisionGraphStoreType['references']>;
  actions: DecisionGraphStoreType['actions'];
};

// PORTING: upstream's zustand `ExposedStore<T>` (UseBoundStore<StoreApi<T>>
// & { setState }) — MiniStore already carries both members; alias kept for
// the files that name it (graph's GraphRef).
export type ExposedStore<T extends object> = MiniStore<T>;

// PORTING(P5): upstream defaults the context to `{} as any` (crashes on use
// without a provider); we create a detached real bundle — deliberate
// friendlier mode (dt-store precedent).
const DecisionGraphStoreKey: InjectionKey<DecisionGraphStoreBundle> = Symbol('decision-graph-store');

export type DecisionGraphContextProps = {
  //
};

export const createDecisionGraphStoreBundle = (): DecisionGraphStoreBundle => {
  const stateStore = createMiniStore<DecisionGraphStoreType['state']>(() => ({
    id: undefined,
    simulate: undefined,
    decisionGraph: { nodes: [], edges: [] },
    hoveredEdgeId: null,
    openTabs: [],
    activeTab: 'graph',
    name: 'graph.json',
    disabled: false,
    components: [],
    customNodes: [],
    activePanel: undefined,
    panels: [],
    // PORTING(SSR): localStorage is read at setup time (upstream reads it in
    // the store's initial state too). The module is still import-safe under
    // Node — nothing touches the browser at module scope — but a component
    // that MOUNTS on the server needs <ClientOnly>, per the client-only
    // stance in docs/PORTING.md.
    compactMode: localStorage.getItem('jdm-compact-mode') === 'true',
    nodeTypes: {},
    globalType: {},
  }));

  const listenerStore = createMiniStore<DecisionGraphStoreType['listeners']>(() => ({
    onChange: undefined,
    onPanelsChange: undefined,
  }));

  const referenceStore = createMiniStore<DecisionGraphStoreType['references']>(() => ({
    nodesState: createRef() as MutableRefObject<GraphNodesState>,
    edgesState: createRef() as MutableRefObject<GraphEdgesState>,
    graphClipboard: createRef() as MutableRefObject<ReturnType<typeof useGraphClipboard>>,
    reactFlowInstance: createRef() as MutableRefObject<VueFlowStore | null>,
  }));

  // PORTING(fix): every immer produce below runs over `toRaw(decisionGraph)`
  // / `toRaw(nodeTypes)`, not the reactive proxies — immer's auto-freeze
  // violates the proxy invariant on frozen array targets when the recipe
  // iterates nested arrays (dt-store's getRawDecisionTable lesson).
  // reactive() re-wraps on read, so consumers are unaffected.
  const actions: DecisionGraphStoreType['actions'] = {
    handleNodesChange: (changes = []) => {
      const { nodesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();
      const [, , onNodesChange] = nodesState.current;

      let hasChanges = false;

      onNodesChange?.(changes);
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        changes.forEach((c) =>
          match(c)
            .with({ type: 'position' }, (p) => {
              const node = draft.nodes.find((n) => n.id === p.id);
              if (node && p.position && !equal(node.position, p.position)) {
                hasChanges = true;
                node.position = p.position;
              }
            })
            .with({ type: 'dimensions' }, (d) => {
              const node = draft.nodes.find((n) => n.id === d.id);
              if (node && !equal(node[privateSymbol]?.dimensions, d.dimensions)) {
                hasChanges = true;
                node[privateSymbol] ??= {};
                node[privateSymbol].dimensions = { height: d.dimensions?.height, width: d.dimensions?.width };
              }
            })
            .with({ type: 'select' }, (s) => {
              const node = draft.nodes.find((n) => n.id === s.id);

              if (node && node[privateSymbol]?.selected !== s.selected) {
                hasChanges = true;
                node[privateSymbol] ??= {};
                node[privateSymbol].selected = s.selected;
              }
            })
            .otherwise(() => {
              // No-op
            }),
        );
      });

      if (!hasChanges) {
        return;
      }

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    handleEdgesChange: (changes = []) => {
      const { decisionGraph } = stateStore.getState();
      const { edgesState } = referenceStore.getState();

      edgesState?.current?.[2](changes);
      if (changes.find((c) => c.type === 'remove')) {
        const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
          const edges = (draft.edges || [])
            .map((edge) => {
              const change = changes.find((change) => 'id' in change && change.id === edge.id);
              if (change?.type === 'remove') {
                return null;
              }
              return edge;
            })
            .filter((node) => !!node) as DecisionEdge[];
          draft.edges = edges;
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      }
    },
    setNodes: (nodes: DecisionNode[] = []) => {
      const { nodesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();
      nodesState?.current?.[1](mapToGraphNodes(nodes));

      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.nodes = nodes;
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    addNodes: (nodes: DecisionNode[]) => {
      const { nodesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();

      const hasInput = nodesState.current[0]?.some((n) => n.type === NodeKind.Input);
      if (hasInput) {
        nodes = nodes.filter((n) => n.type !== NodeKind.Input);
      }

      nodesState.current[1]?.((n) => n.concat(mapToGraphNodes(nodes)));
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.nodes = (draft.nodes || []).concat(nodes);
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    duplicateNodes: (ids) => {
      const { nodesState, edgesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();

      let nodes = (decisionGraph?.nodes || []).filter((n) => ids.includes(n.id));

      const hasInput = nodesState.current[0]?.some((n) => n.type === NodeKind.Input);
      if (hasInput) {
        nodes = nodes.filter((n) => n.type !== NodeKind.Input);
      }

      if (nodes.length === 0) {
        return;
      }

      const nodeIds: Record<string, string> = nodes.reduce(
        (acc, curr) => ({
          ...acc,
          [curr.id]: crypto.randomUUID(),
        }),
        {},
      );

      const newNodes = nodes.map<DecisionNode>((node) => ({
        ...node,
        id: nodeIds[node.id],
        position: {
          x: node.position?.x || 0,
          y: (node.position?.y || 0) + 140,
        },
      }));

      const oldNodeIds = Object.keys(nodeIds);
      const newEdges: DecisionEdge[] = [];

      if (newNodes.length > 0) {
        (edgesState.current?.[0] || []).forEach((edge) => {
          if (oldNodeIds.includes(edge.source) && oldNodeIds.includes(edge.target)) {
            newEdges.push({
              id: crypto.randomUUID(),
              type: edge.type,
              sourceId: nodeIds[edge.source],
              targetId: nodeIds[edge.target],
              sourceHandle: edge.sourceHandle ?? undefined,
              targetHandle: edge.targetHandle ?? undefined,
            });
          }
        });
      }

      nodesState.current[1]?.((n) => n.concat(newNodes.map(mapToGraphNode)));
      edgesState.current[1]?.((e) => e.concat(newEdges.map(mapToGraphEdge)));
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.nodes.push(...newNodes);
        draft.edges.push(...newEdges);
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    copyNodes: (ids) => {
      const { graphClipboard, nodesState } = referenceStore.getState();
      if (!graphClipboard.current || !nodesState.current) {
        return;
      }

      const [nodes] = nodesState.current;
      const copyNodes = nodes.filter((n) => ids.includes(n.id));

      graphClipboard.current.copyNodes(copyNodes);
    },
    pasteNodes: () => {
      const { graphClipboard } = referenceStore.getState();
      graphClipboard.current?.pasteNodes?.();
    },
    removeNodes: (ids = []) => {
      const { nodesState, edgesState } = referenceStore.getState();
      const { decisionGraph, nodeTypes } = stateStore.getState();

      nodesState.current[1]?.((nodes) => nodes.filter((n) => ids.every((id) => n.id !== id)));
      edgesState.current[1]?.((edges) =>
        edges.filter((e) =>
          ids.every((id) => e.source !== id && e.target !== id && e.sourceHandle !== id && e.targetHandle !== id),
        ),
      );

      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        const nodes = draft.nodes || [];
        const edges = draft.edges || [];
        draft.nodes = nodes.filter((n) => ids.every((id) => n.id !== id));
        draft.edges = edges.filter((e) =>
          ids.every((id) => e.sourceId !== id && e.targetId !== id && e.sourceHandle !== id && e.targetHandle !== id),
        );
      });

      const newNodeTypes = produce(toRaw(nodeTypes), (draft) => {
        ids.forEach((id) => {
          if (id in draft) {
            delete draft[id];
          }
        });
      });

      stateStore.setState({ decisionGraph: newDecisionGraph, nodeTypes: newNodeTypes });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    addEdges: (edges: DecisionEdge[]) => {
      const { edgesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();

      edgesState.current?.[1]?.((els) => els.concat(edges.map(mapToGraphEdge)));
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.edges = (draft.edges || []).concat(edges);
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    setEdges: (edges = []) => {
      const { edgesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();

      edgesState?.current?.[1]?.(mapToGraphEdges(edges));
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.edges = edges;
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    removeEdges: (ids) => {
      const { edgesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();

      edgesState?.current?.[1]?.((edges) => edges.filter((e) => !ids.find((id) => e.id === id)));
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.edges = draft.edges.filter((e) => !ids.find((id) => e.id === id));
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    removeEdgeByHandleId: (handleId: string) => {
      if (!handleId) return;
      const { edgesState } = referenceStore.getState();
      const { decisionGraph } = stateStore.getState();
      edgesState?.current?.[1]?.((edges) => edges.filter((e) => e.sourceHandle !== handleId));
      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        draft.edges = draft.edges.filter((e) => e.sourceHandle !== handleId);
      });

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    updateNode: (id, updater) => {
      const { decisionGraph } = stateStore.getState();
      const { nodesState } = referenceStore.getState();
      const [nodes, setNodes] = nodesState.current;

      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        const node = (draft.nodes ?? []).find((node) => node?.id === id);
        if (!node) {
          return;
        }

        updater(node);
      });

      const changedNode = newDecisionGraph.nodes.find((n) => n.id === id);
      if (!changedNode) {
        return;
      }

      const graphChangedNode = mapToGraphNode(changedNode as DecisionNode);
      const existingGraphNode = nodes.find((n) => n.id === id);
      if (!equal(graphChangedNode, existingGraphNode)) {
        setNodes((nodes) => nodes.map((n) => (n.id === id ? graphChangedNode : n)));
      }

      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
    setDecisionGraph: (graph, options = {}) => {
      const { decisionGraph } = stateStore.getState();
      const { edgesState, nodesState } = referenceStore.getState();
      const { skipOnChangeEvent = false } = options;

      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        // PORTING: `toRaw` on the base only — the INCOMING graph was copied
        // in as-is, so a host's `v-model="ref(graph)"` left Vue's reactive
        // proxy inside the store. The run payload is the store's graph, and
        // structuredClone(postMessage) of a proxy throws DataCloneError.
        Object.assign(draft, toRaw(graph));
      });

      edgesState?.current?.[1](mapToGraphEdges(newDecisionGraph?.edges ?? []));
      nodesState?.current?.[1](mapToGraphNodes(newDecisionGraph?.nodes ?? []));
      stateStore.setState({
        decisionGraph: newDecisionGraph,
      });
      if (!skipOnChangeEvent) {
        listenerStore.getState().onChange?.(newDecisionGraph);
      }
    },
    setHoveredEdgeId: (edgeId) => stateStore.setState({ hoveredEdgeId: edgeId }),
    goToNode: (id: string) => {
      if (stateStore.getState().activeTab !== 'graph') {
        return;
      }

      const { reactFlowInstance } = referenceStore.getState();
      if (!reactFlowInstance.current) {
        return;
      }

      // PORTING: reactflow's instance.getNode(id) → vue-flow's findNode
      // action. The store's getNode getter is a ComputedRef whose type and
      // the reactive proxy's runtime auto-unwrap disagree — findNode is a
      // plain method on both levels.
      const node = reactFlowInstance.current.findNode(id);
      if (!node) {
        return;
      }

      // PORTING: vue-flow's fitView takes node ids (upstream: node objects).
      reactFlowInstance.current.fitView({ nodes: [node.id], duration: 1_000, maxZoom: 1.25 });
    },
    openTab: (id: string) => {
      const { openTabs } = stateStore.getState();
      const nodeId = openTabs.find((i) => i === id);

      if (id === 'graph') {
        return stateStore.setState({ activeTab: id });
      }

      if (nodeId) {
        stateStore.setState({ activeTab: nodeId });
      } else {
        stateStore.setState({ openTabs: [...openTabs, id], activeTab: id });
      }
    },
    closeTab: (id: string, action?: string) => {
      const { openTabs, activeTab } = stateStore.getState();
      const index = openTabs?.findIndex((i) => i === id);
      const tab = openTabs?.[index];

      const updatedTabs = match(action)
        .with(undefined, () => openTabs.filter((id) => id !== tab))
        .with('close', () => openTabs.filter((id) => id !== tab))
        .with('close-all', () => [])
        .with('close-other', () => openTabs.filter((id) => id === tab))
        .with('close-right', () => openTabs.slice(0, index + 1))
        .with('close-left', () => openTabs.slice(index))
        .otherwise(() => openTabs);

      const updatedState: Partial<DecisionGraphStoreType['state']> = {
        openTabs: updatedTabs,
      };

      const newActiveTabId = updatedTabs?.find((i) => i === activeTab);
      if (!newActiveTabId) {
        updatedState.activeTab = updatedTabs?.[index - 1] ?? 'graph';
      }

      stateStore.setState(updatedState);
    },
    setActivePanel: (panel?: string) => {
      const { panels } = stateStore.getState();
      const updatedState: Partial<DecisionGraphStoreType['state']> = {
        activePanel: panel === undefined ? undefined : (panels || []).find((p) => p.id === panel)?.id,
      };
      listenerStore.getState()?.onPanelsChange?.(panel);
      stateStore.setState(updatedState);
    },
    setCompactMode: (mode: boolean) => {
      const updatedState: Partial<DecisionGraphStoreType['state']> = {
        compactMode: mode,
      };
      localStorage.setItem('jdm-compact-mode', `${mode}`);
      stateStore.setState(updatedState);
    },
    toggleCompactMode: () => {
      const { compactMode } = stateStore.getState();
      const mode = !compactMode;
      const updatedState: Partial<DecisionGraphStoreType['state']> = {
        compactMode: mode,
      };
      localStorage.setItem('jdm-compact-mode', `${mode}`);
      stateStore.setState(updatedState);
    },
    setNodeType: (id, kind, vt) => {
      const { nodeTypes } = stateStore.getState();

      const newNodeTypes = produce(toRaw(nodeTypes), (draft) => {
        draft[id] ??= {};
        draft[id][kind] = vt;
      });

      stateStore.setState({ nodeTypes: newNodeTypes });
    },
    removeNodeType: (id, kind) => {
      const { nodeTypes } = stateStore.getState();

      const newNodeTypes = produce(toRaw(nodeTypes), (draft) => {
        if (!(id in draft)) {
          return;
        }

        if (kind) {
          if (kind in draft[id]) {
            delete draft[id][kind];
          }
        } else {
          delete draft[id];
        }
      });

      stateStore.setState({ nodeTypes: newNodeTypes });
    },
    triggerNodeSelect: (id, mode) => {
      const { decisionGraph } = stateStore.getState();
      const { nodesState, edgesState } = referenceStore.getState();
      const [, setNodes] = nodesState.current;
      const [, setEdges] = edgesState.current;

      const newDecisionGraph = produce(toRaw(decisionGraph), (draft) => {
        const chosenNode = draft.nodes.find((n) => n.id === id);
        if (!chosenNode) {
          return;
        }

        if (mode === 'only') {
          draft.nodes.forEach((n) => {
            if (n[privateSymbol]) {
              n[privateSymbol].selected = false;
            }
          });
        }

        chosenNode[privateSymbol] ??= {};
        chosenNode[privateSymbol].selected = match(mode)
          .with('only', () => true)
          .otherwise(() => !chosenNode[privateSymbol]?.selected);
      });

      setNodes(mapToGraphNodes(newDecisionGraph.nodes));
      if (mode == 'only') {
        setEdges(
          // PORTING: reactflow's Edge carries selected; @vue-flow/core's
          // Edge doesn't (its GraphEdge state does) — cast keeps the body literal.
          (edges) =>
            edges.map((e) => ({
              ...e,
              selected: false,
            })) as Edge[],
        );
      }
      stateStore.setState({ decisionGraph: newDecisionGraph });
      listenerStore.getState().onChange?.(newDecisionGraph);
    },
  };

  return { stateStore, listenerStore, referenceStore, actions };
};

export const DecisionGraphProvider = (): DecisionGraphStoreBundle => {
  const bundle = createDecisionGraphStoreBundle();
  provide(DecisionGraphStoreKey, bundle);
  return bundle;
};

// PORTING: upstream hooks return slices; ours return ComputedRefs.
// PORTING(fix): the raw bundle is injected ONCE here (call sites are always
// component setup) instead of inside the computed getter — Vue 3.5's
// inject() returns undefined (even with a fallback) when a computed is
// re-evaluated outside setup/render. Selecting from the captured store keeps
// those lazy re-evaluations working (dt-store.context.ts lesson).
export const useDecisionGraphRaw = (): DecisionGraphStoreBundle =>
  inject(DecisionGraphStoreKey, createDecisionGraphStoreBundle, true);

// PORTING: upstream's optional `equals` param (zustand's selector equality)
// is dropped — Vue reactivity tracks structurally (expression-store precedent).
export const useDecisionGraphState = <T>(selector: (state: DecisionGraphStoreType['state']) => T): ComputedRef<T> => {
  const { stateStore } = useDecisionGraphRaw();
  return computed(() => selector(stateStore));
};

export const useDecisionGraphListeners = <T>(
  selector: (state: DecisionGraphStoreType['listeners']) => T,
): ComputedRef<T> => {
  const { listenerStore } = useDecisionGraphRaw();
  return computed(() => selector(listenerStore));
};

export const useDecisionGraphReferences = <T>(
  selector: (state: DecisionGraphStoreType['references']) => T,
): ComputedRef<T> => {
  const { referenceStore } = useDecisionGraphRaw();
  return computed(() => selector(referenceStore));
};

export const useDecisionGraphActions = (): DecisionGraphStoreType['actions'] => useDecisionGraphRaw().actions;

export const useNodeDiff = (id: string) => {
  // PORTING: returns ComputedRefs of the selected slices (upstream returns
  // plain values from a single useContext selector); the selector stays literal.
  const selected = useDecisionGraphState((s) => {
    const node = (s?.decisionGraph?.nodes ?? []).find((node) => node.id === id);

    return {
      diff: node?._diff,
      contentDiff: node?.content?._diff,
    };
  });
  return {
    diff: computed(() => selected.value.diff),
    contentDiff: computed(() => selected.value.contentDiff),
  };
};

export const useEdgeDiff = (id: string) => {
  const selected = useDecisionGraphState((s) => {
    const edge = (s?.decisionGraph?.edges ?? []).find((edge) => edge.id === id);

    return {
      diff: edge?._diff,
    };
  });
  return {
    diff: computed(() => selected.value.diff),
  };
};
