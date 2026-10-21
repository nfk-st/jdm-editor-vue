// PORTING: upstream has no story for the ui/ primitives — there they are
// antd's own components, and antd's own Storybook is not part of this port.
// The port's primitives ARE its own components, and the pre-ship review's
// remaining claims about them (the Button's loading state, the multi-select
// chip's remove control) are only checkable with a surface that renders
// them. This story is that surface — it is additive, like
// `expression--disabled` and `expression--read-only`.
import type { Meta, StoryObj } from '@storybook/vue3';
import { Trash2 } from 'lucide-vue-next';
import { defineComponent, h, ref } from 'vue';

import Button from './Button.vue';
import MultiSelect from './MultiSelect.vue';
import Switch from './Switch.vue';

const meta = {
  title: 'UI',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const ButtonStatesHost = defineComponent({
  name: 'ButtonStatesHost',
  setup() {
    return () =>
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            padding: '24px',
          },
        },
        [
          h(Button, {}, { default: () => 'Default' }),
          h(Button, { type: 'primary' }, { default: () => 'Primary' }),
          h(Button, { type: 'primary', danger: true }, { default: () => 'Danger primary' }),
          h(Button, { type: 'text' }, { default: () => 'Text' }),
          h(Button, { type: 'link' }, { default: () => 'Link' }),
          h(Button, { size: 'small' }, { default: () => 'Small' }),
          h(
            Button,
            { type: 'primary', shape: 'round', danger: true },
            { icon: () => h(Trash2, { size: 14 }), default: () => 'Round' },
          ),
          h(Button, { disabled: true }, { default: () => 'Disabled' }),
          // antd's loading state: the variant's colours are kept and the
          // button dims to 0.65, the icon is REPLACED by the spinner, and
          // the click is swallowed.
          h(
            Button,
            { type: 'primary', loading: true },
            { icon: () => h(Trash2, { size: 14 }), default: () => 'Loading' },
          ),
        ],
      );
  },
});

export const ButtonStates: Story = {
  render: () => h(ButtonStatesHost),
};

const MultiSelectHost = defineComponent({
  name: 'MultiSelectHost',
  setup() {
    const value = ref(['alpha', 'beta']);

    return () =>
      h('div', { style: { padding: '24px', width: '360px' } }, [
        h(MultiSelect, {
          'modelValue': value.value,
          'options': [
            { label: 'Alpha', value: 'alpha' },
            { label: 'Beta', value: 'beta' },
            { label: 'Gamma', value: 'gamma' },
          ],
          'onUpdate:modelValue': (next: string[]) => {
            value.value = next;
          },
        }),
        h('div', { style: { height: '16px' } }),
        h(Switch, { modelValue: true }),
      ]);
  },
});

export const MultiSelectTags: Story = {
  render: () => h(MultiSelectHost),
};
