import { describe, expect, it, vi } from 'vitest';

import { createGraphWalker } from '../../helpers/traversal';
import { type DecisionGraphStoreType } from './context/dg-store.context';
import {
  globalTypesStateDigest,
  inferNodeTypes,
  inferTypesNeedsUpdate,
  inferTypesStateDigest,
  variableTypeHash,
} from './dg-infer';
import type { DecisionGraphType } from './dg-types';
import { NodeKind } from './nodes/specifications/specification-types';

// @vitest-environment jsdom
// Logic-core coverage for the decision-graph type inference (PORTING.md's
// testing rule): the digests that decide when a re-inference is needed and
// the inference itself.
//
// The zen engine runs in WebAssembly and is not initialised in jsdom, so
// VariableType is mocked with the surface the inference uses.
vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {
    constructor(public json: any = { Object: {} }) {}

    static fromJson(json: any) {
      return new VariableType(json);
    }

    static fromIncoming(types: any[]) {
      return new VariableType({ Incoming: types.length });
    }

    clone() {
      return new VariableType(this.json);
    }

    calculateType(_field: string) {
      return new VariableType({ String: {} });
    }

    arrayItem() {
      return new VariableType({ Array: { item: this.json } });
    }

    toArray() {
      return new VariableType({ Array: { item: this.json } });
    }

    merge(other: VariableType) {
      return new VariableType({ Merged: [this.json, other.json] });
    }

    set(key: string, value: VariableType) {
      this.json = { ...this.json, [key]: value.json };
      return this;
    }

    equal(other: VariableType) {
      return JSON.stringify(this.json) === JSON.stringify(other.json);
    }

    hash() {
      return JSON.stringify(this.json);
    }
  }

  return { VariableType };
});

const expressionContent = {
  expressions: [],
  passThrough: false,
  inputField: null,
  outputPath: null,
  executionMode: 'single' as const,
};

const graph: DecisionGraphType = {
  nodes: [
    { id: 'in-1', name: 'Request', type: NodeKind.Input, position: { x: 0, y: 0 } },
    {
      id: 'expr-1',
      name: 'Expr',
      type: NodeKind.Expression,
      position: { x: 0, y: 0 },
      content: expressionContent,
    },
  ],
  edges: [{ id: 'e-1', sourceId: 'in-1', targetId: 'expr-1' }],
};

const state = (overrides: Partial<DecisionGraphStoreType['state']> = {}): DecisionGraphStoreType['state'] =>
  ({
    decisionGraph: graph,
    nodeTypes: {},
    customNodes: [],
    ...overrides,
  }) as unknown as DecisionGraphStoreType['state'];

describe('variableTypeHash', () => {
  it('returns undefined for a missing type', () => {
    expect(variableTypeHash(undefined)).toBeUndefined();
  });

  it('returns a stable hash for the same type', () => {
    const a = variableTypeHash({ hash: () => 'h' } as never);
    const b = variableTypeHash({ hash: () => 'h' } as never);

    expect(a).toBe('h');
    expect(b).toBe('h');
  });

  it('caches the hash on the instance', () => {
    const type = { hash: () => 'h', __hash: undefined as string | undefined };
    variableTypeHash(type as never);

    expect(type.__hash).toBe('h');
  });
});

describe('inferTypesStateDigest', () => {
  it('digests the edges, the node ids/types and the custom node kinds', () => {
    const digest = inferTypesStateDigest(state());

    expect(digest.nodesData).toEqual([
      { id: 'in-1', type: NodeKind.Input },
      { id: 'expr-1', type: NodeKind.Expression },
    ]);
    expect(digest.edgesData).toHaveLength(1);
    expect(digest.customNodesData).toEqual([]);
  });

  it('changes when the graph changes', () => {
    const before = inferTypesStateDigest(state());
    const after = inferTypesStateDigest(state({ decisionGraph: { ...graph, edges: [] } }));

    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  });
});

describe('inferTypesNeedsUpdate', () => {
  it('is false when nothing changed', () => {
    expect(inferTypesNeedsUpdate(state(), state())).toBe(false);
  });

  it('is true when a node with inferTypes changed its content', () => {
    const changed = state({
      decisionGraph: {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === 'expr-1' ? { ...node, content: { ...expressionContent, outputPath: 'risk' } } : node,
        ),
      },
    });

    expect(inferTypesNeedsUpdate(changed, state())).toBe(true);
  });
});

describe('inferNodeTypes', () => {
  it("infers nothing, because upstream's `return` aborts the walk on the input node", () => {
    // upstream quirk, kept 1:1 (ADR-0002): the walk yields the input node
    // first and the `return` leaves the immer recipe, so no downstream node
    // is ever reached. The port keeps upstream's behaviour; changing it to
    // `continue` would be a behaviour change and needs an explicit decision.
    const result = inferNodeTypes(state(), state(), createGraphWalker());

    expect(result.isModified).toBe(false);
    expect(result.nodeTypes).toEqual({});
  });

  it('leaves the input node alone', () => {
    const result = inferNodeTypes(state(), state(), createGraphWalker());

    expect(result.nodeTypes['in-1']).toBeUndefined();
  });

  it('does not modify anything when there is nothing to walk', () => {
    const empty = state({ decisionGraph: { nodes: [], edges: [] } });
    const result = inferNodeTypes(empty, empty, createGraphWalker());

    expect(result.isModified).toBe(false);
    expect(result.nodeTypes).toEqual({});
  });
});

describe('globalTypesStateDigest', () => {
  it('digests the node names and their output types', () => {
    const digest = globalTypesStateDigest(state());

    expect(digest.nodeInfo.map((info) => [info.id, info.name])).toEqual([
      ['in-1', 'Request'],
      ['expr-1', 'Expr'],
    ]);
  });
});
