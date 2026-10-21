// @vitest-environment jsdom
// Regression coverage for the defects the pre-ship review found in the
// canvas and the theme (docs/PORTING.md's Known temp debt is the ledger for
// what is still open).
//
// Every test here pins a fix that a gate did NOT catch: the edges never
// rendered, every graph edit remounted every node, the portalled overlays
// resolved no design tokens, and a tooltip could never open.
import { mount } from '@vue/test-utils';
import { ConfigProvider as RekaConfigProvider, TooltipRoot } from 'reka-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import JdmConfigProvider from '../../theme/JdmConfigProvider.vue';
import Tooltip from '../ui/Tooltip.vue';
import type { DecisionGraphType } from './dg-types';
import DecisionGraph from './dg.vue';

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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const graphWithEdge = (): DecisionGraphType => ({
  nodes: [
    { id: 'in-1', name: 'Input 1', type: 'inputNode', position: { x: 0, y: 0 } },
    { id: 'out-1', name: 'Output 1', type: 'outputNode', position: { x: 240, y: 0 } },
  ],
  edges: [{ id: 'e-1', sourceId: 'in-1', targetId: 'out-1' }],
});

const mountGraph = async (seed: DecisionGraphType) => {
  const modelValue = ref<DecisionGraphType>(seed);

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

  return { wrapper, modelValue };
};

describe('canvas regressions', () => {
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

  it('renders an edge', async () => {
    // vue-flow validates EVERY edge it syncs, so upstream's validator —
    // which rejects an edge that duplicates an existing one — rejected each
    // edge against itself and dropped it with EDGE_INVALID. Nothing was
    // ever drawn.
    const { wrapper } = await mountGraph(graphWithEdge());

    expect(wrapper.findAll('.vue-flow__edge').length).toBe(1);

    wrapper.unmount();
  });

  it('keeps the node type map stable when the graph changes', async () => {
    // The map is rebuilt whenever the selector that produced it was
    // invalidated, and vue-flow remounts a node when its component function
    // changes identity — the inline condition editor died after one
    // keystroke.
    const { wrapper, modelValue } = await mountGraph(graphWithEdge());

    // the node's INNER component (the specification's node) — a remount
    // replaces it while the wrapper element survives
    const before = wrapper.findAll('.grl-graph-node').map((n) => n.element);
    expect(before.length).toBe(2);

    modelValue.value = {
      ...modelValue.value,
      nodes: [
        ...modelValue.value.nodes,
        { id: 'in-2', name: 'Input 2', type: 'inputNode', position: { x: 0, y: 120 } },
      ],
    };
    await nextTick();
    await nextTick();

    const after = wrapper.findAll('.grl-graph-node').map((n) => n.element);
    expect(after.length).toBe(3);
    // the two original nodes were patched, not re-created
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);

    wrapper.unmount();
  });
});

describe('theme regressions', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('portals the overlays inside .grl-root so the tokens resolve', async () => {
    // Reka teleports every overlay to `body` by default, and the design
    // tokens live on `.grl-root` — so a portalled overlay resolved no
    // var(--grl-*) at all: no background, no border, no dark mode.
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(JdmConfigProvider, {}, { default: () => h(Tooltip, { content: 'hi' }, { default: () => 'x' }) });
        },
      }),
      { attachTo: document.body },
    );
    await nextTick();
    await nextTick();

    const root = wrapper.find('.grl-root');
    expect(root.exists()).toBe(true);

    // reka's ConfigProvider is told to portal INTO the provider's root, so
    // every overlay keeps the tokens (and the dark-mode rules) in scope
    const configProvider = wrapper.findComponent(RekaConfigProvider);
    expect(configProvider.exists()).toBe(true);
    expect(configProvider.props('teleportTo')).toBe(root.element);

    wrapper.unmount();
  });

  it('leaves a tooltip uncontrolled when no open prop is passed', async () => {
    // Vue casts an absent Boolean prop to false, and the port bound
    // `:open="open"` unconditionally — which made reka's TooltipRoot
    // controlled-and-closed. A tooltip without an explicit `open` could
    // never open.
    const wrapper = mount(Tooltip, { props: { content: 'hi' }, slots: { default: '<span>x</span>' } });

    expect(wrapper.findComponent(TooltipRoot).props('open')).toBeUndefined();

    wrapper.unmount();
  });

  it('keeps a tooltip controlled when open is passed explicitly', async () => {
    const wrapper = mount(Tooltip, { props: { content: 'hi', open: false }, slots: { default: '<span>x</span>' } });

    expect(wrapper.findComponent(TooltipRoot).props('open')).toBe(false);

    wrapper.unmount();
  });
});
