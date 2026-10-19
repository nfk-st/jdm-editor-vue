// @vitest-environment jsdom
// Logic-core coverage for the decision-graph store (PORTING.md testing
// rule): the pure reducer-ish actions — node/edge mutations, tab
// management, setDecisionGraph semantics, type registration. The vue-flow
// facing triples are stubbed the way graph will wire them (upstream
// graph.tsx:113-116): [nodes, setNodes, onNodesChange].
import type { Edge, Node, NodeChange, VueFlowStore } from '@vue-flow/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type DecisionGraphType, privateSymbol } from '../dg-types';
import { NodeKind } from '../nodes/specifications/specification-types';
import { type DecisionGraphStoreBundle, createDecisionGraphStoreBundle } from './dg-store.context';

// vitest's jsdom environment ships a non-functional localStorage global
// (empty object, no Storage prototype) — stub it: the store's initial
// compactMode reads it (table.test.ts precedent).
const localStorageBacking: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageBacking[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageBacking[key] = String(value);
  },
  removeItem: (key: string) => {
    delete localStorageBacking[key];
  },
  clear: () => {
    for (const key of Object.keys(localStorageBacking)) {
      delete localStorageBacking[key];
    }
  },
});

afterEach(() => {
  for (const key of Object.keys(localStorageBacking)) {
    delete localStorageBacking[key];
  }
});

const dnode = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  position: { x: 0, y: 0 },
  ...extra,
});
const dedge = (id: string, sourceId: string, targetId: string, extra: Record<string, unknown> = {}) => ({
  id,
  sourceId,
  targetId,
  ...extra,
});

// Wires the reference store's vue-flow triples the way graph does: the
// arrays mutate in place so the captured triple[0] stays live, and the
// setters/fns are spies for assertability.
const wireGraphStub = (bundle: DecisionGraphStoreBundle) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const onNodesChange = vi.fn();
  const onEdgesChange = vi.fn();
  const setNodes = vi.fn((next: Node[] | ((prev: Node[]) => Node[])) => {
    const value = typeof next === 'function' ? next(nodes) : next;
    nodes.splice(0, nodes.length, ...value);
  });
  const setEdges = vi.fn((next: Edge[] | ((prev: Edge[]) => Edge[])) => {
    const value = typeof next === 'function' ? next(edges) : next;
    edges.splice(0, edges.length, ...value);
  });

  bundle.referenceStore.setState({
    nodesState: { current: [nodes, setNodes, onNodesChange] },
    edgesState: { current: [edges, setEdges, onEdgesChange] },
  });

  return { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange };
};

const makeStore = (graph?: Partial<DecisionGraphType>) => {
  const bundle = createDecisionGraphStoreBundle();
  const stub = wireGraphStub(bundle);
  if (graph) {
    bundle.actions.setDecisionGraph(graph, { skipOnChangeEvent: true });
  }
  return { bundle, stub };
};

const seedGraph = (): DecisionGraphType => ({
  nodes: [
    dnode('input', { type: NodeKind.Input }),
    dnode('table', { type: NodeKind.DecisionTable, content: { kind: 'table' } }),
    dnode('func', { type: NodeKind.Function, description: 'a function' }),
  ],
  edges: [dedge('e1', 'input', 'table'), dedge('e2', 'table', 'func', { sourceHandle: 'out-1' })],
});

describe('decision-graph store: setDecisionGraph', () => {
  it('seeds state, syncs the vue-flow triples and fires onChange', () => {
    const { bundle, stub } = makeStore();
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    bundle.actions.setDecisionGraph(seedGraph());

    const { decisionGraph } = bundle.stateStore.getState();
    expect(decisionGraph.nodes.map((n) => n.id)).toEqual(['input', 'table', 'func']);
    expect(decisionGraph.edges).toHaveLength(2);
    // tuples got the vue-flow projection (mapToGraphNodes/Edges)
    expect(stub.nodes.map((n) => n.id)).toEqual(['input', 'table', 'func']);
    expect(stub.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(decisionGraph);
  });

  it('skipOnChangeEvent updates state and tuples without onChange', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    bundle.actions.setDecisionGraph({ nodes: [dnode('solo')] }, { skipOnChangeEvent: true });

    expect(bundle.stateStore.getState().decisionGraph.nodes).toHaveLength(1);
    // Object.assign merge: edges survive a nodes-only update
    expect(bundle.stateStore.getState().decisionGraph.edges).toHaveLength(2);
    expect(stub.nodes.map((n) => n.id)).toEqual(['solo']);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('decision-graph store: node mutations', () => {
  it('addNodes appends to the graph and the tuple', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    bundle.actions.addNodes([dnode('extra', { type: NodeKind.Expression })]);

    const { decisionGraph } = bundle.stateStore.getState();
    expect(decisionGraph.nodes.map((n) => n.id)).toEqual(['input', 'table', 'func', 'extra']);
    expect(stub.nodes.map((n) => n.id)).toEqual(['input', 'table', 'func', 'extra']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('addNodes drops Input nodes when an input node already exists', () => {
    const { bundle, stub } = makeStore(seedGraph()); // has type 'inputNode'

    bundle.actions.addNodes([dnode('input2', { type: NodeKind.Input }), dnode('expr', { type: NodeKind.Expression })]);

    const { decisionGraph } = bundle.stateStore.getState();
    expect(decisionGraph.nodes.map((n) => n.id)).toEqual(['input', 'table', 'func', 'expr']);
    expect(stub.nodes.map((n) => n.id)).toEqual(['input', 'table', 'func', 'expr']);
  });

  it('removeNodes drops the nodes, their edges and their registered types', () => {
    const { bundle } = makeStore(seedGraph());
    bundle.stateStore.setState({
      nodeTypes: { table: { 0: { type: 'Any' } as never }, func: { 0: { type: 'Any' } as never } },
    });

    bundle.actions.removeNodes(['table']);

    const { decisionGraph, nodeTypes } = bundle.stateStore.getState();
    expect(decisionGraph.nodes.map((n) => n.id)).toEqual(['input', 'func']);
    // e1 (target table) and e2 (source table) both cascade away
    expect(decisionGraph.edges).toHaveLength(0);
    expect('table' in nodeTypes).toBe(false);
    expect('func' in nodeTypes).toBe(true);
  });

  it('removeNodes also drops edges connected by handle id', () => {
    const { bundle } = makeStore({
      nodes: [dnode('a'), dnode('b'), dnode('c')],
      edges: [dedge('e1', 'a', 'b'), dedge('e2', 'c', 'b', { sourceHandle: 'a-out' })],
    });

    // upstream quirks kept: ids matching sourceHandle/targetHandle count too
    bundle.actions.removeNodes(['a-out']);

    expect(bundle.stateStore.getState().decisionGraph.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('updateNode applies the draft updater and refreshes the tuple node', () => {
    const { bundle, stub } = makeStore(seedGraph());

    bundle.actions.updateNode('table', (draft) => {
      draft.name = 'renamed';
      return draft;
    });

    expect(bundle.stateStore.getState().decisionGraph.nodes[1].name).toBe('renamed');
    expect(stub.nodes[1].data?.name).toBe('renamed');
  });

  it('updateNode with an unchanged graph projection skips the tuple write', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });
    stub.setNodes.mockClear();

    // description isn't part of mapToGraphNode's projection
    bundle.actions.updateNode('func', (draft) => {
      draft.description = 'changed';
      return draft;
    });

    expect(bundle.stateStore.getState().decisionGraph.nodes[2].description).toBe('changed');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(stub.setNodes).not.toHaveBeenCalled();
  });

  it('updateNode on a missing id is a full no-op', () => {
    const { bundle } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    bundle.actions.updateNode('ghost', (draft) => draft);

    expect(onChange).not.toHaveBeenCalled();
    expect(bundle.stateStore.getState().decisionGraph.nodes).toHaveLength(3);
  });

  it('duplicateNodes clones nodes (+140y) and remaps internal edges', () => {
    const { bundle, stub } = makeStore(seedGraph());

    bundle.actions.duplicateNodes(['table', 'func']);

    const { decisionGraph } = bundle.stateStore.getState();
    expect(decisionGraph.nodes).toHaveLength(5);
    const dupTable = decisionGraph.nodes[3];
    const dupFunc = decisionGraph.nodes[4];
    expect(dupTable.id).not.toBe('table');
    expect(dupTable.name).toBe('table');
    expect(dupTable.position).toEqual({ x: 0, y: 140 });
    expect(dupFunc.position).toEqual({ x: 0, y: 140 });
    // e2 (table→func) is cloned between the new ids; e1 (input→table) is not
    expect(decisionGraph.edges).toHaveLength(3);
    const cloned = decisionGraph.edges[2];
    expect(cloned.sourceId).toBe(dupTable.id);
    expect(cloned.targetId).toBe(dupFunc.id);
    expect(cloned.sourceHandle).toBe('out-1');
    expect(stub.nodes).toHaveLength(5);
    expect(stub.edges).toHaveLength(3);
  });

  it('duplicateNodes skips Input nodes and no-ops on empty selections', () => {
    const { bundle } = makeStore(seedGraph());

    bundle.actions.duplicateNodes(['input']);
    expect(bundle.stateStore.getState().decisionGraph.nodes).toHaveLength(3);

    bundle.actions.duplicateNodes([]);
    expect(bundle.stateStore.getState().decisionGraph.nodes).toHaveLength(3);
  });

  it('copyNodes delegates to the graph clipboard; pasteNodes delegates back', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const copyNodes = vi.fn();
    const pasteNodes = vi.fn();
    bundle.referenceStore.setState({ graphClipboard: { current: { copyNodes, pasteNodes } } });

    bundle.actions.copyNodes(['table', 'func']);
    expect(copyNodes).toHaveBeenCalledTimes(1);
    expect(copyNodes.mock.calls[0][0].map((n: Node) => n.id)).toEqual(['table', 'func']);

    bundle.actions.pasteNodes();
    expect(pasteNodes).toHaveBeenCalledTimes(1);

    // unset clipboard slots are no-ops (upstream null-guard parity)
    bundle.referenceStore.setState({ graphClipboard: { current: null } });
    expect(() => bundle.actions.pasteNodes()).not.toThrow();
    expect(() => bundle.actions.copyNodes(['table'])).not.toThrow();
    expect(stub.nodes).toHaveLength(3);
  });
});

describe('decision-graph store: edge mutations', () => {
  it('addEdges appends; removeEdges filters by id', () => {
    const { bundle } = makeStore(seedGraph());

    bundle.actions.addEdges([dedge('e3', 'input', 'func')]);
    expect(bundle.stateStore.getState().decisionGraph.edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);

    bundle.actions.removeEdges(['e1', 'e3']);
    expect(bundle.stateStore.getState().decisionGraph.edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('removeEdgeByHandleId drops only edges with that source handle', () => {
    const { bundle } = makeStore(seedGraph());

    bundle.actions.removeEdgeByHandleId('out-1');
    expect(bundle.stateStore.getState().decisionGraph.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('setEdges replaces wholesale; setHoveredEdgeId sets state only', () => {
    const { bundle } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    bundle.actions.setEdges([dedge('only', 'input', 'func')]);
    expect(bundle.stateStore.getState().decisionGraph.edges.map((e) => e.id)).toEqual(['only']);

    bundle.actions.setHoveredEdgeId('only');
    expect(bundle.stateStore.getState().hoveredEdgeId).toBe('only');
    expect(onChange).toHaveBeenCalledTimes(1); // setHoveredEdgeId never fires it
  });
});

describe('decision-graph store: change handlers', () => {
  it('handleNodesChange mirrors position changes into the graph and forwards to vue-flow', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    const changes: NodeChange[] = [
      { type: 'position', id: 'table', position: { x: 40, y: 60 }, from: { x: 0, y: 0 }, dragging: true },
    ];
    bundle.actions.handleNodesChange(changes);

    expect(stub.onNodesChange).toHaveBeenCalledWith(changes);
    const table = bundle.stateStore.getState().decisionGraph.nodes.find((n) => n.id === 'table');
    expect(table?.position).toEqual({ x: 40, y: 60 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('handleNodesChange records dimensions and selection under the private symbol', () => {
    const { bundle } = makeStore(seedGraph());

    bundle.actions.handleNodesChange([{ type: 'dimensions', id: 'table', dimensions: { width: 320, height: 90 } }]);
    bundle.actions.handleNodesChange([{ type: 'select', id: 'table', selected: true }]);

    const table = bundle.stateStore.getState().decisionGraph.nodes.find((n) => n.id === 'table');
    expect(table?.[privateSymbol]?.dimensions).toEqual({ height: 90, width: 320 });
    expect(table?.[privateSymbol]?.selected).toBe(true);
  });

  it('handleNodesChange with no effective change forwards but stays silent', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    // same position as seeded + an unmirrored remove change
    bundle.actions.handleNodesChange([
      { type: 'position', id: 'table', position: { x: 0, y: 0 }, from: { x: 0, y: 0 } },
      { type: 'remove', id: 'table' },
    ]);

    expect(stub.onNodesChange).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(bundle.stateStore.getState().decisionGraph.nodes).toHaveLength(3);
  });

  it('handleEdgesChange only mirrors removals', () => {
    const { bundle, stub } = makeStore(seedGraph());
    const onChange = vi.fn();
    bundle.listenerStore.setState({ onChange });

    bundle.actions.handleEdgesChange([{ type: 'select', id: 'e1', selected: true }]);
    expect(stub.onEdgesChange).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    bundle.actions.handleEdgesChange([
      { type: 'remove', id: 'e1', source: 'input', target: 'table', sourceHandle: null, targetHandle: null },
    ]);
    expect(bundle.stateStore.getState().decisionGraph.edges.map((e) => e.id)).toEqual(['e2']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('decision-graph store: tabs', () => {
  it('openTab activates graph without touching openTabs', () => {
    const { bundle } = makeStore();
    bundle.actions.openTab('n1');
    bundle.actions.openTab('graph');

    expect(bundle.stateStore.getState().openTabs).toEqual(['n1']);
    expect(bundle.stateStore.getState().activeTab).toBe('graph');
  });

  it('openTab appends unknown ids and re-activates known ones', () => {
    const { bundle } = makeStore();

    bundle.actions.openTab('n1');
    bundle.actions.openTab('n2');
    expect(bundle.stateStore.getState().openTabs).toEqual(['n1', 'n2']);
    expect(bundle.stateStore.getState().activeTab).toBe('n2');

    bundle.actions.openTab('n1');
    expect(bundle.stateStore.getState().openTabs).toEqual(['n1', 'n2']);
    expect(bundle.stateStore.getState().activeTab).toBe('n1');
  });

  it.each([
    // closing n2 of [n1,n2,n3] with n3 active; n3 survives unless removed
    [undefined, ['n1', 'n3'], 'n3'],
    ['close', ['n1', 'n3'], 'n3'],
    ['close-all', [], 'graph'],
    ['close-other', ['n2'], 'n2'], // n3 gone → active falls back to index-1 = n2
    ['close-right', ['n1', 'n2'], 'n1'], // n3 gone → fallback to index-1 = n1
    ['close-left', ['n2', 'n3'], 'n3'], // n3 survives
  ] as const)('closeTab(%p) on [n1,n2,n3] with n3 active', (action, expectedTabs, expectedActive) => {
    const { bundle } = makeStore();
    ['n1', 'n2', 'n3'].forEach((id) => bundle.actions.openTab(id));

    bundle.actions.closeTab('n2', action);

    expect(bundle.stateStore.getState().openTabs).toEqual(expectedTabs);
    expect(bundle.stateStore.getState().activeTab).toBe(expectedActive);
  });

  it('closeTab keeps the active tab when it survives', () => {
    const { bundle } = makeStore();
    ['n1', 'n2'].forEach((id) => bundle.actions.openTab(id));

    bundle.actions.closeTab('n1');

    expect(bundle.stateStore.getState().openTabs).toEqual(['n2']);
    expect(bundle.stateStore.getState().activeTab).toBe('n2');
  });

  it('closing the last open tab falls back to graph', () => {
    const { bundle } = makeStore();
    bundle.actions.openTab('n1');
    bundle.actions.openTab('n2');

    bundle.actions.closeTab('n1');
    bundle.actions.closeTab('n2');

    expect(bundle.stateStore.getState().openTabs).toEqual([]);
    expect(bundle.stateStore.getState().activeTab).toBe('graph');
  });
});

describe('decision-graph store: node types & selection', () => {
  it('setNodeType upserts and removeNodeType clears by kind or whole id', () => {
    const { bundle } = makeStore();
    const vt = { type: 'Any' } as never;

    bundle.actions.setNodeType('n1', 0, vt);
    bundle.actions.setNodeType('n1', 1, vt);
    expect(bundle.stateStore.getState().nodeTypes.n1).toEqual({ 0: vt, 1: vt });

    bundle.actions.removeNodeType('n1', 1);
    expect(bundle.stateStore.getState().nodeTypes.n1).toEqual({ 0: vt });

    bundle.actions.removeNodeType('n1');
    expect('n1' in bundle.stateStore.getState().nodeTypes).toBe(false);
  });

  it('removeNodeType with kind Input (0) drops the whole entry — upstream quirk kept', () => {
    // upstream guards `if (kind)`; NodeTypeKind.Input === 0 is falsy, so a
    // by-kind removal of Input deletes the node's entire type record
    const { bundle } = makeStore();
    const vt = { type: 'Any' } as never;

    bundle.actions.setNodeType('n1', 0, vt);
    bundle.actions.setNodeType('n1', 1, vt);
    bundle.actions.removeNodeType('n1', 0);

    expect('n1' in bundle.stateStore.getState().nodeTypes).toBe(false);
  });

  it('triggerNodeSelect toggles one node and only-mode deselects everything else', () => {
    const { bundle, stub } = makeStore(seedGraph());

    bundle.actions.triggerNodeSelect('table', 'toggle');
    let table = bundle.stateStore.getState().decisionGraph.nodes.find((n) => n.id === 'table');
    expect(table?.[privateSymbol]?.selected).toBe(true);

    bundle.actions.triggerNodeSelect('table', 'toggle');
    table = bundle.stateStore.getState().decisionGraph.nodes.find((n) => n.id === 'table');
    expect(table?.[privateSymbol]?.selected).toBe(false);

    stub.setEdges.mockClear();
    bundle.actions.triggerNodeSelect('func', 'only');
    // only-mode rewrites the whole tuple projection and deselects all edges
    expect(stub.setEdges).toHaveBeenCalledTimes(1);
    expect((stub.nodes.find((n) => n.id === 'func') as { selected?: boolean } | undefined)?.selected).toBe(true);
    expect((stub.nodes.find((n) => n.id === 'table') as { selected?: boolean } | undefined)?.selected).toBeFalsy();
    expect(stub.edges.every((e) => (e as { selected?: boolean }).selected !== true)).toBe(true);
  });
});

describe('decision-graph store: goToNode (vue-flow instance adaptation)', () => {
  const wireInstance = (bundle: DecisionGraphStoreBundle, ids: string[]) => {
    const fitView = vi.fn();
    const byId = new Map(ids.map((id) => [id, { id }]));
    bundle.referenceStore.setState({
      reactFlowInstance: {
        current: {
          // vue-flow instance: findNode is a plain action, fitView comes
          // from the ViewportHelper surface
          findNode: (id: string) => byId.get(id),
          fitView,
        } as unknown as VueFlowStore,
      },
    });
    return fitView;
  };

  it('fits the view on the node when the graph tab is active', () => {
    const { bundle } = makeStore();
    const fitView = wireInstance(bundle, ['n1']);

    bundle.actions.goToNode('n1');
    expect(fitView).toHaveBeenCalledWith({ nodes: ['n1'], duration: 1_000, maxZoom: 1.25 });
  });

  it('stays silent for unknown nodes and non-graph tabs', () => {
    const { bundle } = makeStore();
    const fitView = wireInstance(bundle, ['n1']);

    bundle.actions.goToNode('ghost');
    expect(fitView).not.toHaveBeenCalled();

    bundle.actions.openTab('n1');
    bundle.actions.goToNode('n1');
    expect(fitView).not.toHaveBeenCalled();
  });
});

describe('decision-graph store: panels & compact mode', () => {
  it('setActivePanel resolves against known panels and notifies listeners', () => {
    const { bundle } = makeStore();
    const onPanelsChange = vi.fn();
    bundle.stateStore.setState({
      panels: [{ id: 'simulator', icon: null as never, title: 'Simulator' }],
    });
    bundle.listenerStore.setState({ onPanelsChange });

    bundle.actions.setActivePanel('simulator');
    expect(bundle.stateStore.getState().activePanel).toBe('simulator');
    expect(onPanelsChange).toHaveBeenCalledWith('simulator');

    bundle.actions.setActivePanel('unknown');
    expect(bundle.stateStore.getState().activePanel).toBeUndefined();

    bundle.actions.setActivePanel(undefined);
    expect(bundle.stateStore.getState().activePanel).toBeUndefined();
  });

  it('compact mode round-trips through localStorage', () => {
    localStorageBacking['jdm-compact-mode'] = 'true';
    const { bundle } = makeStore();
    expect(bundle.stateStore.getState().compactMode).toBe(true);

    bundle.actions.setCompactMode(false);
    expect(bundle.stateStore.getState().compactMode).toBe(false);
    expect(localStorageBacking['jdm-compact-mode']).toBe('false');

    bundle.actions.toggleCompactMode();
    expect(bundle.stateStore.getState().compactMode).toBe(true);
    expect(localStorageBacking['jdm-compact-mode']).toBe('true');
  });
});
