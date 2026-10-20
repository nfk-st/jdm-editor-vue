// @vitest-environment jsdom
// Logic-core coverage for the graph tab bar (PORTING.md testing rule): the
// open-tab node derivation, the context-menu entries (upstream's exact
// guards, including the graph tab's index of -1), and a mount smoke of the
// tab bar against a wired store bundle.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { DecisionGraphProvider } from '../context/dg-store.context';
import type { DecisionGraphType } from '../dg-types';
import GraphTabs, { buildOpenTabNodes, buildTabContextItems } from './graph-tabs.vue';

// vitest's jsdom environment ships a non-functional localStorage global
// (dg-store.test.ts precedent) — the store's initial compactMode reads it.
const localStorageBacking: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageBacking[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageBacking[key] = String(value);
  },
  removeItem: (key: string) => {
    delete localStorageBacking[key];
  },
});

afterEach(() => {
  for (const key of Object.keys(localStorageBacking)) {
    delete localStorageBacking[key];
  }
});

describe('buildOpenTabNodes', () => {
  const decisionGraph: DecisionGraphType = {
    nodes: [
      { id: 'n1', name: 'First', type: 'expressionNode', position: { x: 0, y: 0 } },
      { id: 'n2', name: 'Second', type: 'functionNode', position: { x: 0, y: 0 } },
    ],
    edges: [],
  };

  it('maps the open tab ids to their nodes, keeping the openTabs order', () => {
    expect(buildOpenTabNodes(decisionGraph, ['n2', 'n1'])).toEqual([
      { id: 'n2', name: 'Second', type: 'functionNode', diff: undefined },
      { id: 'n1', name: 'First', type: 'expressionNode', diff: undefined },
    ]);
  });

  it('drops tab ids without a node', () => {
    expect(buildOpenTabNodes(decisionGraph, ['nope'])).toEqual([]);
  });

  it('tolerates a missing graph and missing tabs', () => {
    expect(buildOpenTabNodes(undefined, undefined)).toEqual([]);
    expect(buildOpenTabNodes(undefined, ['n1'])).toEqual([]);
  });

  it('carries the node diff status', () => {
    const graph: DecisionGraphType = {
      nodes: [
        {
          id: 'n1',
          name: 'First',
          type: 'expressionNode',
          position: { x: 0, y: 0 },
          _diff: { status: 'modified' },
        },
      ],
      edges: [],
    };

    expect(buildOpenTabNodes(graph, ['n1'])[0].diff).toEqual({ status: 'modified' });
  });
});

describe('buildTabContextItems', () => {
  it('offers every action on a middle tab', () => {
    expect(buildTabContextItems(3, 1).map((item) => item.key)).toEqual([
      'close',
      'close-all',
      'close-other',
      'close-right',
      'close-left',
    ]);
  });

  it('drops the right/left actions at the edges', () => {
    expect(buildTabContextItems(3, 0).map((item) => item.key)).toEqual([
      'close',
      'close-all',
      'close-other',
      'close-right',
    ]);
    expect(buildTabContextItems(3, 2).map((item) => item.key)).toEqual([
      'close',
      'close-all',
      'close-other',
      'close-left',
    ]);
  });

  it('keeps the graph tab (index -1) free of the close actions', () => {
    // upstream's guards leave only 'close-right' for the graph tab
    expect(buildTabContextItems(3, -1).map((item) => item.key)).toEqual(['close-right']);
    expect(buildTabContextItems(0, -1)).toEqual([]);
  });

  it('returns nothing when no tab is open', () => {
    expect(buildTabContextItems(0, 0)).toEqual([]);
  });

  it('labels the actions as upstream does', () => {
    expect(buildTabContextItems(2, 0).map((item) => item.label)).toEqual([
      'Close',
      'Close all Tabs',
      'Close other Tabs',
      'Close Tabs to the right',
    ]);
  });
});

describe('graph tab bar', () => {
  const mountTabs = (state: Record<string, unknown>) =>
    mount(
      defineComponent({
        setup() {
          const bundle = DecisionGraphProvider();
          bundle.stateStore.setState(state);

          return () => h(GraphTabs);
        },
      }),
    );

  it('renders the graph tab and the open node tabs', () => {
    const wrapper = mountTabs({
      decisionGraph: {
        nodes: [{ id: 'n1', name: 'My expression', type: 'expressionNode', position: { x: 0, y: 0 } }],
        edges: [],
      },
      openTabs: ['n1'],
      activeTab: 'n1',
    });

    const tabs = wrapper.findAll('.grl-graph-tabs__tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].attributes('data-active')).toBe('false');
    expect(tabs[1].attributes('data-active')).toBe('true');
    expect(tabs[0].text()).toContain('Graph');
    expect(tabs[1].text()).toContain('My expression');

    // the graph tab is not closable, the node tab is
    expect(tabs[0].find('.grl-graph-tabs__closeIcon').exists()).toBe(false);
    expect(tabs[1].find('.grl-graph-tabs__closeIcon').exists()).toBe(true);
  });

  it('names the graph tab Nodes when the decision view is enabled', () => {
    const wrapper = mountTabs({
      viewConfig: { enabled: true },
    });

    expect(wrapper.find('.grl-graph-tabs__tab').text()).toContain('Nodes');
  });

  it('closes a node tab from its close button without activating it', async () => {
    let bundle: ReturnType<typeof DecisionGraphProvider> | undefined;

    const wrapper = mount(
      defineComponent({
        setup() {
          bundle = DecisionGraphProvider();
          bundle.stateStore.setState({
            decisionGraph: {
              nodes: [{ id: 'n1', name: 'My expression', type: 'expressionNode', position: { x: 0, y: 0 } }],
              edges: [],
            },
            openTabs: ['n1'],
            activeTab: 'graph',
          });

          return () => h(GraphTabs);
        },
      }),
    );

    const closeButton = wrapper.find('.grl-graph-tabs__closeIcon');
    expect(closeButton.exists()).toBe(true);

    // the mousedown must not reach the tab trigger (it would activate the tab)
    await closeButton.trigger('mousedown');
    await wrapper.vm.$nextTick();
    expect(bundle?.stateStore.getState().activeTab).toBe('graph');

    await closeButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(bundle?.stateStore.getState().openTabs).toEqual([]);
    expect(bundle?.stateStore.getState().activeTab).toBe('graph');
  });

  it('forwards the extra slot into the tab bar', () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          DecisionGraphProvider();

          return () => h(GraphTabs, null, { extra: () => h('span', { class: 'extra-content' }, 'extra') });
        },
      }),
    );

    expect(wrapper.find('.grl-tabs__extra .extra-content').exists()).toBe(true);
  });

  it('does not reserve the extra area when no extra content is given', () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          DecisionGraphProvider();

          return () => h(GraphTabs);
        },
      }),
    );

    expect(wrapper.find('.grl-tabs__extra').exists()).toBe(false);
  });

  it('opens a tab when the tab bar changes the active key', async () => {
    let bundle: ReturnType<typeof DecisionGraphProvider> | undefined;

    const wrapper = mount(
      defineComponent({
        setup() {
          bundle = DecisionGraphProvider();
          bundle.stateStore.setState({
            decisionGraph: {
              nodes: [{ id: 'n1', name: 'My expression', type: 'expressionNode', position: { x: 0, y: 0 } }],
              edges: [],
            },
            openTabs: ['n1'],
            activeTab: 'n1',
          });

          return () => h(GraphTabs);
        },
      }),
    );

    const triggers = wrapper.findAll('[role="tab"]');
    expect(triggers).toHaveLength(2);
    expect(triggers[1].attributes('data-state')).toBe('active');

    // reka-ui's TabsTrigger activates on mousedown
    await triggers[0].trigger('mousedown');
    await wrapper.vm.$nextTick();

    expect(bundle?.stateStore.getState().activeTab).toBe('graph');
  });
});
