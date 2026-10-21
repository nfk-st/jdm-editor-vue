// @vitest-environment jsdom
// The Button's class list.
//
// `grl-btn--default` is the TYPE class. The size and the shape used to
// emit the same class name for their defaults, so every button matched
// `.grl-btn--danger.grl-btn--default` — and a danger primary button
// rendered red text on a red background.
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
