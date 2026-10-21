// Ported from components/code-editor/business/expression-builder.stories.tsx —
// upstream's CSF2 + React story becomes CSF3 with a Vue render function.
// PORTING: upstream's `fn()` from @storybook/test is `action()` from
// @storybook/addon-actions (@storybook/test is not a dependency of this port).
// PORTING: upstream's `value`/`onChange` props become `modelValue` +
// `update:modelValue` (docs/PORTING.md's public-prop convention).
// PORTING: upstream's `.storybook/preview.tsx` awaits the Zen wasm at module
// scope, so every upstream story renders with the wasm ready. The port's
// preview.ts does the same (`await ensureWasmLoaded()`), and the builder is
// additionally gated on the wasm here — it parses the expression through
// the wasm module on its very first render.
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/vue3';
import { type PropType, defineComponent, h, onMounted, ref } from 'vue';

import { ensureWasmLoaded, isWasmAvailable } from '../../../helpers/wasm';
import { type DictionaryMap, JdmConfigProvider } from '../../../theme';
import ExpressionBuilder, { type ExpressionBuilderProps } from './expression-builder.vue';

// The builder emits `update:modelValue`; the arg that stands in for
// upstream's `onChange` is declared here so the wrapper can forward it.
type BuilderArgs = ExpressionBuilderProps & {
  'onUpdate:modelValue'?: (value: string) => void;
};

const meta = {
  title: 'ExpressionBuilder',
  component: ExpressionBuilder,
  parameters: { layout: 'padded' },
  argTypes: {
    'modelValue': { type: 'string' },
    'disabled': { type: 'boolean' },
    'fieldType': { control: { type: 'object' } },
    'onUpdate:modelValue': { table: { disable: true } },
  },
  args: {
    'disabled': false,
    'modelValue': '',
    'onUpdate:modelValue': action('update:modelValue'),
  },
} satisfies Meta<typeof ExpressionBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

// PORTING: see the module-level note — the builder's first render parses the
// expression through the Zen wasm module, which is unusable until
// `ensureWasmLoaded()` resolves.
const WasmGate = defineComponent({
  name: 'WasmGate',
  setup(_, { slots }) {
    const ready = ref(isWasmAvailable());
    onMounted(() => {
      if (ready.value) {
        return;
      }

      void ensureWasmLoaded().then(() => {
        ready.value = true;
      });
    });

    return () => (ready.value ? slots.default?.() : null);
  },
});

// upstream: the Wrapper keeps the value in React state and echoes it back
// under the builder. PORTING: upstream's Wrapper and DictWrapper are the
// same component with and without a dictionaries provider, so they are merged
// here into one wrapper with an optional `dictionaries` prop.
const Wrapper = defineComponent({
  name: 'ExpressionBuilderWrapper',
  props: {
    args: { type: Object as PropType<BuilderArgs>, required: true },
    initialValue: { type: String, default: '' },
    dictionaries: { type: Object as PropType<DictionaryMap>, default: undefined },
  },
  setup(props) {
    const value = ref(props.initialValue);

    return () =>
      h(WasmGate, null, {
        default: () => {
          const content = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
            h(ExpressionBuilder, {
              ...props.args,
              'modelValue': value.value,
              // PORTING: upstream's Wrapper shadows the story's `onChange`
              // with its own `setValue`; here the state update shadows the
              // story's action, which is still called so the Actions panel
              // keeps logging the change.
              'onUpdate:modelValue': (next: string) => {
                value.value = next;
                props.args['onUpdate:modelValue']?.(next);
              },
            }),
            h('div', { style: { fontFamily: 'monospace', fontSize: '12px', color: '#666' } }, [
              `Expression: ${value.value || '(empty)'}`,
            ]),
          ]);

          return props.dictionaries
            ? h(JdmConfigProvider, { dictionaries: props.dictionaries }, { default: () => content })
            : content;
        },
      });
  },
});

export const AutoType: Story = {
  render: (args) => h(Wrapper, { args, initialValue: '' }),
};

export const StringType: Story = {
  args: { fieldType: { type: 'string' } },
  render: (args) => h(Wrapper, { args, initialValue: '"hello"' }),
};

export const NumberType: Story = {
  args: { fieldType: { type: 'number' } },
  render: (args) => h(Wrapper, { args, initialValue: '42' }),
};

export const BooleanType: Story = {
  args: { fieldType: { type: 'boolean' } },
  render: (args) => h(Wrapper, { args, initialValue: 'true' }),
};

export const DateType: Story = {
  args: { fieldType: { type: 'date' } },
  render: (args) => h(Wrapper, { args, initialValue: 'd($).isAfter("2024-01-01")' }),
};

export const EnumType: Story = {
  args: {
    fieldType: {
      type: 'string',
      enum: {
        type: 'inline',
        values: [
          { label: 'Pending', value: 'pending' },
          { label: 'Processing', value: 'processing' },
          { label: 'Shipped', value: 'shipped' },
          { label: 'Delivered', value: 'delivered' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
    },
  },
  render: (args) => h(Wrapper, { args, initialValue: '"pending"' }),
};

const DICTIONARIES: DictionaryMap = {
  orderStatus: [
    { label: 'Pending', value: 'pending' },
    { label: 'Processing', value: 'processing' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ],
  country: [
    { label: 'United States', value: 'us' },
    { label: 'Canada', value: 'ca' },
    { label: 'Mexico', value: 'mx' },
  ],
};

export const DictionaryEnum: Story = {
  args: {
    fieldType: {
      type: 'string',
      enum: { type: 'ref', ref: 'orderStatus' },
    },
  },
  render: (args) => h(Wrapper, { args, initialValue: '"pending"', dictionaries: DICTIONARIES }),
};

export const DictionaryEnumLoose: Story = {
  args: {
    fieldType: {
      type: 'string',
      enum: { type: 'ref', ref: 'country', loose: true },
    },
  },
  render: (args) => h(Wrapper, { args, initialValue: '"us"', dictionaries: DICTIONARIES }),
};

export const InlineEnumLoose: Story = {
  args: {
    fieldType: {
      type: 'string',
      enum: {
        type: 'inline',
        loose: true,
        values: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
  },
  render: (args) => h(Wrapper, { args, initialValue: '"sm"' }),
};

export const DateWithGranularity: Story = {
  args: { fieldType: { type: 'date' } },
  render: (args) => h(Wrapper, { args, initialValue: 'd($).isSame("2024-06-15", "month")' }),
};

export const TimeComparison: Story = {
  args: { fieldType: { type: 'date' } },
  render: (args) => h(Wrapper, { args, initialValue: 'd($).hour() * 60 + d($).minute() > 9 * 60 + 0' }),
};

export const DayOfWeek: Story = {
  args: { fieldType: { type: 'date' } },
  render: (args) => h(Wrapper, { args, initialValue: 'd($).weekday() in [1, 2, 3, 4, 5]' }),
};

export const Quarter: Story = {
  args: { fieldType: { type: 'date' } },
  render: (args) => h(Wrapper, { args, initialValue: 'd($).quarter() in [1, 2]' }),
};

export const Interval: Story = {
  args: { fieldType: { type: 'number' } },
  render: (args) => h(Wrapper, { args, initialValue: '[10..100]' }),
};

export const CustomExpression: Story = {
  render: (args) => h(Wrapper, { args, initialValue: '$ > 10 and $ < 100' }),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => h(Wrapper, { args, initialValue: '"hello"' }),
};
