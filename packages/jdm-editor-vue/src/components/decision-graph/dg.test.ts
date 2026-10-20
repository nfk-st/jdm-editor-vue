// @vitest-environment jsdom
// Smoke coverage for the decision-graph module's public surface
// (PORTING.md testing rule): the public DecisionGraph mounts through its
// real providers, the renderless empty-controller seeds the store from
// `modelValue`, and the exposed ref surface reaches the store actions.
//
// The store's own reducers are covered by context/dg-store.test.ts and the
// node layer by nodes/specifications/specifications.test.ts.
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import type { DecisionGraphType } from './dg-types';
import DecisionGraph from './dg.vue';

// vitest's jsdom environment ships a non-functional localStorage global
// (graph/graph-tabs.test.ts precedent) — the store's initial compactMode
// reads it. Re-stubbed per test because afterEach un-stubs every global.
const localStorageBacking: Record<string, string> = {};
const stubLocalStorage = () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => localStorageBacking[key] ?? null,
    setItem: (key: string, value: string) => {
      localStorageBacking[key] = String(value);
    },
    removeItem: (key: string) => {
      delete localStorageBacking[key];
    },
  });
};

describe('DecisionGraph (smoke)', () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const seed = (): DecisionGraphType => ({
    nodes: [
      { id: 'in-1', name: 'Input 1', type: 'inputNode', position: { x: 0, y: 0 } },
      { id: 'out-1', name: 'Output 1', type: 'outputNode', position: { x: 240, y: 0 } },
    ],
    edges: [],
  });

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    stubLocalStorage();
  });

  afterEach(() => {
    for (const key of Object.keys(localStorageBacking)) {
      delete localStorageBacking[key];
    }
    vi.unstubAllGlobals();
  });

  it('mounts the canvas chrome through the real providers', async () => {
    const modelValue = ref<DecisionGraphType>(seed());

    const wrapper = mount(
      defineComponent({
        name: 'DecisionGraphHarness',
        setup() {
          return () =>
            h(DecisionGraph, {
              'modelValue': modelValue.value,
              'onUpdate:modelValue': (v: DecisionGraphType) => {
                modelValue.value = v;
              },
            });
        },
      }),
      { attachTo: document.body },
    );
    await nextTick();
    await nextTick();

    // the public component's chrome is on the page
    expect(wrapper.find('.grl-dg').exists()).toBe(true);
    // the graph region (canvas + tabs + side toolbar) is mounted
    expect(wrapper.find('.grl-dg__graph').exists()).toBe(true);
    // the vue-flow canvas itself rendered
    expect(wrapper.find('.vue-flow').exists()).toBe(true);
    // both seeded nodes are on the canvas
    expect(wrapper.findAll('.vue-flow__node').length).toBe(2);

    wrapper.unmount();
  });

  it('seeds the store from modelValue through the empty-state controller', async () => {
    const modelValue = ref<DecisionGraphType>(seed());

    const wrapper = mount(
      defineComponent({
        name: 'DecisionGraphHarness',
        setup() {
          return () =>
            h(DecisionGraph, {
              'modelValue': modelValue.value,
              'onUpdate:modelValue': (v: DecisionGraphType) => {
                modelValue.value = v;
              },
            });
        },
      }),
      { attachTo: document.body },
    );
    await nextTick();
    await nextTick();

    const graph = wrapper.findComponent(DecisionGraph).vm as unknown as {
      stateStore: { getState: () => { decisionGraph: DecisionGraphType } };
    };

    // upstream's `DecisionGraphEmpty` controller pushes modelValue into the
    // store on mount (dg-empty.vue's onMounted → setDecisionGraph)
    expect(graph.stateStore.getState().decisionGraph.nodes.map((n) => n.id)).toEqual(['in-1', 'out-1']);

    wrapper.unmount();
  });

  it('exposes the store action surface through the public ref', async () => {
    const modelValue = ref<DecisionGraphType>(seed());

    const wrapper = mount(
      defineComponent({
        name: 'DecisionGraphHarness',
        setup() {
          return () =>
            h(DecisionGraph, {
              'modelValue': modelValue.value,
              'onUpdate:modelValue': (v: DecisionGraphType) => {
                modelValue.value = v;
              },
            });
        },
      }),
      { attachTo: document.body },
    );
    await nextTick();
    await nextTick();

    const graph = wrapper.findComponent(DecisionGraph).vm as unknown as {
      stateStore: { getState: () => { decisionGraph: DecisionGraphType } };
      addNodes: (nodes: DecisionGraphType['nodes']) => void;
      serialize: () => Record<string, unknown>;
    };

    // the ref surface is upstream's GraphRef — the store actions plus
    // stateStore / serialize / restore (upstream has no `addNode`; the
    // singular add lives inside the canvas, upstream graph.tsx's
    // addNodeInner)
    expect(typeof graph.addNodes).toBe('function');
    expect(typeof graph.serialize).toBe('function');

    // upstream's store drops a second input node (the graph already has one),
    // so the added node is an expression
    graph.addNodes([{ id: 'expr-1', name: 'Expression 1', type: 'expressionNode', position: { x: 0, y: 200 } }]);

    expect(graph.stateStore.getState().decisionGraph.nodes.map((n) => n.id)).toContain('expr-1');

    wrapper.unmount();
  });
});
