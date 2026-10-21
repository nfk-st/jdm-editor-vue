// @vitest-environment jsdom
// The Button's class list.
//
// `grl-btn--default` is the TYPE class. The size and the shape used to
// emit the same class name for their defaults, so every button matched
// `.grl-btn--danger.grl-btn--default` — and a danger primary button
// rendered red text on a red background.
//
// The loading state is antd's, not the disabled one: antd dims the button
// (opacity 0.65), keeps the variant's colours, swaps the icon for the
// spinner and swallows the click.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Button from './Button.vue';

const classes = (props: Record<string, unknown>) => mount(Button, { props }).classes();

describe('Button classes', () => {
  it('does not emit grl-btn--default for the default size or shape', () => {
    const list = classes({ type: 'default' });

    expect(list).toContain('grl-btn--default');
    expect(list.filter((c) => c === 'grl-btn--default')).toHaveLength(1);
  });

  it('does not give a text button the default button class', () => {
    const list = classes({ type: 'text' });

    expect(list).toContain('grl-btn--text');
    expect(list).not.toContain('grl-btn--default');
  });

  it('emits the small and round modifiers', () => {
    expect(classes({ type: 'primary', size: 'small', shape: 'round' })).toEqual(
      expect.arrayContaining(['grl-btn--primary', 'grl-btn--small', 'grl-btn--round']),
    );
  });

  it('marks a danger button', () => {
    expect(classes({ type: 'primary', danger: true })).toContain('grl-btn--danger');
  });
});

describe('Button loading state', () => {
  it('is not the disabled state — antd dims the button and keeps its colours', () => {
    const wrapper = mount(Button, { props: { type: 'primary', loading: true } });

    expect(wrapper.classes()).toContain('grl-btn--loading');
    expect(wrapper.classes()).not.toContain('grl-btn--disabled');
    // antd renders `disabled={mergedDisabled}` — loading is not part of it,
    // so the button keeps its focusability and its hover states.
    expect(wrapper.attributes('disabled')).toBeUndefined();

    wrapper.unmount();
  });

  it('swallows the click, as antd’s handleClick does', async () => {
    const wrapper = mount(Button, { props: { loading: true } });

    // antd's button is NOT disabled while loading — the click is swallowed
    // by the handler, not by the disabled attribute.
    expect(wrapper.attributes('disabled')).toBeUndefined();
    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toBeUndefined();

    wrapper.unmount();
  });

  it('emits the click when it is not loading', async () => {
    const wrapper = mount(Button);

    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toHaveLength(1);

    wrapper.unmount();
  });

  it('replaces the icon with the spinner instead of rendering both', () => {
    const wrapper = mount(Button, {
      props: { loading: true },
      slots: { icon: '<span class="the-icon" />' },
    });

    expect(wrapper.find('.grl-btn__spinner').exists()).toBe(true);
    expect(wrapper.find('.grl-btn__icon').exists()).toBe(false);
    expect(wrapper.find('.the-icon').exists()).toBe(false);

    wrapper.unmount();
  });
});
