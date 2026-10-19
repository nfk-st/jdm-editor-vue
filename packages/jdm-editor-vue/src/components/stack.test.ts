// @vitest-environment jsdom
// Stack layout utility — px-unit regression (React appends px to numeric
// style values; Vue assigns raw numbers, which browsers ignore).
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Stack from './stack.vue';

describe('Stack', () => {
  it('appends px to numeric gap/height/width', () => {
    const wrapper = mount(Stack, { props: { gap: 8, height: 32, width: 240 } });
    const style = (wrapper.element as HTMLElement).style;
    expect(style.gap).toBe('8px');
    expect(style.height).toBe('32px');
    expect(style.width).toBe('240px');
  });

  it('passes string values through untouched', () => {
    const wrapper = mount(Stack, { props: { gap: '1rem', height: 'auto', width: '50%' } });
    const style = (wrapper.element as HTMLElement).style;
    expect(style.gap).toBe('1rem');
    expect(style.height).toBe('auto');
    expect(style.width).toBe('50%');
  });

  it('applies the flex mapping for horizontal stacks', () => {
    const wrapper = mount(Stack, {
      props: { horizontal: true, horizontalAlign: 'space-between', verticalAlign: 'center' },
    });
    const style = (wrapper.element as HTMLElement).style;
    expect(style.flexDirection).toBe('row');
    expect(style.justifyContent).toBe('space-between');
    expect(style.alignItems).toBe('center');
  });

  it('reverses direction and swaps justify/align for vertical stacks', () => {
    const wrapper = mount(Stack, { props: { reversed: true, verticalAlign: 'center', horizontalAlign: 'stretch' } });
    const style = (wrapper.element as HTMLElement).style;
    expect(style.flexDirection).toBe('column-reverse');
    expect(style.justifyContent).toBe('center');
    expect(style.alignItems).toBe('stretch');
  });

  it('lets a consumer style attr override computed styles (spread-last)', () => {
    const wrapper = mount(Stack, { attrs: { style: { gap: '2rem' } } });
    expect((wrapper.element as HTMLElement).style.gap).toBe('2rem');
  });
});
