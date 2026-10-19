// @vitest-environment jsdom
// Logic-core coverage for the expression module store + controller bridge
// (PORTING.md testing rule — module #5).
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { createExpression, createExpressionStore } from './context/expression-store.context';
import type { ExpressionEntry } from './context/expression-store.context';
import Expression from './expression.vue';
import type { ExpressionProps } from './expression.vue';

describe('createExpression', () => {
  it('builds an entry with defaults and a uuid', () => {
    const entry = createExpression();
    expect(entry.key).toBe('');
    expect(entry.value).toBe('');
    expect(entry.id).toMatch(/[0-9a-f-]{36}/i);
  });

  it('applies partial data over defaults', () => {
    expect(createExpression({ key: 'k' })).toMatchObject({ key: 'k', value: '' });
  });
});

describe('expression store', () => {
  const seed = (): ExpressionEntry[] => [
    { id: 'a', key: 'first', value: '1' },
    { id: 'b', key: 'second', value: '2' },
    { id: 'c', key: 'third', value: '3' },
  ];

  it('addRowAbove inserts at index (default 0)', () => {
    const store = createExpressionStore();
    store.setExpressions(seed());
    store.addRowAbove(1);
    expect(store.expressions.map((e) => e.key)).toEqual(['first', '', 'second', 'third']);
    store.addRowAbove();
    expect(store.expressions[0].key).toBe('');
  });

  it('addRowBelow inserts after index (default last)', () => {
    const store = createExpressionStore();
    store.setExpressions(seed());
    store.addRowBelow(0);
    expect(store.expressions.map((e) => e.key)).toEqual(['first', '', 'second', 'third']);
    store.addRowBelow();
    expect(store.expressions.at(-1)?.key).toBe('');
  });

  it('swapRows moves an entry', () => {
    const store = createExpressionStore();
    store.setExpressions(seed());
    store.swapRows(2, 0);
    expect(store.expressions.map((e) => e.key)).toEqual(['third', 'first', 'second']);
  });

  it('removeRow splices by index', () => {
    const store = createExpressionStore();
    store.setExpressions(seed());
    store.removeRow(1);
    expect(store.expressions.map((e) => e.key)).toEqual(['first', 'third']);
  });

  it('updateRow merges without touching the id', () => {
    const store = createExpressionStore();
    store.setExpressions(seed());
    store.updateRow(1, { key: 'renamed' });
    expect(store.expressions[1]).toMatchObject({ id: 'b', key: 'renamed', value: '2' });
  });

  it('setState merges and subscribe fires with a prev snapshot preserving refs', () => {
    const store = createExpressionStore();
    store.setExpressions(seed());
    const initial = store.expressions;

    const seen: Array<{ cur: ExpressionEntry[]; prev: ExpressionEntry[] }> = [];
    store.subscribe((state, prevState) => seen.push({ cur: state.expressions, prev: prevState.expressions }));

    store.setState({ disabled: true });
    // unchanged expressions → same ref on both sides
    expect(seen.at(-1)?.cur).toBe(seen.at(-1)?.prev);
    expect(seen.at(-1)?.cur).toBe(initial);

    store.updateRow(0, { value: 'changed' });
    expect(seen.at(-1)?.cur).not.toBe(seen.at(-1)?.prev);
    expect(seen.at(-1)?.prev).toBe(initial);
  });

  it('subscribe returns an unsubscribe function', () => {
    const store = createExpressionStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.setState({ debugIndex: 1 });
    expect(fn).toHaveBeenCalled();
    off();
    store.setState({ debugIndex: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('ExpressionCommandBar (via mounted Expression)', () => {
  const debug = {
    snapshot: {},
    trace: { traceData: [{ a: 1 }, { b: 2 }] },
  } as unknown as NonNullable<ExpressionProps['debug']>;

  it('renders nothing without trace data', () => {
    const wrapper = mount(Expression, { props: { modelValue: [] } });
    expect(wrapper.find('.grl-dt__command-bar').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders one option per trace and selects index 0 by default', async () => {
    const wrapper = mount(Expression, { props: { modelValue: [], debug }, attachTo: document.body });
    await nextTick();
    const bar = wrapper.find('.grl-dt__command-bar');
    expect(bar.exists()).toBe(true);
    expect(bar.text()).toContain('Simulation index:');

    // reka opens on keyboard; count portal items
    await bar.find('.grl-select').trigger('keydown', { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.querySelectorAll('.grl-select__item')).toHaveLength(2);
    wrapper.unmount();
  });

  it('round-trips a selection through debugIndex (string option ↔ number state)', async () => {
    const wrapper = mount(Expression, { props: { modelValue: [], debug }, attachTo: document.body });
    await nextTick();
    const select = wrapper.find('.grl-dt__command-bar').find('.grl-select');
    expect(select.text()).toBe('0');

    const root = wrapper.findComponent({ name: 'SelectRoot' });
    root.vm.$emit('update:modelValue', '1');
    await nextTick();
    // debugIndex=1 → selectedIndex '1' renders in the trigger
    expect(wrapper.find('.grl-dt__command-bar').find('.grl-select').text()).toBe('1');
    wrapper.unmount();
  });

  it('falls back to index 0 when debugIndex exceeds the trace length', async () => {
    const wrapper = mount(Expression, { props: { modelValue: [], debug }, attachTo: document.body });
    await nextTick();
    const root = wrapper.findComponent({ name: 'SelectRoot' });
    root.vm.$emit('update:modelValue', '9');
    await nextTick();
    // onSelect stores 9; selectedIndex guard maps out-of-range back to '0'
    expect(wrapper.find('.grl-dt__command-bar').find('.grl-select').text()).toBe('0');
    wrapper.unmount();
  });
});

// Accepted coverage gaps (jsdom): the wasm-gated variableType loop in
// expression-list (isWasmAvailable() early-returns) and Sortable's drag
// callbacks (real pointer events required) are exercised manually in the
// playground instead.

describe('Expression (integration)', () => {
  it('renders rows from modelValue and emits update:modelValue when rows change', async () => {
    const wrapper = mount(Expression, {
      props: {
        modelValue: [
          { id: 'a', key: 'k', value: 'v' },
          { id: 'b', key: 'k2', value: 'v2' },
        ],
      },
      attachTo: document.body,
    });

    // heading + 2 rows
    expect(wrapper.findAll('.expression-list__item')).toHaveLength(3);

    await wrapper.find('.expression-list__button').trigger('click');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted?.at(-1)?.[0]).toHaveLength(3);

    wrapper.unmount();
  });
});
