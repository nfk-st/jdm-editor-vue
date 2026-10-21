// Ported from components/expression/expression.stories.tsx — the upstream
// story (CSF2 + React) becomes CSF3 with a Vue render function.
// PORTING: upstream's `fn()` from @storybook/test is `action()` from
// @storybook/addon-actions (that package is what addon-essentials pulls in;
// @storybook/test is not a dependency of this port).
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/vue3';
import { type PropType, defineComponent, h, ref } from 'vue';

import type { ExpressionEntry } from './context/expression-store.context';
import Expression from './expression.vue';

const expressionDefault: ExpressionEntry[] = [
  { id: '1', key: 'customer.fullName', value: 'customer.firstName + " " + customer.lastName' },
  { id: '2', key: 'customer.isPremium', value: 'contains(customer.tags, "premium")' },
  { id: '3', key: 'customer.purchaseTotals', value: 'sum(map(customer.purchases, #.amount))' },
];

const meta = {
  title: 'Expression',
  component: Expression,
  args: {
    disabled: false,
    defaultValue: expressionDefault,
    permission: 'edit:full',
  },
  argTypes: {
    permission: {
      control: 'select',
      options: ['edit:full', 'edit:values', 'view'],
    },
    manager: { table: { disable: true } },
    modelValue: { table: { disable: true } },
  },
} satisfies Meta<typeof Expression>;

export default meta;

type Story = StoryObj<typeof meta>;

// upstream: the Controlled story keeps the value in React state.
const ControlledHost = defineComponent({
  name: 'ControlledHost',
  props: {
    args: { type: Object as PropType<Record<string, unknown>>, required: true },
  },
  setup(props) {
    const value = ref<ExpressionEntry[]>(expressionDefault);

    return () =>
      h(Expression, {
        ...props.args,
        'modelValue': value.value,
        'onUpdate:modelValue': (next: ExpressionEntry[] | undefined) => {
          value.value = next ?? [];
        },
      });
  },
});

export const Uncontrolled: Story = {
  render: (args) => h('div', { style: { maxWidth: '900px' } }, [h(Expression, args)]),
};

export const Controlled: Story = {
  render: (args) => h('div', { style: { maxWidth: '900px' } }, [h(ControlledHost, { args })]),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => h('div', { style: { maxWidth: '900px' } }, [h(Expression, args)]),
};

export const ReadOnly: Story = {
  args: { permission: 'view' },
  render: (args) => h('div', { style: { maxWidth: '900px' } }, [h(Expression, args)]),
};
