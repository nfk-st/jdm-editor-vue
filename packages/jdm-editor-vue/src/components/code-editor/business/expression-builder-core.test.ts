// @vitest-environment jsdom
// Logic-core coverage for expression-builder.vue's stateful core (review
// gap): the useExpressionState wasm round-trip, setOp's value-preservation
// matrix, setKind's reset behaviour, the kind precedence chain
// (isEnum > autoType > external) and the forceCustom escape hatch.
//
// useExpressionState, setOp and setKind are module-private (the exported
// PORTING(test) helpers are the pure functions already covered in
// business.test.ts), so the stateful paths are driven through the mounted
// component's public surface: the OpDropdown's callback props and the
// update:modelValue emissions. The wasm parse/serialize loop itself is
// pinned first with direct ExpressionBuilder round-trips.
import { ExpressionBuilder, initSync } from '@gorules/zen-engine-wasm';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { nextTick } from 'vue';
import { beforeAll, describe, expect, it } from 'vitest';

import ExpressionBuilderVue from './expression-builder.vue';

// --- wasm round-trip helpers (the useExpressionState loop) -----------------

const parseUnary = (source: string) => {
  const builder = ExpressionBuilder.parseUnary(source);
  const json = builder.toJson();
  builder.free();
  return json;
};

const serialize = (data: unknown) => {
  const builder = ExpressionBuilder.fromJson(data);
  const source = builder.serialize();
  builder.free();
  return source;
};

// --- mounted component helpers ---------------------------------------------

const mountBuilder = (props: { modelValue: string; fieldType?: unknown }) =>
  mount(ExpressionBuilderVue, { props: props as never });

const dropdownOf = (wrapper: ReturnType<typeof mountBuilder>) => wrapper.getComponent({ name: 'OpDropdown' });

const selectOp = async (wrapper: ReturnType<typeof mountBuilder>, op: string) => {
  (dropdownOf(wrapper).props('onSelect') as (o: string) => void)(op);
  await nextTick();
};

const changeKind = async (wrapper: ReturnType<typeof mountBuilder>, kind: string) => {
  (dropdownOf(wrapper).props('onKindChange') as (k: string) => void)(kind);
  await nextTick();
};

const toggleCustom = async (wrapper: ReturnType<typeof mountBuilder>) => {
  (dropdownOf(wrapper).props('onCustomToggle') as () => void)();
  await nextTick();
};

const lastEmitted = (wrapper: ReturnType<typeof mountBuilder>) =>
  wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string | undefined;

const kindOf = (wrapper: ReturnType<typeof mountBuilder>) => dropdownOf(wrapper).props('kind') as string;

const hasCodeEditor = (wrapper: ReturnType<typeof mountBuilder>) =>
  wrapper.find('.eb-code .cm-editor').exists();

describe('useExpressionState wasm round-trip', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('parses bare zen values into simple expression data', () => {
    expect(parseUnary('5')).toEqual({ kind: 'simple', operator: { type: 'eq' }, value: { type: 'number', value: 5 } });
    expect(parseUnary('"str"')).toEqual({
      kind: 'simple',
      operator: { type: 'eq' },
      value: { type: 'string', value: 'str' },
    });
    expect(parseUnary('true')).toEqual({
      kind: 'simple',
      operator: { type: 'eq' },
      value: { type: 'boolean', value: true },
    });
    expect(parseUnary('[1, 2]')).toEqual({
      kind: 'simple',
      operator: { type: 'in' },
      value: { type: 'numberArray', values: [1, 2] },
    });
    expect(parseUnary('["a", "b"]')).toEqual({
      kind: 'simple',
      operator: { type: 'in' },
      value: { type: 'stringArray', values: ['a', 'b'] },
    });
  });

  it('parses the unary operator forms the builder emits', () => {
    expect(parseUnary('> 5')).toMatchObject({ operator: { type: 'gt' }, value: { type: 'number', value: 5 } });
    expect(parseUnary('not in [1, 2]')).toMatchObject({
      operator: { type: 'notIn' },
      value: { type: 'numberArray', values: [1, 2] },
    });
    expect(parseUnary('[1..9)')).toEqual({
      kind: 'simple',
      operator: { type: 'between' },
      value: { type: 'interval', left: 1, right: 9, leftInclusive: true, rightInclusive: false },
    });
    expect(parseUnary('contains($, "foo")')).toMatchObject({
      operator: { type: 'contains' },
      value: { type: 'string', value: 'foo' },
    });
    expect(parseUnary('d($).isAfter("2026-05-13", "month")')).toEqual({
      kind: 'simple',
      operator: { type: 'dateAfter' },
      value: { type: 'date', value: '2026-05-13', granularity: 'month' },
    });
    expect(parseUnary('d($).hour() * 60 + d($).minute() > 14 * 60 + 30')).toEqual({
      kind: 'simple',
      operator: { type: 'timeGt' },
      value: { type: 'time', hour: 14, minute: 30 },
    });
    expect(parseUnary('d($).weekday() in [1, 3]')).toEqual({
      kind: 'simple',
      operator: { type: 'dayOfWeekIn' },
      value: { type: 'intArray', values: [1, 3] },
    });
  });

  it('treats expressions with a left-hand side, empty and whitespace input as expected', () => {
    expect(parseUnary('x == 5')).toEqual({ kind: 'complex', raw: 'x == 5' });
    expect(parseUnary('a + b')).toEqual({ kind: 'complex', raw: 'a + b' });
    expect(parseUnary('')).toEqual({ kind: 'simple', operator: { type: 'any' }, value: null });
    expect(parseUnary('   ')).toEqual({ kind: 'simple', operator: { type: 'any' }, value: null });
  });

  it('round-trips every builder form through parse → toJson → fromJson → serialize', () => {
    const sources = [
      '5',
      '> 5',
      '>= 5',
      '< 5',
      '<= 5',
      '"str"',
      'true',
      'false',
      '[1, 2]',
      '["a", "b"]',
      'not in [1, 2]',
      '[1..9)',
      '[0..100]',
      'contains($, "foo")',
      'startsWith($, "foo")',
      'endsWith($, "foo")',
      'null',
      '!= null',
      'd($).isAfter("2026-05-13")',
      'd($).isAfter("2026-05-13", "month")',
      'd($).isBefore("2026-05-13")',
      'd($).isSame("2026-05-13")',
      'd($).hour() * 60 + d($).minute() > 14 * 60 + 30',
      'd($).weekday() in [1, 3]',
      'd($).quarter() in [1]',
      'a + b',
      '',
    ];

    for (const source of sources) {
      expect(serialize(parseUnary(source))).toBe(source);
    }
  });

  it('serialises freshly built data the way update() emits it', () => {
    expect(serialize({ kind: 'simple', operator: { type: 'gt' }, value: { type: 'number', value: 5 } })).toBe('> 5');
    expect(serialize({ kind: 'simple', operator: { type: 'between' }, value: null })).toBe('[0..100]');
    expect(serialize({ kind: 'complex', raw: 'a + b' })).toBe('a + b');
  });
});

describe('setOp value preservation', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('keeps a number value when switching between comparison operators', async () => {
    const wrapper = mountBuilder({ modelValue: '5' });

    await selectOp(wrapper, 'gt');
    expect(lastEmitted(wrapper)).toBe('> 5');
  });

  it('replaces the value when the new operator expects a different shape', async () => {
    const wrapper = mountBuilder({ modelValue: '5' });

    await selectOp(wrapper, 'contains');
    expect(lastEmitted(wrapper)).toBe('contains($, "")');

    await selectOp(wrapper, 'between');
    expect(lastEmitted(wrapper)).toBe('[0..100]');

    await selectOp(wrapper, 'null');
    expect(lastEmitted(wrapper)).toBe('null');
  });

  it('keeps a string value across string operators', async () => {
    const wrapper = mountBuilder({ modelValue: 'contains($, "foo")' });

    await selectOp(wrapper, 'startsWith');
    expect(lastEmitted(wrapper)).toBe('startsWith($, "foo")');

    await selectOp(wrapper, 'eq');
    expect(lastEmitted(wrapper)).toBe('"foo"');
  });

  it('keeps array values across in/notIn', async () => {
    const numbers = mountBuilder({ modelValue: '[1, 2]' });
    await selectOp(numbers, 'notIn');
    expect(lastEmitted(numbers)).toBe('not in [1, 2]');
    numbers.unmount();

    const strings = mountBuilder({ modelValue: '["a", "b"]' });
    await selectOp(strings, 'notIn');
    expect(lastEmitted(strings)).toBe('not in ["a", "b"]');
    strings.unmount();
  });

  it('keeps a date value across date operators', async () => {
    // Mounted via the forceCustom branch (a date expression under a number
    // field): the date value input itself cannot mount under jsdom — its
    // granularity Select's empty-string "Exact" option violates reka-ui's
    // SelectItem contract — and the op change is branch-independent.
    const wrapper = mountBuilder({
      modelValue: 'd($).isAfter("2026-05-13")',
      fieldType: { type: 'number' },
    });
    expect(hasCodeEditor(wrapper)).toBe(true);

    await selectOp(wrapper, 'dateBefore');
    expect(lastEmitted(wrapper)).toBe('d($).isBefore("2026-05-13")');
    wrapper.unmount();
  });

  it('keeps int-array values across day/quarter operators', async () => {
    const wrapper = mountBuilder({ modelValue: 'd($).weekday() in [1, 3]' });

    await selectOp(wrapper, 'quarterIn');
    expect(lastEmitted(wrapper)).toBe('d($).quarter() in [1, 3]');
  });

  it('drops an interval when moving to a scalar operator and back', async () => {
    const wrapper = mountBuilder({ modelValue: '[1..9)' });

    await selectOp(wrapper, 'gt');
    expect(lastEmitted(wrapper)).toBe('> 0');

    await wrapper.setProps({ modelValue: '> 0' });
    await selectOp(wrapper, 'between');
    expect(lastEmitted(wrapper)).toBe('[0..100]');
  });

  it('re-parses the emitted model value between op changes', async () => {
    const wrapper = mountBuilder({ modelValue: '5' });

    await selectOp(wrapper, 'gt');
    expect(lastEmitted(wrapper)).toBe('> 5');

    await wrapper.setProps({ modelValue: '> 5' });
    await selectOp(wrapper, 'lte');
    expect(lastEmitted(wrapper)).toBe('<= 5');
  });
});

describe('setKind', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('resets op and value to the new kind defaults', async () => {
    const boolean = mountBuilder({ modelValue: '5' });
    await changeKind(boolean, 'boolean');
    expect(lastEmitted(boolean)).toBe('true');
    boolean.unmount();

    const string = mountBuilder({ modelValue: '5' });
    await changeKind(string, 'string');
    expect(lastEmitted(string)).toBe('""');
    string.unmount();

    const number = mountBuilder({ modelValue: '"str"' });
    await changeKind(number, 'number');
    expect(lastEmitted(number)).toBe('0');
    number.unmount();

    const date = mountBuilder({ modelValue: '5' });
    await changeKind(date, 'date');
    expect(lastEmitted(date)).toMatch(/^d\(\$\)\.isAfter\("\d{4}-\d{2}-\d{2}"\)$/);
    date.unmount();
  });

  it('rebuilds the value even when the kind is unchanged', async () => {
    const wrapper = mountBuilder({ modelValue: '5' });

    await changeKind(wrapper, 'number');
    expect(lastEmitted(wrapper)).toBe('0');
  });
});

describe('kind precedence chain', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('infers the kind from the expression when the field type is auto', () => {
    const mounts = [
      mountBuilder({ modelValue: '5' }),
      mountBuilder({ modelValue: 'contains($, "x")' }),
      // dayOfWeekIn infers date without rendering the date value input
      // (its granularity Select cannot mount under jsdom, see below).
      mountBuilder({ modelValue: 'd($).weekday() in [1, 3]' }),
      // Complex expressions carry no kind to infer — the string fallback.
      mountBuilder({ modelValue: 'a + b' }),
    ];
    expect(mounts.map(kindOf)).toEqual(['number', 'string', 'date', 'string']);
    mounts.forEach((m) => m.unmount());
  });

  it('uses an explicitly picked kind over inference while auto', async () => {
    const wrapper = mountBuilder({ modelValue: 'a + b' });
    expect(kindOf(wrapper)).toBe('string');
    expect(dropdownOf(wrapper).props('onKindChange')).toBeTruthy();

    await changeKind(wrapper, 'number');
    expect(kindOf(wrapper)).toBe('number');
  });

  it('prefers an enum field type and hides the kind switcher', () => {
    const wrapper = mountBuilder({
      modelValue: '"blue"',
      fieldType: { type: 'string', enum: { type: 'inline', values: [{ label: 'Blue', value: 'blue' }] } },
    });

    expect(kindOf(wrapper)).toBe('string');
    expect(dropdownOf(wrapper).props('onKindChange')).toBeFalsy();
    // The enum options replace the free-form value input.
    expect(wrapper.find('.eb-enum').exists()).toBe(true);
    wrapper.unmount();
  });

  it('uses the external field type when one is set', () => {
    const number = mountBuilder({ modelValue: '5', fieldType: { type: 'number' } });
    expect(kindOf(number)).toBe('number');
    expect(dropdownOf(number).props('onKindChange')).toBeFalsy();
    expect(number.find('.eb-number').exists()).toBe(true);
    number.unmount();

    // A null op keeps the value input out of the picture; the kind still
    // comes from the field type, not from the expression.
    const date = mountBuilder({ modelValue: 'null', fieldType: { type: 'date' } });
    expect(kindOf(date)).toBe('date');
    date.unmount();
  });
});

describe('custom expression escape hatch', () => {
  beforeAll(() => {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm');
    initSync({ module: readFileSync(wasmPath) });
  });

  it('starts in the code editor for complex expressions', () => {
    const wrapper = mountBuilder({ modelValue: 'a + b' });

    expect(hasCodeEditor(wrapper)).toBe(true);
    expect(dropdownOf(wrapper).props('isCustom')).toBe(true);
    wrapper.unmount();
  });

  it('flips to the code editor when the model value turns complex', async () => {
    const wrapper = mountBuilder({ modelValue: '5' });
    expect(hasCodeEditor(wrapper)).toBe(false);

    await wrapper.setProps({ modelValue: 'a + b' });
    expect(hasCodeEditor(wrapper)).toBe(true);
    wrapper.unmount();
  });

  it('forces the code editor when the expression does not fit the field kind', () => {
    const forced = mountBuilder({ modelValue: '"str"', fieldType: { type: 'number' } });
    expect(kindOf(forced)).toBe('number');
    expect(hasCodeEditor(forced)).toBe(true);
    expect(dropdownOf(forced).props('isCustom')).toBe(true);
    forced.unmount();

    // The same expression is a plain value input when the kind allows it.
    const compatible = mountBuilder({ modelValue: '"str"' });
    expect(hasCodeEditor(compatible)).toBe(false);
    compatible.unmount();
  });

  it('toggles between the value input and the code editor without emitting', async () => {
    const wrapper = mountBuilder({ modelValue: '5' });
    expect(hasCodeEditor(wrapper)).toBe(false);

    await toggleCustom(wrapper);
    expect(hasCodeEditor(wrapper)).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();

    await toggleCustom(wrapper);
    expect(hasCodeEditor(wrapper)).toBe(false);
    wrapper.unmount();
  });

  it('leaves the custom editor when an operator is picked', async () => {
    const wrapper = mountBuilder({ modelValue: 'a + b' });
    expect(hasCodeEditor(wrapper)).toBe(true);

    await selectOp(wrapper, 'eq');
    // A complex expr has no value to reuse — the string default is used.
    expect(lastEmitted(wrapper)).toBe('""');

    await wrapper.setProps({ modelValue: '""' });
    expect(hasCodeEditor(wrapper)).toBe(false);
    expect(kindOf(wrapper)).toBe('string');
    wrapper.unmount();
  });
});
