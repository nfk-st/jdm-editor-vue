// Ported from components/function/function.stories.tsx — upstream's CSF2 +
// React story becomes CSF3 with a Vue render function.
// PORTING: upstream's `fn()` from @storybook/test → `action()` from
// @storybook/addon-actions (@storybook/test is not a dependency of this port).
// PORTING: upstream's `value`/`onChange` → `modelValue`/`update:modelValue`
// (docs/PORTING.md's React → Vue table); upstream's `onMonacoReady` /
// `onEditorMount` props → the port's `monacoReady` / `editorMount` emits
// (same listener prop names).
// PORTING: upstream's react-dnd `manager` prop is not used by this component,
// so the story does not pass it.
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/vue3';
import { type PropType, defineComponent, h, ref } from 'vue';

import Function from './function.vue';
import { defaultFunctionValue } from './helpers/libs';
import type { SimulationTrace, SimulationTraceDataFunction } from './types';

// PORTING: upstream's exampleTrace is a partial `FunctionDebuggerTrace` that
// upstream casts with `as any`; the port's `trace` prop is the canonical
// `SimulationTrace<SimulationTraceDataFunction>`, so the sample trace is
// spelled out in full instead of being cast away.
const exampleTrace: SimulationTrace<SimulationTraceDataFunction> = {
  id: '6a5bc11c-41ef-43d5-b3ae-93c51ecebc19',
  name: 'handler',
  performance: '2.820417ms',
  input: null,
  output: null,
  traceData: {
    log: [
      {
        lines: ['"string"'],
        msSinceRun: 1,
      },
      {
        lines: ['"numbers"', '1', '2', '3'],
        msSinceRun: 1,
      },
      {
        lines: ['["array","of",{"multiple":true},1,"items"]'],
        msSinceRun: 1,
      },
      {
        lines: ['{"1":true,"2":false,"3":5,"4":"object"}'],
        msSinceRun: 1,
      },
      {
        lines: ['{"deeply":{"nested":{"flat":"test","object":{"withSome":{"keys":"123"}}}}}'],
        msSinceRun: 1,
      },
      {
        lines: ['"Error: failed to evaluate function"'],
        msSinceRun: 1,
      },
    ],
  },
};

// PORTING: upstream's storybook preview lays the story out fullscreen, so the
// editor gets the whole viewport height; the port's preview is padded, so the
// story wraps the editor in a fixed-height container instead.
const STORY_WRAPPER_STYLE = { height: '600px' };

const onChangeAction = action('onChange');
const onMonacoReadyAction = action('onMonacoReady');

const meta = {
  title: 'Function',
  component: Function,
  args: {
    'disabled': false,
    'defaultValue': defaultFunctionValue,
    'trace': exampleTrace,
    'inputData': { customer: { firstName: 'John', lastName: 'Doe' } },
    'onMonacoReady': onMonacoReadyAction,
    'onUpdate:modelValue': onChangeAction,
  },
  argTypes: {
    disabled: { control: 'boolean' },
    defaultValue: { control: 'text' },
    inputData: { control: 'object' },
    modelValue: { table: { disable: true } },
    permission: {
      control: 'select',
      options: ['edit:full'],
    },
  },
} satisfies Meta<typeof Function>;

export default meta;

type Story = StoryObj<typeof meta>;

// upstream: the Controlled story keeps the value in React state.
const ControlledHost = defineComponent({
  name: 'ControlledHost',
  props: {
    args: { type: Object as PropType<Record<string, unknown>>, required: true },
  },
  setup(props) {
    const value = ref<string>(defaultFunctionValue);

    // upstream: `onChange={setValue}` replaces the meta's `onChange: fn()`,
    // so the action does not fire in this story — same here.
    return () =>
      h(Function, {
        ...props.args,
        'modelValue': value.value,
        'onUpdate:modelValue': (next: string) => {
          value.value = next;
        },
      });
  },
});

export const Uncontrolled: Story = {
  render: (args) => h('div', { style: STORY_WRAPPER_STYLE }, [h(Function, args)]),
};

export const Controlled: Story = {
  render: (args) => h('div', { style: STORY_WRAPPER_STYLE }, [h(ControlledHost, { args })]),
};

export const WithError: Story = {
  args: {
    defaultValue: `import http from 'http';
import zen from 'zen';

export const handler = async (input) => {
  throw new Error('hello worldd');

  return input;
};
    `,
    error: {
      data: {
        nodeId: '6a5bc11c-41ef-43d5-b3ae-93c51ecebc19',
        source: 'Error:5:9 hello worldd\n    at handler (node:function1:5:9)\n',
      },
    },
  },
  render: (args) => h('div', { style: STORY_WRAPPER_STYLE }, [h(Function, args)]),
};
