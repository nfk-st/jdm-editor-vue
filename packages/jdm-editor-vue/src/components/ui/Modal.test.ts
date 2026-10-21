// @vitest-environment jsdom
// The Modal's confirm autofocus and the Tooltip's content guard.
//
// Both are regressions from the pre-ship fixes: a template ref on reka's
// DialogContent exposes the COMPONENT's props plus $el (useForwardExpose),
// so `ref.value.querySelector` is not a function — the autofocus threw and
// nothing was focused. And antd's Tooltip with no title never opens.
import { mount } from '@vue/test-utils';
import { TooltipRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import Modal from './Modal.vue';
import Tooltip from './Tooltip.vue';

const tick = async () => {
  await nextTick();
  await nextTick();
};

describe('Modal', () => {
  it('focuses the OK button when it is a confirm', async () => {
    const wrapper = mount(Modal, {
      props: { open: true, confirm: true, title: 'Delete node' },
      slots: {
        default: '<p>body</p>',
        footer: '<button class="cancel">Cancel</button><button class="ok">Delete</button>',
      },
      attachTo: document.body,
    });
    await tick();

    const ok = document.querySelector('.grl-modal__footer .ok') as HTMLElement | null;
    expect(ok).not.toBeNull();
    expect(document.activeElement).toBe(ok);

    wrapper.unmount();
  });

  it('does not throw when it opens', async () => {
    const wrapper = mount(Modal, {
      props: { open: true, title: 'Delete node' },
      slots: { default: '<p>body</p>' },
      attachTo: document.body,
    });
    await tick();

    expect(document.querySelector('.grl-modal')).not.toBeNull();

    wrapper.unmount();
  });
});

describe('Tooltip', () => {
  it('stays closed when it has no content', () => {
    const wrapper = mount(Tooltip, { props: { content: undefined }, slots: { default: '<span>x</span>' } });

    expect(wrapper.findComponent(TooltipRoot).props('disabled')).toBe(true);

    wrapper.unmount();
  });

  it('opens when it has content', () => {
    const wrapper = mount(Tooltip, { props: { content: 'hi' }, slots: { default: '<span>x</span>' } });

    expect(wrapper.findComponent(TooltipRoot).props('disabled')).toBe(false);

    wrapper.unmount();
  });
});
