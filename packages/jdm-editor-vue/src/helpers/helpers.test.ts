// Logic-core coverage for helpers/* (PORTING.md testing rule — module #2).
// Framework-agnostic helpers tested directly; composables under jsdom.
// @vitest-environment jsdom
import { effectScope, nextTick, ref, type Ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { composeRefs } from './compose-refs';
import { getPath, recursiveSelect } from './components';
import { omit } from './omit';
import {
  columnEnumSchema,
  columnFieldTypeSchema,
  CustomKind,
  DECISION_GRAPH_CONTENT_TYPE,
  NodeKind,
  outputFieldTypeSchema,
} from './schema';
import { createGraphWalker } from './traversal';
import { getTrace } from './trace';
import { platform } from './platform';
import { usePersistentState } from './use-persistent-state';
import { get as getPathValue } from './utility';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('traversal/createGraphWalker', () => {
  const graph = () => ({
    nodes: [
      { id: 'in', name: 'Request', type: 'inputNode', position: { x: 0, y: 0 } },
      { id: 'expr', name: 'Discount', type: 'expressionNode', position: { x: 1, y: 0 } },
      { id: 'out', name: 'Response', type: 'outputNode', position: { x: 2, y: 0 } },
    ],
    edges: [
      { id: 'e1', sourceId: 'in', targetId: 'expr' },
      { id: 'e2', sourceId: 'expr', targetId: 'out' },
    ],
  });

  it('walks the graph from the input node in dependency order', () => {
    const walker = createGraphWalker();
    const steps = [...walker.walk(graph())];
    expect(steps.map((s) => s.node.id)).toEqual(['in', 'expr', 'out']);
    expect(steps[0].incomers).toEqual([]);
    expect(steps[1].incomers.map((n) => n.id)).toEqual(['in']);
    expect(steps[2].incomers.map((n) => n.id)).toEqual(['expr']);
  });

  it('uses the cached path when nodes/edges are unchanged, reflecting node updates', () => {
    const walker = createGraphWalker();
    const first = [...walker.walk(graph())];
    const updated = graph();
    updated.nodes[1].name = 'Discount v2';
    const second = [...walker.walk(updated)];
    expect(second.map((s) => s.node.id)).toEqual(first.map((s) => s.node.id));
    expect(second[1].node.name).toBe('Discount v2');
  });

  it('rewalks when the structure changes', () => {
    const walker = createGraphWalker();
    [...walker.walk(graph())];
    const changed = graph();
    changed.edges = [{ id: 'e1', sourceId: 'in', targetId: 'out' }];
    const steps = [...walker.walk(changed)];
    expect(steps.map((s) => s.node.id)).toEqual(['in', 'out']);
  });

  it('yields nothing for a cyclic graph', () => {
    const walker = createGraphWalker();
    const cyclic = {
      nodes: graph().nodes.slice(0, 2),
      edges: [
        { id: 'e1', sourceId: 'in', targetId: 'expr' },
        { id: 'e2', sourceId: 'expr', targetId: 'in' },
      ],
    };
    expect([...walker.walk(cyclic)]).toEqual([]);
  });

  it('yields nothing without an input node', () => {
    const walker = createGraphWalker();
    const noInput = { nodes: graph().nodes.slice(1), edges: graph().edges };
    expect([...walker.walk(noInput)]).toEqual([]);
  });
});

describe('utility', () => {
  it('get resolves dotted paths', () => {
    expect(getPathValue({ a: { b: { c: 7 } } }, 'a.b.c', 0)).toBe(7);
  });

  it('get returns the default when the path breaks', () => {
    expect(getPathValue({ a: {} }, 'a.b.c', 'fallback')).toBe('fallback');
  });
});

describe('omit', () => {
  it('removes the listed keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, 'b', 'c')).toEqual({ a: 1 });
  });
});

describe('compose-refs', () => {
  it('updates both object refs', () => {
    const a = ref(null);
    const b = ref(null);
    const composed = composeRefs<HTMLDivElement>(a as Ref<HTMLDivElement | null>, b as Ref<HTMLDivElement | null>);
    (composed as (el: HTMLDivElement | null) => void)({} as HTMLDivElement);
    expect(a.value).toBeDefined();
    expect(b.value).toBeDefined();
  });

  it('calls function refs and caches compositions', () => {
    const a = ref(null);
    const fn = vi.fn();
    const first = composeRefs<HTMLDivElement>(a as Ref<HTMLDivElement | null>, fn);
    const second = composeRefs<HTMLDivElement>(a as Ref<HTMLDivElement | null>, fn);
    expect(first).toBe(second);
    (first as (el: HTMLDivElement | null) => void)({} as HTMLDivElement);
    expect(fn).toHaveBeenCalledWith(expect.anything());
  });

  it('passes through a single ref', () => {
    const fn = vi.fn();
    expect(composeRefs(undefined, fn)).toBe(fn);
  });
});

describe('trace', () => {
  it('selects the nth trace from an array', () => {
    expect(getTrace(['a', 'b', 'c'], 1)).toBe('b');
  });

  it('clamps out-of-range indices to the first element', () => {
    expect(getTrace(['a', 'b'], 9)).toBe('a');
    expect(getTrace(['a', 'b'], -1)).toBe('a');
  });

  it('passes single traces through', () => {
    expect(getTrace({ trace: 1 }, 0)).toEqual({ trace: 1 });
  });
});

describe('platform', () => {
  it('returns the shortcut unchanged off Mac', () => {
    expect(platform.shortcut('Ctrl+C')).toBe('Ctrl+C');
  });

  it('maps modifier keys on Mac (lazy navigator read)', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' });
    expect(platform.shortcut('Ctrl+Backspace')).toBe('⌘+⌫');
  });
});

describe('components (schema selectors)', () => {
  const items = [
    { field: 'a', items: [{ field: 'b' }, { field: 'c', items: [{ field: 'd' }] }] },
    { field: 'e' },
  ];

  it('recursiveSelect descends selectors', () => {
    expect(recursiveSelect(['a', 'c', 'd'], items)?.field).toBe('d');
    expect(recursiveSelect(['e'], items)?.field).toBe('e');
    expect(recursiveSelect(['a', 'missing'], items)).toBeUndefined();
  });

  it('getPath returns the field path to a key', () => {
    expect(getPath('d', items)).toEqual(['a', 'c', 'd']);
    expect(getPath('e', items)).toEqual(['e']);
    expect(getPath('nope', items)).toBeUndefined();
  });
});

describe('usePersistentState', () => {
  it('returns the tuple [state, setState] with default and memory-cache persistence', async () => {
    const scope = effectScope();
    const result = scope.run(() => usePersistentState('test-key-1', 'initial'))!;
    const [state, setState] = result;

    expect(state.value).toBe('initial');
    setState((prev) => `${prev}-updated`);
    expect(state.value).toBe('initial-updated');

    // the cache-writing watch flushes on the next tick (upstream: useEffect)
    await nextTick();

    const scope2 = effectScope();
    const [state2] = scope2.run(() => usePersistentState<string>('test-key-1'))!;
    expect(state2.value).toBe('initial-updated');
    scope.stop();
    scope2.stop();
  });
});

describe('schema', () => {
  it('exposes upstream constants and kinds', () => {
    expect(DECISION_GRAPH_CONTENT_TYPE).toBe('application/vnd.gorules.decision');
    expect(NodeKind.Input).toBe('inputNode');
    expect(NodeKind.Switch).toBe('switchNode');
    expect(CustomKind).toBe('customNode');
  });

  it('parses inline and ref column enums', () => {
    expect(columnEnumSchema.parse({ type: 'inline', values: [{ label: 'A', value: 'a' }] })).toEqual({
      type: 'inline',
      values: [{ label: 'A', value: 'a' }],
    });
    expect(columnEnumSchema.parse({ type: 'ref', ref: 'countries' })).toEqual({ type: 'ref', ref: 'countries' });
    expect(() => columnEnumSchema.parse({ type: 'nope' })).toThrow();
  });

  it('parses column and output field types', () => {
    expect(columnFieldTypeSchema.parse({ type: 'string', enum: { type: 'ref', ref: 'x' } })).toEqual({
      type: 'string',
      enum: { type: 'ref', ref: 'x' },
    });
    expect(outputFieldTypeSchema.parse({ type: 'string-array' })).toEqual({ type: 'string-array' });
  });
});
