// @vitest-environment jsdom
// The excel dialog's dropdown footer.
//
// upstream's antd Select renders the "Enter field name" input in the
// dropdownRender footer — a plain input. antd's select has no typeahead, so
// the field name can be typed.
//
// reka-ui's SelectContent implements a typeahead: every single-character
// keypress searches the options (and moves the focus to the matching one),
// and a Space typed right after it is swallowed. The footer stops the
// keydown instead — Escape is let through, because reka's DismissableLayer
// listens for it on the window and stopping it would trap the dropdown open.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import type { ParsedExcelData } from '../../../helpers/excel';
import { NodeKind } from '../../../helpers/schema';
import GraphExcelDialog from './graph-excel-dialog.vue';

const excelData: ParsedExcelData[] = [
  {
    id: 'sheet-1',
    name: 'Sheet 1',
    type: NodeKind.DecisionTable,
    position: { x: 0, y: 0 },
    headers: [{ id: 'h-1', name: 'Amount', value: 'amount', _type: 'input' }],
    rules: [],
    existingTableData: { headers: [], hitPolicy: 'first' },
  },
];

const openTheSelect = async () => {
  const wrapper = mount(GraphExcelDialog, {
    props: { excelData, handleSuccess: () => {}, handleCancel: () => {} },
    attachTo: document.body,
  });
  await nextTick();

  // reka's trigger opens on Enter (its pointer path needs PointerEvent,
  // which jsdom does not implement). The dialog is portalled to the body.
  const trigger = document.body.querySelector('.grl-select');
  trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await nextTick();
  await nextTick();

  return wrapper;
};

const fieldNameInput = () => document.body.querySelector<HTMLInputElement>('input[placeholder="Enter field name"]');

describe('the excel dialog dropdown footer', () => {
  it('does not run the select typeahead on the field-name input', async () => {
    const wrapper = await openTheSelect();

    const input = fieldNameInput();
    expect(input).toBeTruthy();

    // The typeahead's tell: the first keypress starts a search, and the
    // Space that follows it is swallowed (reka's handleKeyDown prevents the
    // default when a search is active). With the footer's keydown stopped,
    // the Space is the input's own.
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
    const space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    input?.dispatchEvent(space);
    await nextTick();

    expect(space.defaultPrevented).toBe(false);

    wrapper.unmount();
  });

  it('lets the Escape key through, so the dropdown can still be closed', async () => {
    const wrapper = await openTheSelect();

    const footer = document.body.querySelector('.grl-graph-excel__dropdown-footer');
    expect(footer).toBeTruthy();

    const seen: string[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.key);
    window.addEventListener('keydown', listener);

    footer?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    window.removeEventListener('keydown', listener);
    expect(seen).toContain('Escape');

    wrapper.unmount();
  });
});
