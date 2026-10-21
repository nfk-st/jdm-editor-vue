// @vitest-environment jsdom
// Logic-core coverage for the decision-graph simulator (PORTING.md's testing
// rule): the segment formatter, and the Run / Clear affordance gating —
// upstream renders them only when the matching callback is provided, and the
// port must not call a handler twice.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { DecisionGraphProvider } from '../context/dg-store.context';
import type { DecisionGraphType } from '../dg-types';
import { NodeKind } from '../nodes/specifications/specification-types';
import GraphSimulator, { SimulationSegment, displaySegment } from './dg-simulator.vue';

// The simulator mounts a real Monaco editor. vite.config aliases
// monaco-editor to a stub whose editor.create THROWS, so the loader is
// mocked here with a minimal editor.
vi.mock('../../../helpers/monaco', () => ({
  loader: {
    init: async () => ({
      editor: {
        create: () => ({
          onDidChangeModelContent: () => undefined,
          addAction: () => undefined,
          getValue: () => '',
          setValue: () => undefined,
          updateOptions: () => undefined,
          getModel: () => ({ dispose: () => undefined }),
          dispose: () => undefined,
        }),
        setTheme: () => undefined,
        getModels: () => [],
        getEditors: () => [],
      },
      languages: {
        typescript: {
          javascriptDefaults: {
            setDiagnosticsOptions: () => undefined,
            setModeConfiguration: () => undefined,
            setExtraLibs: () => undefined,
          },
        },
      },
    }),
  },
}));

// vitest's jsdom environment ships a non-functional localStorage global —
// the simulator persists its search/segment through usePersistentState.
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

// The Run button is disabled unless the graph has an input node, so the
// fixture seeds one.
const graphWithInput: DecisionGraphType = {
  nodes: [{ id: 'in-1', name: 'Request', type: NodeKind.Input, position: { x: 0, y: 0 } }],
  edges: [],
};

const mountSimulator = (props: Record<string, unknown> = {}, graph?: DecisionGraphType) =>
  mount(
    defineComponent({
      setup() {
        // provide() only works inside setup
        const bundle = DecisionGraphProvider();
        if (graph) {
          bundle.actions.setDecisionGraph(graph);
        }

        return () => h(GraphSimulator, props);
      },
    }),
  );

describe('displaySegment', () => {
  it('renders the output segment', () => {
    // json5.stringify — unquoted keys, single quotes, trailing comma
    expect(displaySegment({ output: { risk: 'low' } }, SimulationSegment.Output)).toBe("{\n  risk: 'low',\n}");
  });

  it('renders the input segment', () => {
    expect(displaySegment({ input: { age: 30 } }, SimulationSegment.Input)).toBe('{\n  age: 30,\n}');
  });

  it('renders the trace segment', () => {
    expect(displaySegment({ trace: { a: 1 } }, SimulationSegment.Trace)).toBe('{\n  a: 1,\n}');
  });

  it('falls back to the trace data', () => {
    expect(displaySegment({ traceData: { b: 2 } }, SimulationSegment.Trace)).toBe('{\n  b: 2,\n}');
  });

  it('renders an empty object for data it does not understand', () => {
    expect(displaySegment({ other: 1 }, SimulationSegment.Output)).toBe('{}');
    expect(displaySegment(undefined, SimulationSegment.Output)).toBe('{}');
  });
});

describe('the Run affordance', () => {
  it('is rendered only when a run handler is provided', () => {
    const withHandler = mountSimulator({ onRun: () => {} });
    expect(withHandler.findAll('button').some((b) => b.text() === 'Run')).toBe(true);
    withHandler.unmount();

    const withoutHandler = mountSimulator();
    expect(withoutHandler.findAll('button').some((b) => b.text() === 'Run')).toBe(false);
    withoutHandler.unmount();
  });

  it('calls the handler exactly once, with the graph and the parsed context', async () => {
    const onRun = vi.fn();
    const wrapper = mountSimulator({ onRun }, graphWithInput);

    const runButton = wrapper.findAll('button').find((b) => b.text() === 'Run');
    expect(runButton).toBeDefined();

    await runButton!.trigger('click');

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith({ graph: graphWithInput, context: null });

    wrapper.unmount();
  });
});

describe('the Clear affordance', () => {
  const clearButton = (wrapper: ReturnType<typeof mountSimulator>) =>
    wrapper.find('.grl-dg__simulator__section__bar--nodes').find('button');

  it('is rendered only when a clear handler is provided', () => {
    const withHandler = mountSimulator({ onClear: () => {} });
    expect(clearButton(withHandler).exists()).toBe(true);
    withHandler.unmount();

    const withoutHandler = mountSimulator();
    expect(clearButton(withoutHandler).exists()).toBe(false);
    withoutHandler.unmount();
  });

  it('calls the handler exactly once', async () => {
    const onClear = vi.fn();
    const wrapper = mountSimulator({ onClear });

    await clearButton(wrapper).trigger('click');

    expect(onClear).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
