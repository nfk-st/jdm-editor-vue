// @vitest-environment jsdom
// Logic-core coverage for the decision-table module (PORTING.md testing
// rule): the store actions the table drives (rule-cursor interactions),
// column-sizing persistence, the pure virtualizer padding math, and the
// header-kind matchers — plus a jsdom smoke mount of Table through the
// provider.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import { DecisionTableProvider, parseDecisionTable } from '../context/dt-store.context';
import { createDecisionTableStoreBundle } from '../context/dt-store.context';
import { getParentKind, getSelfKind } from './table-head-row.vue';
import Table, { columnSizeKey, computeVirtualPadding, loadColumnSizing } from './table.vue';

// vitest's jsdom environment ships a non-functional localStorage global
// (empty object, no Storage prototype) — stub it for the persistence tests.
const localStorageBacking: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageBacking[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageBacking[key] = String(value);
  },
  removeItem: (key: string) => {
    delete localStorageBacking[key];
  },
  clear: () => {
    for (const key of Object.keys(localStorageBacking)) {
      delete localStorageBacking[key];
    }
  },
});

afterEach(() => {
  // clear the backing map directly — jsdom's localStorage global can be a
  // stub that loses methods depending on environment restore order
  for (const key of Object.keys(localStorageBacking)) {
    delete localStorageBacking[key];
  }
});

const seedTable = () =>
  parseDecisionTable({
    hitPolicy: 'first',
    inputs: [
      { id: 'in-1', name: 'Input 1', field: 'input1' },
      { id: 'in-2', name: 'Input 2', field: 'input2' },
    ],
    outputs: [{ id: 'out-1', name: 'Output 1', field: 'output1' }],
    rules: [
      { '_id': 'r1', 'in-1': 'a', 'out-1': 'x' },
      { '_id': 'r2', 'in-1': 'b', 'out-1': 'y' },
      { '_id': 'r3', 'in-1': 'c', 'out-1': 'z' },
    ],
  });

describe('decision-table store: rule-cursor interactions', () => {
  const makeStore = () => {
    const bundle = createDecisionTableStoreBundle();
    bundle.stateStore.setState({ decisionTable: seedTable() });
    return bundle;
  };

  it('commitData writes the cell under the cursor and fires onChange', () => {
    const { stateStore, listenerStore, actions } = makeStore();
    const onChange = vi.fn();
    listenerStore.setState({ onChange });

    actions.setCursor({ x: 'in-1', y: 1 });
    actions.commitData('edited', { x: 'in-1', y: 1 });

    expect(stateStore.getState().decisionTable.rules[1]['in-1']).toBe('edited');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(stateStore.getState().decisionTable);
    expect(stateStore.getState().cursor).toEqual({ x: 'in-1', y: 1 });
  });

  it('addRowAbove shifts the cursor when inserting above it', () => {
    const { stateStore, actions } = makeStore();
    actions.setCursor({ x: 'in-1', y: 2 });
    actions.addRowAbove(2);

    const state = stateStore.getState();
    expect(state.decisionTable.rules).toHaveLength(4);
    expect(state.decisionTable.rules[2]['in-1']).toBe(''); // fresh row
    expect(state.cursor).toEqual({ x: 'in-1', y: 3 }); // pushed down
  });

  it('addRowBelow shifts the cursor up when it sits on the insert position', () => {
    // upstream quirk kept 1:1: the produce recipe's `target += 1` mutates the
    // outer variable, so the cursor shifts only when cursor.y === target + 1
    const { stateStore, actions } = makeStore();
    actions.setCursor({ x: 'out-1', y: 2 });
    actions.addRowBelow(1);

    const state = stateStore.getState();
    expect(state.decisionTable.rules).toHaveLength(4);
    expect(state.decisionTable.rules[2]['in-1']).toBe('');
    expect(state.cursor).toEqual({ x: 'out-1', y: 1 });
  });

  it('addRowBelow defaults to appending at the end', () => {
    const { stateStore, actions } = makeStore();
    actions.addRowBelow();

    expect(stateStore.getState().decisionTable.rules).toHaveLength(4);
    expect(stateStore.getState().decisionTable.rules[3]['in-1']).toBe('');
  });

  it('removeRow splices the row out', () => {
    const { stateStore, actions } = makeStore();
    actions.removeRow(0);

    const rules = stateStore.getState().decisionTable.rules;
    expect(rules.map((r) => r._id)).toEqual(['r2', 'r3']);
  });

  it('swapRows moves a row and clears the cursor (drop semantics)', () => {
    const { stateStore, actions } = makeStore();
    actions.setCursor({ x: 'in-1', y: 0 });
    actions.swapRows(2, 0);

    const state = stateStore.getState();
    expect(state.decisionTable.rules.map((r) => r._id)).toEqual(['r3', 'r1', 'r2']);
    expect(state.cursor).toBeNull();
  });

  it('updateColumn renames and re-cleans rules; removeColumn resets the cursor', () => {
    const { stateStore, actions } = makeStore();
    const [firstInput] = stateStore.getState().decisionTable.inputs;
    actions.updateColumn('inputs', firstInput.id, { ...firstInput, name: 'Renamed' });
    expect(stateStore.getState().decisionTable.inputs[0].name).toBe('Renamed');

    actions.setCursor({ x: firstInput.id, y: 1 });
    actions.removeColumn('inputs', firstInput.id);
    const state = stateStore.getState();
    expect(state.decisionTable.inputs.map((i) => i.id)).toEqual(['in-2']);
    expect(state.cursor).toBeNull();
  });

  it('reorderColumns reorders and keeps rule values keyed by column id', () => {
    const { stateStore, actions } = makeStore();
    const inputs = stateStore.getState().decisionTable.inputs;
    actions.reorderColumns('inputs', [inputs[1], inputs[0]]);

    const state = stateStore.getState();
    expect(state.decisionTable.inputs.map((i) => i.id)).toEqual(['in-2', 'in-1']);
    expect(state.decisionTable.rules[0]['in-1']).toBe('a');
  });

  it('updateHitPolicy updates and fires onChange', () => {
    const { stateStore, listenerStore, actions } = makeStore();
    const onChange = vi.fn();
    listenerStore.setState({ onChange });

    actions.updateHitPolicy('collect');
    expect(stateStore.getState().decisionTable.hitPolicy).toBe('collect');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('column sizing persistence', () => {
  it('round-trips a sizing map through localStorage', () => {
    localStorage.setItem(columnSizeKey('t1'), JSON.stringify({ 'in-1': 120, 'out-1': 260 }));
    expect(loadColumnSizing('t1')).toEqual({ 'in-1': 120, 'out-1': 260 });
  });

  it('returns {} without an id', () => {
    expect(loadColumnSizing(undefined)).toEqual({});
  });

  it('returns {} on invalid JSON', () => {
    localStorage.setItem(columnSizeKey('t2'), '{not json');
    expect(loadColumnSizing('t2')).toEqual({});
  });

  it('returns {} when the payload is not a record of numbers', () => {
    localStorage.setItem(columnSizeKey('t3'), JSON.stringify(['in-1', 120]));
    expect(loadColumnSizing('t3')).toEqual({});
    localStorage.setItem(columnSizeKey('t4'), JSON.stringify({ 'in-1': 'wide' }));
    expect(loadColumnSizing('t4')).toEqual({});
  });
});

describe('computeVirtualPadding', () => {
  it('returns zeroes for an empty window', () => {
    expect(computeVirtualPadding([], 380)).toEqual({ paddingTop: 0, paddingBottom: 0 });
  });

  it('computes spacers around the rendered window', () => {
    // rows 2..4 of 10 at 38px each: total 380, window start 76, end 190
    const items = [
      { start: 76, end: 114 },
      { start: 114, end: 152 },
      { start: 152, end: 190 },
    ];
    expect(computeVirtualPadding(items, 380)).toEqual({ paddingTop: 76, paddingBottom: 190 });
  });

  it('treats a zero measurement as 0 (falsy-start guard, upstream parity)', () => {
    const items = [
      { start: 0, end: 0 },
      { start: 0, end: 38 },
    ];
    expect(computeVirtualPadding(items, 76)).toEqual({ paddingTop: 0, paddingBottom: 38 });
  });
});

describe('header kinds', () => {
  it('maps column ids to self kinds', () => {
    expect(getSelfKind('inputs')).toBe('input');
    expect(getSelfKind('outputs')).toBe('output');
    expect(getSelfKind('_description')).toBe('description');
    expect(getSelfKind('in-1')).toBeUndefined();
  });

  it('maps parent ids to parent kinds', () => {
    expect(getParentKind('inputs')).toBe('input');
    expect(getParentKind('outputs')).toBe('output');
    expect(getParentKind(undefined)).toBeUndefined();
    expect(getParentKind('_description')).toBeUndefined();
  });
});

describe('Table (smoke through the provider)', () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  it('renders header groups, the field row and the add-row affordance', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    let bundle: ReturnType<typeof DecisionTableProvider> | undefined;

    const Harness = defineComponent({
      name: 'TableHarness',
      setup() {
        bundle = DecisionTableProvider();
        bundle.stateStore.setState({ decisionTable: seedTable() });
        return () => h(Table, { maxHeight: 400 });
      },
    });

    const wrapper = mount(Harness, { attachTo: document.body });
    await nextTick();
    await nextTick();

    // two header tables: group row (Inputs/Outputs/Description) + field row
    const headText = wrapper
      .findAll('thead')
      .map((th) => th.text())
      .join(' ');
    expect(headText).toContain('Inputs');
    expect(headText).toContain('Outputs');
    expect(headText).toContain('Description');
    expect(headText).toContain('Input 1');
    expect(headText).toContain('Output 1');

    // the virtualized tbody mounts with its context-menu trigger; jsdom has
    // no layout (outerSize 0), so the virtualizer window renders no rows —
    // accepted gap, exercised manually in the playground (see below).
    expect(wrapper.find('tbody').exists()).toBe(true);

    // add-row button appends through the store
    await wrapper.find('.grl-dt__add-row').trigger('click');
    await nextTick();
    expect(bundle?.stateStore.getState().decisionTable.rules).toHaveLength(4);

    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  // Accepted coverage gaps (jsdom): the virtualizer's item window needs real
  // layout (outerSize), and Sortable's drag callbacks need real pointer
  // events — both are exercised manually in the playground; the spacer math
  // and drop-swap semantics are covered above.
});
