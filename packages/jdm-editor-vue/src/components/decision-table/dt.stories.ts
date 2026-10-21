// Ported from components/decision-table/dt.stories.tsx — upstream's React
// (CSF2) story becomes a Vue 3 CSF3 story with render functions.
//
// PORTING: upstream's `fn()` from @storybook/test → `action()` from
// @storybook/addon-actions (@storybook/test is not a dependency of this port).
// PORTING: upstream's public `value`/`onChange` → `modelValue` /
// `update:modelValue` (v-model) per docs/PORTING.md's React → Vue table, so
// upstream's `onChange: fn()` arg becomes an `action('onChange')` wired to
// the `update:modelValue` emit in each story.
// PORTING: upstream's react-dnd `manager` prop (DragDropManager) is a
// deprecated accept-and-ignore stub here (row reordering is
// vue-draggable-plus), so the story does not pass it.
// PORTING: upstream's `cellRenderer` render prop → the port's `#cell` slot
// (docs/PORTING.md's render-props → slots rule); dt.vue adapts the slot onto
// the component's `cellRenderer` prop.
import { action } from '@storybook/addon-actions';
import type { ComponentPropsAndSlots, Meta, StoryObj } from '@storybook/vue3';
import { type PropType, defineComponent, h, ref, watch } from 'vue';

import type { SchemaSelectProps } from '../../helpers/components';
import type { DictionaryMap } from '../../theme';
import { JdmConfigProvider } from '../../theme';
import Checkbox from '../ui/Checkbox.vue';
import type { DecisionTableType, TableCellProps } from './context/dt-store.context';
import DecisionTable from './dt.vue';

const shippingFeesDefault: DecisionTableType = {
  hitPolicy: 'first',
  inputs: [
    {
      id: 'HVo_JpALi8',
      field: 'cart.weight',
      name: 'Cart Weight (Kg)',
    },
    {
      id: 'HW6mSVfLbs',
      field: 'customer.country',
      name: 'Customer Country',
    },
  ],
  outputs: [
    {
      field: 'shippingFee',
      id: '3EGDrV0ssV',
      name: 'Shipping Fee',
    },
  ],
  rules: [
    {
      '_id': 'qMpJEvcau6',
      '_description': 'If weight is above 40kg and country is US, fee is 40',
      'HVo_JpALi8': '> 40',
      'HW6mSVfLbs': '"US"',
      '3EGDrV0ssV': '40',
    },
    {
      '_id': 'KC6KqcWiOX',
      '_description': 'If weight is above 40kg and any other country, fee is 50',
      'HVo_JpALi8': '> 40',
      'HW6mSVfLbs': '',
      '3EGDrV0ssV': '50',
    },
    {
      '_id': 'k-zEFSTe7b',
      '_description': 'if weight is between 20 and 40kg and country US, fee is 30',
      'HVo_JpALi8': '[20..40]',
      'HW6mSVfLbs': '"US"',
      '3EGDrV0ssV': '30',
    },
    {
      '_id': 'c_8VkmGZ_C',
      '_description': 'if weight is between 20 and 40kg and any other country, fee is 32',
      'HVo_JpALi8': '[20..40]',
      'HW6mSVfLbs': '',
      '3EGDrV0ssV': '32',
    },
    {
      '_id': 'e_MyQeTS3V',
      '_description': 'if weight is bellow 20kg and country US, fee is 25',
      'HVo_JpALi8': '< 20',
      'HW6mSVfLbs': '"US"',
      '3EGDrV0ssV': '25',
    },
    {
      '_id': '_iU8FNLxHb',
      '_description': 'if weight is bellow 20kg, fee is 30',
      'HVo_JpALi8': '< 20',
      'HW6mSVfLbs': '',
      '3EGDrV0ssV': '30',
    },
  ],
};

const inputSchemaDefault: SchemaSelectProps[] = [
  {
    field: 'cart',
    name: 'Cart',
    items: [
      {
        field: 'cart.total',
        name: 'Total',
      },
      {
        field: 'cart.weight',
        name: 'Weight',
      },
    ],
  },
  {
    field: 'customer',
    name: 'Customer',
    items: [
      {
        field: 'customer.country',
        name: 'Country',
      },
    ],
  },
];

const stressRules = (): Record<string, string>[] => {
  const rules: Record<string, string>[] = [];

  for (let i = 10_000; i > 0; i--) {
    rules.push({
      '_id': `${i}`,
      '_description': `${i} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
      'HVo_JpALi8': `> ${i}`,
      'HW6mSVfLbs': '"US"',
      '3EGDrV0ssV': `${i}`,
    });
  }

  return rules;
};

// PORTING: upstream builds the stress table inside the story's useState
// initializer (once per mount); here it is built once at module scope so a
// story re-render does not regenerate 10k rules.
const stressTable: DecisionTableType = {
  ...shippingFeesDefault,
  rules: stressRules(),
};

const DICTIONARIES: DictionaryMap = {
  country: [
    { label: 'United States', value: 'US' },
    { label: 'Canada', value: 'CA' },
    { label: 'Mexico', value: 'MX' },
    { label: 'United Kingdom', value: 'UK' },
  ],
  orderStatus: [
    { label: 'Pending', value: 'pending' },
    { label: 'Processing', value: 'processing' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ],
};

const shippingFeesWithDictionaries: DecisionTableType = {
  ...shippingFeesDefault,
  inputs: [
    {
      id: 'HVo_JpALi8',
      field: 'cart.weight',
      name: 'Cart Weight (Kg)',
      fieldType: { type: 'number' },
    },
    {
      id: 'HW6mSVfLbs',
      field: 'customer.country',
      name: 'Customer Country',
      fieldType: { type: 'string', enum: { type: 'ref', ref: 'country' } },
    },
  ],
};

// PORTING: upstream sizes the story wrapper with `height: '100%'`, which
// resolves against Storybook's auto-height canvas to an auto height — the
// virtualised table needs a definite height, so the wrapper gets a fixed
// pixel height (the table's own `tableHeight` stays '100%').
const TABLE_WRAPPER_STYLE = { height: '600px' };

const onChangeAction = action('onChange');

const meta = {
  title: 'Decision Table',
  component: DecisionTable,
  argTypes: {
    permission: {
      control: 'select',
      options: ['edit:full', 'edit:rules', 'edit:values'],
    },
    mode: {
      control: 'select',
      options: ['dev', 'business'],
    },
    disabled: { control: 'boolean' },
    cellRenderer: {
      control: false,
    },
  },
  args: {
    inputsSchema: inputSchemaDefault,
    permission: 'edit:full',
    mode: 'dev',
    disabled: false,
    // PORTING: upstream sets `tableHeight='100%'` on every rendered table;
    // the port's `tableHeight` is a required prop, so it lives in the meta
    // args (each story still pins it to '100%' when it renders).
    tableHeight: '100%',
  },
} satisfies Meta<typeof DecisionTable>;

export default meta;

type Story = StoryObj<typeof meta>;

type DecisionTableArgs = ComponentPropsAndSlots<typeof DecisionTable>;

// upstream: the Controlled / CustomRenderer / StressTest / BusinessMode
// stories keep the table in React state; upstream's `useState` becomes a
// `ref` in this small host component, which feeds the port's `modelValue`
// and listens to `update:modelValue`.
const ControlledHost = defineComponent({
  name: 'ControlledHost',
  props: {
    args: { type: Object as PropType<DecisionTableArgs>, required: true },
    initialValue: { type: Object as PropType<DecisionTableType | undefined>, default: undefined },
  },
  setup(props, { slots }) {
    const value = ref<DecisionTableType | undefined>(props.initialValue);

    // upstream: useEffect(() => { if (args.value) setValue(args.value) }, [args.value])
    watch(
      () => props.args.modelValue,
      (next) => {
        if (next) {
          value.value = next;
        }
      },
    );

    return () =>
      h(
        DecisionTable,
        {
          ...props.args,
          'modelValue': value.value,
          'tableHeight': '100%',
          'onUpdate:modelValue': (next: DecisionTableType | undefined) => {
            value.value = next;
            onChangeAction(next);
          },
        },
        slots,
      );
  },
});

export const Controlled: Story = {
  render: (args) =>
    h('div', { style: TABLE_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: shippingFeesDefault })]),
};

export const Uncontrolled: Story = {
  render: (args) =>
    h('div', { style: TABLE_WRAPPER_STYLE }, [
      h(DecisionTable, {
        ...args,
        'defaultValue': shippingFeesDefault,
        'tableHeight': '100%',
        'onUpdate:modelValue': (next: DecisionTableType | undefined) => {
          onChangeAction(next);
        },
      }),
    ]),
};

// upstream's `cellRenderer` render prop → the port's `#cell` slot.
const cellSlot = (cellProps: TableCellProps) => {
  if (cellProps.column?.field !== 'output') {
    return [];
  }

  return [
    h('div', { tabIndex: 1, style: { paddingLeft: '1rem' } }, [
      h(
        Checkbox,
        {
          'disabled': cellProps.disabled,
          'modelValue': cellProps.value === 'true',
          'onUpdate:modelValue': (checked: boolean) => cellProps.onChange(`${checked}`),
        },
        { default: () => 'Enabled' },
      ),
    ]),
  ];
};

export const CustomRenderer: Story = {
  render: (args) => h('div', { style: TABLE_WRAPPER_STYLE }, [h(ControlledHost, { args }, { cell: cellSlot })]),
};

export const StressTest: Story = {
  render: (args) => h('div', { style: TABLE_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: stressTable })]),
};

export const BusinessMode: Story = {
  args: {
    mode: 'business',
  },
  render: (args) =>
    h('div', { style: TABLE_WRAPPER_STYLE }, [h(ControlledHost, { args, initialValue: shippingFeesDefault })]),
};

export const BusinessModeDictionaries: Story = {
  args: {
    mode: 'business',
  },
  render: (args) =>
    h(
      JdmConfigProvider,
      { dictionaries: DICTIONARIES },
      {
        default: () =>
          h('div', { style: TABLE_WRAPPER_STYLE }, [
            h(ControlledHost, { args, initialValue: shippingFeesWithDictionaries }),
          ]),
      },
    ),
};
