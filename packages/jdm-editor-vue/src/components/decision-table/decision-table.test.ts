// @vitest-environment jsdom
// Logic-core coverage for the decision-table module's chrome phase
// (PORTING.md testing rule): enum-utils parse/serialize round-trips and the
// excel mapping math extracted from dt-excel-dialog (buildImportColumns /
// buildMappedExcelData / isHeaderMatch) — plus a jsdom smoke mount of the
// public DecisionTable through its providers. The store actions and table
// math are covered by table/table.test.ts.
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { ENUM_MODE_OPTIONS, getEnumMode, parseEnumString, serializeEnumValues } from './components/enum-utils';
import {
  type ImportColumn,
  buildImportColumns,
  buildMappedExcelData,
  isHeaderMatch,
} from './components/dt-excel-dialog.vue';
import { type ParsedExcelData } from '../../helpers/excel';
import { NodeKind } from '../../helpers/schema';
import DecisionTable from './dt.vue';
import type { TableScrollApi } from './table/table.vue';

describe('enum-utils', () => {
  it('parses "Label;value" lines and falls back to the label as value', () => {
    expect(parseEnumString('United States;us\nCanada;ca\nMexico')).toEqual([
      { label: 'United States', value: 'us' },
      { label: 'Canada', value: 'ca' },
      { label: 'Mexico', value: 'Mexico' },
    ]);
  });

  it('ignores blank lines and surrounding whitespace', () => {
    expect(parseEnumString('  a;b \n\n\n c ; d ')).toEqual([
      { label: 'a', value: 'b' },
      { label: 'c', value: 'd' },
    ]);
    expect(parseEnumString('')).toEqual([]);
    expect(parseEnumString('   \n  ')).toEqual([]);
  });

  it('serializes only when label and value differ (round-trip)', () => {
    const text = 'United States;us\nCanada;ca\nMexico';
    const parsed = parseEnumString(text);
    expect(serializeEnumValues(parsed)).toBe(text);

    expect(serializeEnumValues([{ label: 'same', value: 'same' }])).toBe('same');
    expect(serializeEnumValues([])).toBe('');
    expect(serializeEnumValues(undefined)).toBe('');
  });

  it('derives the enum mode off a ColumnEnum', () => {
    expect(getEnumMode(undefined)).toBe('none');
    expect(getEnumMode({ type: 'inline', values: [{ label: 'a', value: 'a' }] })).toBe('inline');
    expect(getEnumMode({ type: 'ref', ref: 'countries' })).toBe('ref');
    expect(ENUM_MODE_OPTIONS.map((o) => o.value)).toEqual(['none', 'inline', 'ref']);
  });
});

// --- Excel mapping math (upstream: dt-excel-dialog effect + onOk) -----------

const excelFixture = (): ParsedExcelData => ({
  id: 'node-1',
  name: 'Sheet1',
  type: NodeKind.DecisionTable,
  position: { x: 0, y: 0 },
  headers: [
    { id: 'x-in', name: 'Age', value: 'age' },
    { id: 'x-out', name: 'Price', value: 'price' },
    { id: '_description', name: 'description' },
    { id: '_id', name: 'rule id' },
  ],
  rules: [
    [
      { headerId: 'x-in', value: '18' },
      { headerId: 'x-out', value: '10, 20' },
      { headerId: '_description', value: 'adult' },
      { headerId: '_id', value: 'r1' },
    ],
    [
      { headerId: 'x-in', value: '65' },
      { headerId: 'x-out', value: '5' },
      { headerId: '_description', value: 'senior' },
      { headerId: '_id', value: 'r2' },
    ],
  ],
  existingTableData: {
    headers: [
      { id: 'in-1', name: 'Age', field: 'age', type: 'input' },
      { id: 'out-1', name: 'Price', field: 'price', type: 'output' },
    ],
    hitPolicy: 'first',
    passThrough: false,
    executionMode: 'single',
  },
});

describe('isHeaderMatch', () => {
  it('matches on id, case-insensitive value and case-insensitive label', () => {
    const base = { id: 'a', label: 'A', value: 'v' };
    expect(isHeaderMatch(base, { id: 'a', label: 'other' })).toBe(true);
    expect(isHeaderMatch(base, { id: 'b', label: 'other', value: 'V' })).toBe(true);
    expect(isHeaderMatch(base, { id: 'b', label: 'a', value: 'w' })).toBe(true);
    expect(isHeaderMatch(base, { id: 'b', label: 'other', value: 'w' })).toBe(false);
    expect(isHeaderMatch(base, { id: 'b', label: 'other', value: undefined })).toBe(false);
  });
});

describe('buildImportColumns', () => {
  it('auto-matches excel headers to existing table columns', () => {
    const { columns, descriptionExcelId, descriptionEnabled } = buildImportColumns(excelFixture());

    expect(columns).toHaveLength(2);
    expect(columns[0]).toMatchObject({ id: 'in-1', type: 'input', excelHeaderId: 'x-in', name: 'Age' });
    expect(columns[1]).toMatchObject({ id: 'out-1', type: 'output', excelHeaderId: 'x-out' });
    expect(descriptionExcelId).toBe('_description');
    expect(descriptionEnabled).toBe(true);
  });

  it('promotes the last input to output when the table has no outputs', () => {
    const fixture = excelFixture();
    fixture.existingTableData.headers = [
      { id: 'in-1', name: 'A', field: 'a', type: 'input' },
      { id: 'in-2', name: 'B', field: 'b', type: 'input' },
    ];

    const { columns } = buildImportColumns(fixture);
    expect(columns.map((c) => c.type)).toEqual(['input', 'output']);
    expect(columns[1].id).toBe('in-2');
  });

  it('disables the description mapping when no _description header exists', () => {
    const fixture = excelFixture();
    fixture.headers = fixture.headers.filter((h) => h.id !== '_description');

    const { descriptionExcelId, descriptionEnabled } = buildImportColumns(fixture);
    expect(descriptionExcelId).toBeUndefined();
    expect(descriptionEnabled).toBe(false);
  });
});

describe('buildMappedExcelData', () => {
  const columns: ImportColumn[] = [
    { id: 'in-1', name: 'Age', field: 'age', type: 'input', excelHeaderId: 'x-in' },
    { id: 'out-1', name: 'Price', field: 'price', type: 'output', excelHeaderId: 'x-out' },
  ];

  const base = {
    spreadSheetData: excelFixture(),
    columns,
    disabledColumns: {},
    wrapStates: {},
    descriptionEnabled: true,
    descriptionExcelId: '_description',
  };

  it('maps rule rows onto the table column ids and carries _id + description', () => {
    const { items, rules } = buildMappedExcelData(base);

    expect(items.map((i) => [i.id, i.type, i.value])).toEqual([
      ['in-1', 'input', 'age'],
      ['out-1', 'output', 'price'],
      ['_description', undefined, 'description'],
    ]);

    expect(rules[0].map((r) => [r.headerId, r.value])).toEqual([
      ['in-1', '18'],
      ['out-1', '10, 20'],
      // _id is appended before the description (upstream order)
      ['_id', 'r1'],
      ['_description', 'adult'],
    ]);
  });

  it('wraps comma-separated values in quotes per column', () => {
    const { rules } = buildMappedExcelData({
      ...base,
      wrapStates: { 'out-1': true },
    });

    expect(rules[0].find((r) => r.headerId === 'out-1')?.value).toBe('"10", "20"');
    // untouched column stays raw
    expect(rules[0].find((r) => r.headerId === 'in-1')?.value).toBe('18');
    // single values get quoted too (upstream wraps any non-empty raw value)
    expect(rules[1].find((r) => r.headerId === 'out-1')?.value).toBe('"5"');
  });

  it('excludes disabled columns and falls back to defaultValue for unmapped ones', () => {
    const withDefaults: ImportColumn[] = [
      ...columns,
      { id: 'in-9', name: 'Region', field: 'region', type: 'input', defaultValue: 'EU' },
    ];

    const { items, rules } = buildMappedExcelData({
      ...base,
      columns: withDefaults,
      disabledColumns: { 'in-1': true },
    });

    // items keep upstream's inputs-then-outputs order; the disabled input is gone
    expect(items.map((i) => i.id)).toEqual(['in-9', 'out-1', '_description']);
    expect(rules[0].find((r) => r.headerId === 'in-9')?.value).toBe('EU');
  });

  it('omits the description item when disabled', () => {
    const { items, rules } = buildMappedExcelData({ ...base, descriptionEnabled: false });
    expect(items.some((i) => i.id === '_description')).toBe(false);
    expect(rules[0].some((r) => r.headerId === '_description')).toBe(false);
  });
});

// --- Public component smoke ---------------------------------------------------

describe('DecisionTable (smoke)', () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const seed = () => ({
    hitPolicy: 'first',
    inputs: [
      { id: 'in-1', name: 'Input 1', field: 'input1' },
      { id: 'in-2', name: 'Input 2', field: 'input2' },
    ],
    outputs: [{ id: 'out-1', name: 'Output 1', field: 'output1' }],
    rules: [
      { _id: 'r1', 'in-1': 'a', 'out-1': 'x' },
      { _id: 'r2', 'in-1': 'b', 'out-1': 'y' },
    ],
  });

  it('mounts chrome + table + empty-state controller and exposes the scroll refs', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    const modelValue = ref(seed());
    const scrollApiRef = ref<TableScrollApi | null>(null);

    const wrapper = mount(
      defineComponent({
        name: 'DecisionTableHarness',
        setup() {
          return () =>
            h(DecisionTable, {
              tableHeight: 400,
              modelValue: modelValue.value,
              'onUpdate:modelValue': (v: unknown) => {
                modelValue.value = v as ReturnType<typeof seed>;
              },
              scrollApiRef,
            });
        },
      }),
      { attachTo: document.body },
    );
    await nextTick();
    await nextTick();

    // chrome, table container and the column headers all rendered
    expect(wrapper.find('.grl-dt').exists()).toBe(true);
    expect(wrapper.find('.grl-dt__command-bar').exists()).toBe(true);
    expect(wrapper.find('.grl-dt__container').exists()).toBe(true);
    expect(wrapper.findAll('thead').map((t) => t.text()).join(' ')).toContain('Inputs');
    expect(wrapper.findAll('thead').map((t) => t.text()).join(' ')).toContain('Output 1');

    // edit-mode field pills render FieldEditPopover's default trigger (no
    // consumer trigger slot provided)
    const pills = wrapper.findAll('.grl-field-edit');
    expect(pills.map((p) => p.text())).toContain('input1');
    expect(pills.some((p) => p.classes().includes('grl-field-edit--output'))).toBe(true);

    // the mounted gate filled the caller's scroll api ref
    expect(scrollApiRef.value).not.toBeNull();
    expect(typeof scrollApiRef.value?.getTopRowIndex).toBe('function');

    wrapper.unmount();
    vi.unstubAllGlobals();
  });
});
