// @vitest-environment jsdom
// ui/Select boundary behavior — empty-string option values (antd allows them;
// reka-ui rejects them; the sentinel mapping must keep them working) and
// label display for preset model values.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Select from './Select.vue';

describe('ui/Select empty-string options', () => {
  const options = [
    { label: 'Exact', value: '' },
    { label: 'Day', value: 'day' },
    { label: 'Month', value: 'month' },
  ];

  it('mounts without throwing with an empty-string option value', () => {
    expect(() => mount(Select, { props: { modelValue: 'day', options } })).not.toThrow();
  });

  it('maps the empty-string sentinel back to an empty string on select', async () => {
    const wrapper = mount(Select, { props: { modelValue: 'day', options } });
    // reka items select on real pointer events (unavailable in jsdom); drive
    // SelectRoot directly — the unit under test is OUR sentinel mapping.
    const root = wrapper.findComponent({ name: 'SelectRoot' });
    root.vm.$emit('update:modelValue', '__grl-empty__');
    await Promise.resolve();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['']);
    root.vm.$emit('update:modelValue', 'month');
    await Promise.resolve();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['month']);
    wrapper.unmount();
  });

  it('renders the option label (not the raw value) for a preset model value', () => {
    const wrapper = mount(Select, { props: { modelValue: '', options } });
    expect(wrapper.find('.grl-select').text()).toContain('Exact');
    wrapper.unmount();
  });

  it('renders the raw value when no matching option exists', () => {
    const wrapper = mount(Select, { props: { modelValue: 'unknown', options } });
    expect(wrapper.find('.grl-select__value').text()).toBe('unknown');
    wrapper.unmount();
  });
});
