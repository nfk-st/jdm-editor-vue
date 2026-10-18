// @vitest-environment jsdom
// Smoke coverage for components/shared (view module — mount-level checks).
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DiffInput from './diff-input.vue';
import DiffRadio from './diff-radio.vue';
import DiffSelect from './diff-select.vue';
import DiffSwitch from './diff-switch.vue';
import DiffAutosizeTextArea from './diff-text-area.vue';

describe('DiffInput', () => {
  it('renders a single input when diff display is off', () => {
    const wrapper = mount(DiffInput, { props: { modelValue: 'current' } });
    expect(wrapper.findAll('input')).toHaveLength(1);
  });

  it('renders previous and current when displayDiff is on', () => {
    const wrapper = mount(DiffInput, {
      props: { modelValue: 'current', previousValue: 'before', displayDiff: true },
    });
    const inputs = wrapper.findAll('input');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].element.value).toBe('before');
    expect(inputs[1].element.value).toBe('current');
  });

  it('omits empty sides in diff mode', () => {
    const wrapper = mount(DiffInput, { props: { modelValue: 'current', displayDiff: true } });
    expect(wrapper.findAll('input')).toHaveLength(1);
  });

  it('emits update:modelValue on typing', async () => {
    const wrapper = mount(DiffInput, { props: { modelValue: '' } });
    await wrapper.find('input').setValue('hello');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['hello']);
  });
});

describe('DiffSwitch', () => {
  it('renders one switch normally', () => {
    const wrapper = mount(DiffSwitch, { props: { modelValue: true } });
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(1);
  });

  it('renders previous + arrow + current in diff mode', () => {
    const wrapper = mount(DiffSwitch, {
      props: { modelValue: false, previousChecked: true, displayDiff: true },
    });
    const switches = wrapper.findAll('[role="switch"]');
    expect(switches).toHaveLength(2);
    expect(switches[0].attributes('data-state')).toBe('checked');
    expect(switches[1].attributes('data-state')).toBe('unchecked');
  });
});

describe('DiffRadio', () => {
  const options = [
    { label: 'First', value: 'first' },
    { label: 'All', value: 'all' },
  ];

  it('tags removed and added options in diff mode', () => {
    const wrapper = mount(DiffRadio, {
      props: { modelValue: 'all', previousValue: 'first', displayDiff: true, options },
    });
    const labels = wrapper.findAll('.grl-radio');
    expect(labels[0].classes()).toContain('text-removed');
    expect(labels[1].classes()).toContain('text-added');
  });

  it('does not tag options when diff is off', () => {
    const wrapper = mount(DiffRadio, { props: { modelValue: 'all', options } });
    expect(wrapper.find('.grl-radio').classes()).not.toContain('text-added');
  });
});

describe('DiffSelect', () => {
  const options = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ];

  it('renders one trigger normally', () => {
    const wrapper = mount(DiffSelect, { props: { modelValue: 'a', options } });
    expect(wrapper.findAll('.grl-select')).toHaveLength(1);
  });

  it('renders previous (disabled) + arrow + current in diff mode', () => {
    const wrapper = mount(DiffSelect, {
      props: { modelValue: 'b', previousValue: 'a', displayDiff: true, options },
    });
    const triggers = wrapper.findAll('.grl-select');
    expect(triggers).toHaveLength(2);
    expect(triggers[0].attributes('data-disabled')).toBe('');
  });
});

describe('DiffAutosizeTextArea', () => {
  it('renders the autosize textarea with value', () => {
    const wrapper = mount(DiffAutosizeTextArea, { props: { modelValue: 'text', maxRows: 4 } });
    const el = wrapper.find('.grl-textarea-input');
    expect(el.exists()).toBe(true);
    expect(el.text()).toBe('text');
  });

  it('renders both sides in diff mode', () => {
    const wrapper = mount(DiffAutosizeTextArea, {
      props: { modelValue: 'new', previousValue: 'old', displayDiff: true },
    });
    const areas = wrapper.findAll('.grl-textarea-input');
    expect(areas).toHaveLength(2);
    expect(areas[0].text()).toBe('old');
    expect(areas[1].text()).toBe('new');
  });
});
