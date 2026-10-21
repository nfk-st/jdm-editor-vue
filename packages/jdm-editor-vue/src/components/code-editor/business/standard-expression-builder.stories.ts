// Ported from components/code-editor/business/standard-expression-builder.stories.tsx
// — upstream's CSF2 + React story becomes CSF3 with a Vue render function.
// PORTING: upstream's `fn()` from @storybook/test is `action()` from
// @storybook/addon-actions (@storybook/test is not a dependency of this port).
// PORTING: upstream's `value`/`onChange` props become `modelValue` +
// `update:modelValue` (docs/PORTING.md's public-prop convention).
// PORTING: upstream's `.storybook/preview.tsx` awaits the Zen wasm at module
// scope, so every upstream story renders with the wasm ready. The port's
// preview.ts is shared by all stories and cannot await, so the builder is
// gated on the wasm being ready here — it parses the expression through the
// wasm module on its very first render.
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/vue3';
import { type PropType, defineComponent, h, onMounted, ref } from 'vue';

import { ensureWasmLoaded, isWasmAvailable } from '../../../helpers/wasm';
import StandardExpressionBuilder, { type StandardExpressionBuilderProps } from './standard-expression-builder.vue';

// The builder emits `update:modelValue`; the arg that stands in for
// upstream's `onChange` is declared here so the wrapper can forward it.
type BuilderArgs = StandardExpressionBuilderProps & {
  'onUpdate:modelValue'?: (value: string) => void;
};

const meta = {
  title: 'StandardExpressionBuilder',
  component: StandardExpressionBuilder,
  parameters: { layout: 'padded' },
  argTypes: {
    'modelValue': { type: 'string' },
    'disabled': { type: 'boolean' },
    'onUpdate:modelValue': { table: { disable: true } },
  },
  args: {
    'disabled': false,
    'modelValue': '',
    'onUpdate:modelValue': action('update:modelValue'),
  },
} satisfies Meta<typeof StandardExpressionBuilder>;

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
// under the builder.
const Wrapper = defineComponent({
  name: 'StandardExpressionBuilderWrapper',
  props: {
    args: { type: Object as PropType<BuilderArgs>, required: true },
    initialValue: { type: String, default: '' },
  },
  setup(props) {
    const value = ref(props.initialValue);

    return () =>
      h(WasmGate, null, {
        default: () =>
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
            h('div', { style: { width: '300px', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '8px' } }, [
              h(StandardExpressionBuilder, {
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
            ]),
            h('div', { style: { fontFamily: 'monospace', fontSize: '12px', color: '#666' } }, [
              `Value: ${value.value || '(empty)'}`,
            ]),
          ]),
      });
  },
});

export const Auto: Story = {
  args: { fieldType: { type: 'auto' } },
  render: (args) => h(Wrapper, { args, initialValue: 'customer.discount * 0.1' }),
};

export const StringType: Story = {
  args: { fieldType: { type: 'string' } },
  render: (args) => h(Wrapper, { args, initialValue: '"Hello World"' }),
};

export const StringEnum: Story = {
  args: {
    fieldType: {
      type: 'string',
      enum: {
        type: 'inline',
        values: [
          { label: 'United States', value: 'us' },
          { label: 'Canada', value: 'ca' },
          { label: 'Mexico', value: 'mx' },
        ],
      },
    },
  },
  render: (args) => h(Wrapper, { args, initialValue: '"us"' }),
};

export const StringArrayType: Story = {
  args: { fieldType: { type: 'string-array' } },
  render: (args) => h(Wrapper, { args, initialValue: '["tag1", "tag2"]' }),
};

export const StringArrayEnum: Story = {
  args: {
    fieldType: {
      type: 'string-array',
      enum: {
        type: 'inline',
        values: [
          { label: 'Red', value: 'red' },
          { label: 'Green', value: 'green' },
          { label: 'Blue', value: 'blue' },
        ],
      },
    },
  },
  render: (args) => h(Wrapper, { args, initialValue: '["red", "blue"]' }),
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
  render: (args) => h(Wrapper, { args, initialValue: "d('2024-06-15')" }),
};

export const ExpressionMode: Story = {
  args: { fieldType: { type: 'number' } },
  render: (args) => h(Wrapper, { args, initialValue: 'price * quantity' }),
};

export const Disabled: Story = {
  args: { disabled: true, fieldType: { type: 'string' } },
  render: (args) => h(Wrapper, { args, initialValue: '"Disabled"' }),
};
