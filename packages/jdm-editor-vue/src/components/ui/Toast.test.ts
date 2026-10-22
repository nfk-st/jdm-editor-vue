// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { ToastProvider } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import Toast from './Toast.vue';
import { useToast } from './toast';

const ToastTrigger = defineComponent({
  setup() {
    const toast = useToast();
    return () => h('button', { onClick: () => toast.success('Saved') }, 'Show toast');
  },
});

const Harness = defineComponent({
  setup() {
    return () =>
      h(
        ToastProvider,
        { duration: 0 },
        {
          default: () => [h(Toast), h(ToastTrigger)],
        },
      );
  },
});

describe('ui/Toast', () => {
  it('shows a status message emitted by a child component', async () => {
    const wrapper = mount(Harness, { attachTo: document.body });

    await wrapper.get('button').trigger('click');
    await nextTick();

    const toast = document.querySelector('.grl-toast');
    expect(toast?.textContent).toContain('Saved');
    expect(toast?.getAttribute('data-status')).toBe('success');

    wrapper.unmount();
  });
});
