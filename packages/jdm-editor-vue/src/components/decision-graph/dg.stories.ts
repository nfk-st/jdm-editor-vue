// Ported from components/decision-graph/dg.stories.tsx — upstream's React
// (CSF2) story becomes a Vue 3 CSF3 story with render functions.
//
// PORTING (props): upstream's public `value` / `onChange` pair becomes the
// port's `modelValue` / `update:modelValue` (v-model) per docs/PORTING.md's
// React → Vue table. The port keeps `onChange` as a prop alongside the emit;
// the stories drive the v-model path and log the changes through
// `action('onChange')` (upstream logged nothing — upstream's `fn()` from
// @storybook/test becomes `action()` from @storybook/addon-actions, that
// package is not a dependency of this port).
// PORTING (props): upstream's `reactFlowProOptions` prop is DROPPED in the
// port (vue-flow is MIT — see docs/vue-flow-mapping.md), so the stories do
// not pass it.
// PORTING (props): upstream's `tabBarExtraContent` maps to the port's
// `#tab-bar-extra-content` slot (single/right), plus `-left` and `-right`
// slots for antd's `{ left, right }` form — upstream's story never used it.
// PORTING (props): upstream's react-dnd `manager` prop is a deprecated
// accept-and-ignore stub in the port — the stories do not pass it.
// PORTING (layout): upstream sizes the story wrapper with `height: '100%'`.
// `.grl-dg` is `height: 100%` inside a CSS grid, so the canvas collapses
// (zero width) and the palette takes the whole row unless the wrapper has a
// definite height — the preview's height chain provides it (and the wrapper
// keeps a min-height as a floor).
// PORTING (panels): upstream's panel `renderPanel` was a closure
// (`renderPanel: () => <GraphSimulator … />`); the port renders
// `renderPanel` as a component with no props, so the closure becomes a small
// wrapper component that captures the handler.
// PORTING (icons): upstream's @ant-design/icons become lucide-vue-next
// components (the port's `icon` accepts a Component as well as a VNode).
// PORTING (harness): the preview's decorator renders the JdmConfigProvider
// WITHOUT props, so @storybook/vue3's live control updates reach the story
// (the provider's own props would otherwise become the root vnode's props,
// and the Controls panel would drive the provider instead of the story).
// The stories that need a switch (Diff) drive it from a local button, the
// way upstream's BusinessMode story drives its Dev / Business switch.
import { action } from '@storybook/addon-actions';
import type { ComponentPropsAndSlots, Meta, StoryObj } from '@storybook/vue3';
import json5 from 'json5';
import { ArrowLeft, ArrowRight, Braces, Building2, CirclePlay } from 'lucide-vue-next';
import { P, match } from 'ts-pattern';
import { type PropType, computed, defineComponent, h, nextTick, ref, watch } from 'vue';

import type { DictionaryMap } from '../../theme';
import type { JdmUiMode } from '../decision-table/context/dt-store.context';
import Button from '../ui/Button.vue';
import Select from '../ui/Select.vue';
import type { DecisionGraphStoreType, PanelType } from './context/dg-store.context';
import type { DecisionGraphSnapshot } from './context/serializer.context';
import type { DecisionGraphType } from './dg-types';
import {
  defaultGraph,
  defaultGraphCustomNode,
  defaultGraphInputsFormCustomNode,
  defaultGraphUnknownNode,
  diffGraph,
} from './dg.stories-values';
import DecisionGraph from './dg.vue';
import { calculateDiffGraph } from './diff/utility';
import { createJdmNode } from './nodes/custom-node';
import GraphNode from './nodes/graph-node.vue';
import type { MinimalNodeSpecification, NodeSpecification } from './nodes/specifications/specification-types';
import GraphSimulator from './simulator/dg-simulator.vue';
import type { Simulation, SimulationTrace } from './simulator/simulation.types';

const meta = {
  title: 'Decision Graph',
  component: DecisionGraph,
  // PORTING: upstream's meta declares `argTypes: {}` and `args: {}` — empty
  // object literals. An empty `args`/`argTypes` literal trips TypeScript's
  // weak-type check against the component's (all-optional) props, so both are
  // left out — semantically the same as upstream's empty objects.
} satisfies Meta<typeof DecisionGraph>;

export default meta;

type Story = StoryObj<typeof meta>;
type GraphArgs = ComponentPropsAndSlots<typeof DecisionGraph>;

const onChangeAction = action('onChange');

// PORTING: upstream sizes the story wrapper with `height: '100%'` — see the
// header note. The port needs a definite height for the CSS grid to lay out:
// the preview's height chain (body → #storybook-root → 100%) resolves it, and
// the min-height keeps the canvas usable if that chain is ever missing.
const GRAPH_WRAPPER_STYLE = { height: '100%', minHeight: '600px' };

// upstream: the custom "decision" node specification (a component the user
// can drag onto the canvas from the palette).
// PORTING: upstream's `renderNode` was a React.FC taking
// `{ specification, id, selected, data }`; the port's `renderNode` is a
// component, so the render function becomes a `defineComponent`.
const DecisionNodeRender = defineComponent({
  name: 'DecisionNodeRender',
  props: {
    id: { type: String, required: true },
    data: { type: Object as PropType<{ name?: string }>, default: () => ({}) },
    selected: { type: Boolean, default: false },
    specification: { type: Object as PropType<MinimalNodeSpecification>, required: true },
  },
  setup(props) {
    return () =>
      h(
        GraphNode,
        {
          id: props.id,
          specification: props.specification,
          name: props.data?.name,
          isSelected: props.selected,
        },
        { default: () => h(Select, { placeholder: 'Select decision from list' }) },
      );
  },
});

const components: NodeSpecification[] = [
  {
    type: 'decisionNode',
    displayName: 'Decision',
    shortDescription: 'Execute decisions',
    icon: Building2,
    generateNode: () => ({ name: 'myDecision' }),
    renderNode: DecisionNodeRender,
  },
];

// upstream: the custom nodes (ping / pong / one-sided handles / an inputs
// form). PORTING: upstream's `icon: <RightOutlined />` (a vnode) becomes the
// lucide component itself — a vnode must not be re-mounted across node
// instances (graph.vue's precedent).
const customNodes = [
  createJdmNode({
    kind: 'pingNode',
    displayName: 'Ping',
    group: 'ping',
    shortDescription: 'Used for ping',
  }),
  createJdmNode({
    kind: 'pongNode',
    displayName: 'Pong',
    group: 'ping',
    shortDescription: 'Used for pong',
  }),
  createJdmNode({
    kind: 'rightHandleNode',
    group: 'integrations',
    displayName: 'Right Handle',
    icon: ArrowRight,
    handleLeft: false,
  }),
  createJdmNode({
    kind: 'leftHandleNode',
    group: 'integrations',
    displayName: 'Left Handle',
    icon: ArrowLeft,
    handleRight: false,
  }),
  createJdmNode({
    kind: 'inputsNode',
    group: 'inputs',
    displayName: 'Inputs Form',
    shortDescription: 'With inputs map form',
    icon: Braces,
    inputs: [
      {
        control: 'text',
        name: 'hello.nested.something',
        label: 'First',
      },
      {
        control: 'text',
        name: 'second',
        label: 'Second',
      },
      {
        control: 'bool',
        name: 'checkbox',
        label: 'Checkbox',
      },
    ],
  }),
];

const unknownCustomNodes = [
  createJdmNode({
    kind: 'pingNode',
    displayName: 'Ping',
    group: 'ping',
    shortDescription: 'Used for ping',
  }),
];

// upstream: the Controlled / Extended / CustomNode / … stories keep the graph
// in React state; upstream's `useState` becomes a `ref` in this small host
// component, which feeds the port's `modelValue` and listens to
// `update:modelValue`.
const ControlledHost = defineComponent({
  name: 'ControlledHost',
  props: {
    args: { type: Object as PropType<GraphArgs>, required: true },
    initialValue: { type: Object as PropType<DecisionGraphType | undefined>, default: undefined },
    customNodes: {
      type: Array as PropType<DecisionGraphStoreType['state']['customNodes']>,
      default: undefined,
    },
    components: { type: Array as PropType<DecisionGraphStoreType['state']['components']>, default: undefined },
  },
  setup(props) {
    const value = ref<DecisionGraphType | undefined>(props.initialValue);

    return () =>
      h(DecisionGraph, {
        ...props.args,
        ...(props.customNodes ? { customNodes: props.customNodes } : {}),
        ...(props.components ? { components: props.components } : {}),
        'modelValue': value.value,
        'onUpdate:modelValue': (next: DecisionGraphType) => {
          value.value = next;
          onChangeAction(next);
        },
      });
  },
});

export const Controlled: Story = {
  render: (args) => h('div', { style: GRAPH_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: defaultGraph })]),
};

export const Uncontrolled: Story = {
  render: (args) =>
    h('div', { style: GRAPH_WRAPPER_STYLE }, [
      h(DecisionGraph, {
        ...args,
        defaultValue: defaultGraph,
        // upstream forwards the change to `args.onChange`; the port keeps an
        // `onChange` prop next to the `update:modelValue` emit.
        onChange: (next: DecisionGraphType) => {
          args.onChange?.(next);
          onChangeAction(next);
        },
      }),
    ]),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => h('div', { style: GRAPH_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: defaultGraph })]),
};

export const Extended: Story = {
  render: (args) =>
    h('div', { style: GRAPH_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: undefined, components })]),
};

export const CustomNode: Story = {
  render: (args) =>
    h('div', { style: GRAPH_WRAPPER_STYLE }, [
      h(ControlledHost, { args, initialValue: defaultGraphCustomNode, customNodes, components }),
    ]),
};

export const InputFormCustomNode: Story = {
  render: (args) =>
    h('div', { style: GRAPH_WRAPPER_STYLE }, [
      h(ControlledHost, { args, initialValue: defaultGraphInputsFormCustomNode, customNodes, components }),
    ]),
};

export const UnknownCustomNode: Story = {
  render: (args) =>
    h('div', { style: GRAPH_WRAPPER_STYLE }, [
      h(ControlledHost, { args, initialValue: defaultGraphUnknownNode, customNodes: unknownCustomNodes, components }),
    ]),
};

const safeParse = (val?: string) => {
  try {
    return JSON.parse(val ?? '');
  } catch {
    return val;
  }
};

const mapSimulateError = (graph: DecisionGraphType, error: unknown): Simulation | undefined =>
  match(error)
    .with(
      {
        data: {
          type: P.optional(P.string),
          source: P.optional(P.string),
          nodeId: P.optional(P.string),
          trace: P.optional(P._),
        },
      },
      ({ data }) => {
        const error = {
          title: data.type,
          message: safeParse(data.source),
          data: { nodeId: data.nodeId },
        };

        return {
          error,
          result: {
            // PORTING: upstream cast the trace with `as any`; ours narrows it
            // to the trace map the simulation type declares.
            trace: data.trace as Record<string, SimulationTrace>,
            result: { error },
            performance: '',
            snapshot: graph,
          },
        } satisfies Simulation;
      },
    )
    .otherwise(() => undefined);

// upstream: the Simulator story builds its panel with a `renderPanel`
// closure. PORTING: the port's panel machinery renders `renderPanel` as a
// component with no props, so the closure becomes a wrapper component that
// captures the handler.
const DecisionGraphWithSimulator = defineComponent({
  name: 'DecisionGraphWithSimulator',
  setup() {
    const value = ref<DecisionGraphType>(defaultGraph);
    const simulate = ref<Simulation | undefined>(undefined);

    const runSimulation = async ({ graph, context }: { graph: DecisionGraphType; context: unknown }) => {
      try {
        const response = await fetch('https://editor.gorules.io/api/simulate', {
          method: 'POST',
          body: JSON.stringify({ content: graph, context }),
          headers: { 'content-type': 'application/json' },
        });

        const responseJson = await response.json();
        simulate.value = { result: { ...responseJson, snapshot: graph } };
      } catch (err) {
        simulate.value = mapSimulateError(graph, err);
      }
    };

    const SimulatorPanel = defineComponent({
      name: 'SimulatorPanel',
      setup() {
        return () =>
          h(GraphSimulator, {
            defaultRequest: json5.stringify(
              {
                customer: { country: 'US' },
                cart: { weight: 50 },
              },
              null,
              2,
            ),
            onRun: runSimulation,
            onClear: () => {},
          });
      },
    });

    const panels: PanelType[] = [
      {
        id: 'simulator',
        title: 'Simulator',
        icon: CirclePlay,
        hideHeader: true,
        renderPanel: SimulatorPanel,
      },
    ];

    return () =>
      h(DecisionGraph, {
        'modelValue': value.value,
        'simulate': simulate.value,
        'defaultActivePanel': 'simulator',
        'panels': panels,
        'onUpdate:modelValue': (next: DecisionGraphType) => {
          value.value = next;
          onChangeAction(next);
        },
      });
  },
});

export const Simulator: Story = {
  render: () => h('div', { style: GRAPH_WRAPPER_STYLE }, [h(DecisionGraphWithSimulator)]),
};

// PORTING: upstream's Diff story toggles the diff through a story-only
// control (`enableDiff`) that is not one of the component's props — upstream
// reached for `as any` to read it. Ours narrows the args to a concrete shape
// instead (no `any` involved).
type DiffControl = { enableDiff?: boolean };

const readDiffControl = (args: object): DiffControl => args as DiffControl;

const DiffHost = defineComponent({
  name: 'DiffHost',
  props: {
    args: { type: Object as PropType<GraphArgs>, required: true },
  },
  setup(props) {
    const value = ref<DecisionGraphType>(diffGraph);

    // upstream: const enableDiff = (args as any)?.enableDiff;
    const enableDiff = computed(() => readDiffControl(props.args).enableDiff === true);

    // upstream: useMemo(() => enableDiff ? calculateDiffGraph(value, diffGraph, { customNodes, components }) : value)
    const innerValue = computed<DecisionGraphType>(() =>
      enableDiff.value ? calculateDiffGraph(value.value, diffGraph, { customNodes, components }) : value.value,
    );

    return () =>
      h('div', { style: GRAPH_WRAPPER_STYLE }, [
        h(DecisionGraph, {
          ...props.args,
          'modelValue': innerValue.value,
          'disabled': enableDiff.value,
          'customNodes': customNodes,
          'components': components,
          'onUpdate:modelValue': (next: DecisionGraphType) => {
            if (!enableDiff.value) {
              value.value = next;
            }
          },
        }),
      ]);
  },
});

export const Diff: Story = {
  render: (args) => h(DiffHost, { args }),
  // PORTING: `enableDiff` is a story-only control, so it is not part of the
  // component's props — the assertion widens the argTypes with it (upstream
  // cast the whole argTypes object with `as any`).
  argTypes: {
    enableDiff: { control: { type: 'boolean' } },
  } as NonNullable<Story['argTypes']>,
};

export const View: Story = {
  args: {
    viewConfig: {
      enabled: true,
      description: 'Configure business rules for your decision model',
      permissions: {
        '359173d8-0068-45f8-bb71-8240ad73201d': 'edit:values',
        'a750cebf-ca75-4acd-a272-7040626abd73': 'edit:values',
      },
    },
    viewConfigCta: 'Configure',
  },
  render: (args) => h('div', { style: GRAPH_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: defaultGraph })]),
};

const DICTIONARIES: DictionaryMap = {
  country: [
    { label: 'United States', value: 'US' },
    { label: 'Canada', value: 'CA' },
    { label: 'Mexico', value: 'MX' },
    { label: 'United Kingdom', value: 'UK' },
  ],
};

const businessModeGraph: DecisionGraphType = {
  nodes: [
    {
      id: 'input-1',
      type: 'inputNode',
      position: { x: 70, y: 250 },
      name: 'Request',
    },
    {
      id: 'output-1',
      type: 'outputNode',
      position: { x: 670, y: 250 },
      name: 'Response',
    },
    {
      id: 'dt-1',
      type: 'decisionTableNode',
      position: { x: 370, y: 250 },
      name: 'Shipping Fees',
      content: {
        hitPolicy: 'first',
        inputs: [
          {
            id: 'i1',
            field: 'cart.weight',
            name: 'Cart Weight (Kg)',
            fieldType: { type: 'number' },
          },
          {
            id: 'i2',
            field: 'customer.country',
            name: 'Customer Country',
            fieldType: { type: 'string', enum: { type: 'ref', ref: 'country' } },
          },
        ],
        outputs: [
          {
            id: 'o1',
            field: 'shippingFee',
            name: 'Shipping Fee',
            outputFieldType: { type: 'number' },
          },
        ],
        rules: [
          { _id: 'r1', _description: '', i1: '> 40', i2: '"US"', o1: '40' },
          { _id: 'r2', _description: '', i1: '> 40', i2: '', o1: '50' },
          { _id: 'r3', _description: '', i1: '[20..40]', i2: '"US"', o1: '30' },
          { _id: 'r4', _description: '', i1: '< 20', i2: '', o1: '25' },
        ],
      },
    },
  ],
  edges: [
    { id: 'e1', type: 'edge', sourceId: 'input-1', targetId: 'dt-1' },
    { id: 'e2', type: 'edge', sourceId: 'dt-1', targetId: 'output-1' },
  ],
};

const buildLargeSerializeGraph = (): DecisionGraphType => {
  const inputId = 'serialize-input';
  const outputId = 'serialize-output';
  const tableId = 'serialize-table';
  const expressionId = 'serialize-expression';
  const functionId = 'serialize-function';

  const tableInputs = [
    { id: 'in_weight', field: 'cart.weight', name: 'Cart Weight (Kg)' },
    { id: 'in_country', field: 'customer.country', name: 'Customer Country' },
    { id: 'in_tier', field: 'customer.tier', name: 'Customer Tier' },
  ];
  const tableOutputs = [{ id: 'out_fee', field: 'shippingFee', name: 'Shipping Fee' }];

  const rules = Array.from({ length: 100 }, (_, i) => ({
    _id: `rule-${i + 1}`,
    _description: `Rule ${i + 1}: shipping fee for tier ${i % 5}`,
    in_weight: `[${i * 2}..${i * 2 + 10}]`,
    in_country: i % 2 === 0 ? '"US"' : '"CA"',
    in_tier: `"tier${i % 5}"`,
    out_fee: `${10 + i}`,
  }));

  const expressions = Array.from({ length: 50 }, (_, i) => ({
    id: `expr-${i + 1}`,
    key: `field_${i + 1}`,
    value: `customer.score + ${i} * order.total / 100`,
  }));

  const functionSource = [
    "import zen from 'zen';",
    '',
    '/** @type {Handler} **/',
    'export const handler = async (input) => {',
    '  const lines = [];',
    ...Array.from({ length: 80 }, (_, i) => `  lines.push('line ${i + 1}: ' + JSON.stringify(input));`),
    '',
    '  const result = {',
    '    received: input,',
    '    processedAt: new Date().toISOString(),',
    '    lineCount: lines.length,',
    "    summary: lines.join('\\n'),",
    '  };',
    '',
    '  return result;',
    '};',
  ].join('\n');

  return {
    nodes: [
      { id: inputId, type: 'inputNode', position: { x: 80, y: 240 }, name: 'Request' },
      {
        id: tableId,
        type: 'decisionTableNode',
        position: { x: 360, y: 100 },
        name: 'Big Table',
        content: { hitPolicy: 'first', inputs: tableInputs, outputs: tableOutputs, rules },
      },
      {
        id: expressionId,
        type: 'expressionNode',
        position: { x: 360, y: 360 },
        name: 'Big Expression',
        content: { expressions, passThrough: true, executionMode: 'single' },
      },
      {
        id: functionId,
        type: 'functionNode',
        position: { x: 360, y: 600 },
        name: 'Big Function',
        content: { source: functionSource },
      },
      { id: outputId, type: 'outputNode', position: { x: 720, y: 360 }, name: 'Response' },
    ],
    edges: [
      { id: 'e-in-table', type: 'edge', sourceId: inputId, targetId: tableId },
      { id: 'e-in-expr', type: 'edge', sourceId: inputId, targetId: expressionId },
      { id: 'e-in-func', type: 'edge', sourceId: inputId, targetId: functionId },
      { id: 'e-table-out', type: 'edge', sourceId: tableId, targetId: outputId },
      { id: 'e-expr-out', type: 'edge', sourceId: expressionId, targetId: outputId },
      { id: 'e-func-out', type: 'edge', sourceId: functionId, targetId: outputId },
    ],
  };
};

// upstream: the serialize / restore harness. PORTING: upstream's `useRef` +
// `useEffect` become a `ref` + a `watch` on the mount key, and
// `requestAnimationFrame` becomes `nextTick` (the remounted graph is only
// mounted after the key change is flushed).
const DecisionGraphSerializeTest = defineComponent({
  name: 'DecisionGraphSerializeTest',
  setup() {
    const graphRef = ref<InstanceType<typeof DecisionGraph> | null>(null);
    const value = ref<DecisionGraphType>(buildLargeSerializeGraph());
    const snapshot = ref<DecisionGraphSnapshot | null>(null);
    const mountKey = ref(0);
    const showJson = ref(true);
    const pendingRestore = ref<DecisionGraphSnapshot | null>(null);

    watch(mountKey, () => {
      const snap = pendingRestore.value;
      if (!snap) return;
      pendingRestore.value = null;
      nextTick(() => {
        graphRef.value?.restore(snap);
      });
    });

    const handleSave = () => {
      snapshot.value = graphRef.value?.serialize() ?? {};
    };

    const handleRestore = () => {
      if (snapshot.value) graphRef.value?.restore(snapshot.value);
    };

    const handleRemountAndRestore = () => {
      pendingRestore.value = snapshot.value;
      mountKey.value += 1;
    };

    const handleClear = () => {
      snapshot.value = null;
    };

    return () =>
      h('div', { style: { ...GRAPH_WRAPPER_STYLE, display: 'flex', flexDirection: 'column' } }, [
        h('div', { style: { padding: '8px', borderBottom: '1px solid #eee' } }, [
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } }, [
            h(Button, { size: 'small', type: 'primary', onClick: handleSave }, { default: () => 'Serialize' }),
            h(
              Button,
              { size: 'small', disabled: !snapshot.value, onClick: handleRestore },
              { default: () => 'Restore (live)' },
            ),
            h(
              Button,
              { size: 'small', disabled: !snapshot.value, onClick: handleRemountAndRestore },
              { default: () => 'Remount + Restore' },
            ),
            h(
              Button,
              { size: 'small', disabled: !snapshot.value, onClick: handleClear },
              { default: () => 'Clear snapshot' },
            ),
            h(
              Button,
              { size: 'small', onClick: () => (showJson.value = !showJson.value) },
              { default: () => (showJson.value ? 'Hide' : 'Show') + ' JSON' },
            ),
            h(
              'span',
              { class: 'grl-typography grl-typography--secondary', style: { fontSize: '12px' } },
              snapshot.value ? 'Snapshot saved' : 'No snapshot',
            ),
          ]),
        ]),
        h('div', { style: { flex: '1', display: 'flex', minHeight: '0' } }, [
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h(DecisionGraph, {
              'key': mountKey.value,
              'ref': graphRef,
              'modelValue': value.value,
              'components': components,
              'customNodes': customNodes,
              'onUpdate:modelValue': (next: DecisionGraphType) => {
                value.value = next;
                onChangeAction(next);
              },
            }),
          ]),
          showJson.value
            ? h(
                'div',
                {
                  style: {
                    width: '360px',
                    borderLeft: '1px solid #eee',
                    padding: '8px',
                    overflow: 'auto',
                    fontFamily: 'var(--mono-font-family, monospace)',
                    fontSize: '11px',
                    background: '#fafafa',
                  },
                },
                [
                  h(
                    'span',
                    { class: 'grl-typography', style: { display: 'block', marginBottom: '8px', fontWeight: 600 } },
                    'Snapshot',
                  ),
                  h(
                    'pre',
                    { style: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } },
                    snapshot.value ? JSON.stringify(snapshot.value, null, 2) : '// click "Serialize" to capture',
                  ),
                ],
              )
            : null,
        ]),
      ]);
  },
});

export const Serialize: Story = {
  render: () => h(DecisionGraphSerializeTest),
};

const DecisionGraphBusinessMode = defineComponent({
  name: 'DecisionGraphBusinessMode',
  setup() {
    const value = ref<DecisionGraphType>(businessModeGraph);
    const mode = ref<JdmUiMode>('business');

    return () =>
      h('div', { style: { ...GRAPH_WRAPPER_STYLE, display: 'flex', flexDirection: 'column' } }, [
        h('div', { style: { padding: '8px', borderBottom: '1px solid #eee' } }, [
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
            h('span', null, 'Mode:'),
            h(
              Button,
              {
                size: 'small',
                type: mode.value === 'dev' ? 'primary' : 'default',
                onClick: () => (mode.value = 'dev'),
              },
              { default: () => 'Dev' },
            ),
            h(
              Button,
              {
                size: 'small',
                type: mode.value === 'business' ? 'primary' : 'default',
                onClick: () => (mode.value = 'business'),
              },
              { default: () => 'Business' },
            ),
          ]),
        ]),
        h('div', { style: { flex: '1' } }, [
          h(DecisionGraph, {
            'modelValue': value.value,
            'mode': mode.value,
            'dictionaries': DICTIONARIES,
            'onUpdate:modelValue': (next: DecisionGraphType) => {
              value.value = next;
              onChangeAction(next);
            },
          }),
        ]),
      ]);
  },
});

export const BusinessMode: Story = {
  render: () => h(DecisionGraphBusinessMode),
};
