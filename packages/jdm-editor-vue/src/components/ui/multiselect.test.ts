// @vitest-environment jsdom
// ui/MultiSelect's chip remove control.
//
// rc-select renders the tag's remove control as a TransBtn — a SPAN, not a
// button: it is not focusable and it is aria-hidden. The port rendered a
// focusable <button>, so every chip added a tab stop to the page, and it
// painted the icon in the text-secondary colour instead of antd's colorIcon
// (0.45).
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MultiSelect from './MultiSelect.vue';

const mountSelect = (modelValue: string[] = ['a', 'b']) =>
  mount(MultiSelect, {
    props: {
      modelValue,
      options: [
        { label: 'Alpha', value: 'a' },
        { label: 'Beta', value: 'b' },
      ],
    },
  });

describe('ui/MultiSelect chip remove', () => {
  it('renders the remove control as a non-focusable span, not a button', () => {
    const wrapper = mountSelect();

    const removes = wrapper.findAll('.grl-multiselect__chip-remove');
    expect(removes).toHaveLength(2);
    for (const remove of removes) {
      expect(remove.element.tagName).toBe('SPAN');
      expect(remove.attributes('aria-hidden')).toBe('true');
      // a button would be a tab stop; a span is not focusable at all
      expect(remove.attributes('tabindex')).toBeUndefined();
    }

    wrapper.unmount();
  });

  it('still removes the value when the control is clicked', async () => {
    const wrapper = mountSelect(['a', 'b']);

    await wrapper.findAll('.grl-multiselect__chip-remove')[0].trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['b']]);

    wrapper.unmount();
  });

  it('renders no remove control when the select is disabled', () => {
    const wrapper = mount(MultiSelect, {
      props: {
        modelValue: ['a'],
        disabled: true,
        options: [{ label: 'Alpha', value: 'a' }],
      },
    });

    expect(wrapper.findAll('.grl-multiselect__chip-remove')).toHaveLength(0);

    wrapper.unmount();
  });
});
