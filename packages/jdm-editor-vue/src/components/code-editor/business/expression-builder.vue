<script lang="ts">
// Ported from components/code-editor/business/expression-builder.tsx (806
// LOC) — the unary expression builder. Upstream's internal subcomponents
// (OpDropdown, ValInput and the value inputs) stay in this one file as
// module-scope defineComponent/render functions, keeping the file
// correspondence 1:1 (one upstream file → one SFC).
import type { ExpressionBuilderData, SimpleOperator, SimpleValue } from '@gorules/zen-engine-wasm';
import { ExpressionBuilder as ExpressionBuilderWasm } from '@gorules/zen-engine-wasm';
import clsx from 'clsx';
import dayjs, { type Dayjs } from 'dayjs';
import {
  ArrowLeftRightIcon,
  AsteriskIcon,
  CalendarCheckIcon,
  CalendarIcon,
  CalendarMinusIcon,
  CalendarPlusIcon,
  CircleDotIcon,
  CircleSlashIcon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  EqualIcon,
  EqualNotIcon,
  ListIcon,
  ListXIcon,
  type LucideIcon,
  SearchIcon,
  SquareFunctionIcon,
  TextCursorInputIcon,
} from 'lucide-vue-next';
import { P, match } from 'ts-pattern';
import { type FunctionalComponent, type PropType, computed, defineComponent, h, ref, watch } from 'vue';

import type { ColumnFieldType } from '../../../helpers/schema';
import { type DictionaryMap, useDictionaries } from '../../../theme';
import AutosizeTextArea from '../../autosize-text-area.vue';
import DatePicker from '../../ui/DatePicker.vue';
import InputNumber from '../../ui/InputNumber.vue';
import MultiSelect from '../../ui/MultiSelect.vue';
import Popover from '../../ui/Popover.vue';
import Select from '../../ui/Select.vue';
import TimePicker from '../../ui/TimePicker.vue';
import CodeEditorBase from '../ce-base.vue';

// PORTING(public): upstream `value`/`onChange` → `modelValue` +
// `update:modelValue` per docs/PORTING.md's public-prop convention.
export type ExpressionBuilderProps = {
  modelValue: string;
  disabled?: boolean;
  fieldType?: ColumnFieldType;
  maxRows?: number;
};

export type ExpressionBuilderRef = {
  focus: () => void;
};

type OperatorType = SimpleOperator['type'];
type ValueKind = 'string' | 'number' | 'boolean' | 'date' | 'any';

const VALUE_KINDS: { kind: ValueKind; label: string }[] = [
  { kind: 'string', label: 'Text' },
  { kind: 'number', label: 'Number' },
  { kind: 'boolean', label: 'Boolean' },
  { kind: 'date', label: 'Date' },
];

type Op = { type: OperatorType; icon?: LucideIcon; symbol?: string; rotate?: boolean; label: string };

const OPS: Op[] = [
  { type: 'eq', icon: EqualIcon, label: 'equals' },
  { type: 'neq', icon: EqualNotIcon, label: 'not equals' },
  { type: 'gt', symbol: '>', label: 'greater than' },
  { type: 'gte', symbol: '≥', label: 'greater or equal' },
  { type: 'lt', symbol: '<', label: 'less than' },
  { type: 'lte', symbol: '≤', label: 'less or equal' },
  { type: 'in', icon: ListIcon, label: 'is one of' },
  { type: 'notIn', icon: ListXIcon, label: 'is not one of' },
  { type: 'between', icon: ArrowLeftRightIcon, label: 'between' },
  { type: 'null', icon: CircleSlashIcon, label: 'is empty' },
  { type: 'notNull', icon: CircleDotIcon, label: 'is not empty' },
  { type: 'any', icon: AsteriskIcon, label: 'any' },
  { type: 'startsWith', icon: TextCursorInputIcon, label: 'starts with' },
  { type: 'endsWith', icon: TextCursorInputIcon, rotate: true, label: 'ends with' },
  { type: 'contains', icon: SearchIcon, label: 'contains' },
  { type: 'dateAfter', icon: CalendarPlusIcon, label: 'after' },
  { type: 'dateBefore', icon: CalendarMinusIcon, label: 'before' },
  { type: 'dateSame', icon: CalendarCheckIcon, label: 'same day' },
  { type: 'dateSameOrAfter', symbol: '≥', label: 'same or after' },
  { type: 'dateSameOrBefore', symbol: '≤', label: 'same or before' },
  { type: 'dateIsToday', icon: CalendarIcon, label: 'is today' },
  { type: 'timeGt', icon: ClockArrowUpIcon, label: 'time after' },
  { type: 'timeGte', icon: ClockArrowUpIcon, label: 'time at or after' },
  { type: 'timeLt', icon: ClockArrowDownIcon, label: 'time before' },
  { type: 'timeLte', icon: ClockArrowDownIcon, label: 'time at or before' },
  { type: 'dayOfWeekIn', icon: CalendarIcon, label: 'day is one of' },
  { type: 'quarterIn', icon: CalendarIcon, label: 'quarter is one of' },
];

const getOp = (type: OperatorType): Op => OPS.find((o) => o.type === type) ?? OPS[0];

const OPS_BY_KIND: Record<ValueKind, OperatorType[]> = {
  string: ['eq', 'neq', 'in', 'notIn', 'startsWith', 'endsWith', 'contains', 'null', 'notNull', 'any'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'between', 'null', 'notNull', 'any'],
  boolean: ['eq', 'null', 'notNull', 'any'],
  date: [
    'dateAfter',
    'dateBefore',
    'dateSame',
    'dateSameOrAfter',
    'dateSameOrBefore',
    'dateIsToday',
    'timeGt',
    'timeGte',
    'timeLt',
    'timeLte',
    'dayOfWeekIn',
    'quarterIn',
    'null',
    'notNull',
    'any',
  ],
  any: OPS.map((o) => o.type),
};

const GRID_OPS: Record<ValueKind, OperatorType[]> = {
  string: ['eq', 'neq', 'in', 'startsWith', 'endsWith', 'contains'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  boolean: ['eq', 'null', 'notNull', 'any'],
  date: ['dateAfter', 'dateBefore', 'dateSame', 'dateIsToday', 'dayOfWeekIn', 'quarterIn'],
  any: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
};

const NO_VALUE_OPS: OperatorType[] = ['null', 'notNull', 'any', 'dateIsToday'];

const GRANULARITIES = [
  { value: '', label: 'Exact' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

// PORTING: upstream keeps these module-private; exported here for vitest
// coverage of the module's pure logic (upstream has no tests).
export const getValueKind = (ft?: ColumnFieldType): ValueKind =>
  match(ft?.type)
    .with('string', () => 'string' as const)
    .with('number', () => 'number' as const)
    .with('boolean', () => 'boolean' as const)
    .with('date', () => 'date' as const)
    .otherwise(() => 'any' as const);

export const enumFilterOption = (input: string, option?: { label?: string; value?: string }) => {
  const search = input.toLowerCase();
  return (option?.label?.toLowerCase().includes(search) || option?.value?.toLowerCase().includes(search)) ?? false;
};

export const getEnumOptions = (
  ft?: ColumnFieldType,
  dictionaries?: DictionaryMap,
): { values: { label: string; value: string }[]; loose: boolean } | null => {
  if (ft?.type !== 'string' || !ft.enum) return null;
  const e = ft.enum;
  if (e.type === 'inline') {
    return e.values.length ? { values: e.values, loose: e.loose ?? false } : null;
  }
  const resolved = dictionaries?.[e.ref];
  return resolved?.length ? { values: resolved, loose: e.loose ?? false } : null;
};

export const defaultValue = (op: OperatorType, kind: ValueKind): SimpleValue | null =>
  match(op)
    .with(
      P.when((o) => NO_VALUE_OPS.includes(o)),
      () => null,
    )
    .with(
      'between',
      () => ({ type: 'interval', left: 0, right: 100, leftInclusive: true, rightInclusive: true }) as SimpleValue,
    )
    .with(
      'in',
      'notIn',
      () =>
        (kind === 'number' ? { type: 'numberArray', values: [] } : { type: 'stringArray', values: [] }) as SimpleValue,
    )
    .with(
      'dateAfter',
      'dateBefore',
      'dateSame',
      'dateSameOrAfter',
      'dateSameOrBefore',
      () => ({ type: 'date', value: dayjs().format('YYYY-MM-DD') }) as SimpleValue,
    )
    .with('timeGt', 'timeGte', 'timeLt', 'timeLte', () => ({ type: 'time', hour: 9, minute: 0 }) as SimpleValue)
    .with('dayOfWeekIn', () => ({ type: 'intArray', values: [1, 2, 3, 4, 5] }) as SimpleValue)
    .with('quarterIn', () => ({ type: 'intArray', values: [1] }) as SimpleValue)
    .with('startsWith', 'endsWith', 'contains', () => ({ type: 'string', value: '' }) as SimpleValue)
    .otherwise(() =>
      match(kind)
        .with('number', () => ({ type: 'number', value: 0 }) as SimpleValue)
        .with('boolean', () => ({ type: 'boolean', value: true }) as SimpleValue)
        .otherwise(() => ({ type: 'string', value: '' }) as SimpleValue),
    );

const OpIcon: FunctionalComponent<{ op: Op; size: number; className?: string }> = ({ op, size, className }) =>
  op.icon
    ? h(op.icon, { size, class: className, style: op.rotate ? { transform: 'rotate(180deg)' } : undefined })
    : h('span', { class: className, style: { fontSize: `${size}px` } }, op.symbol);
OpIcon.props = {
  op: { type: Object as PropType<Op>, required: true },
  size: { type: Number, required: true },
  className: { type: String, default: undefined },
};

export const inferKindFromExpr = (data: ExpressionBuilderData): ValueKind | null => {
  if (data.kind !== 'simple') return null;
  const op = data.operator.type;
  if (op.startsWith('date') || op.startsWith('time') || op === 'dayOfWeekIn' || op === 'quarterIn') return 'date';
  if (['startsWith', 'endsWith', 'contains'].includes(op)) return 'string';
  const val = data.value;
  if (!val) return null;
  return match(val.type)
    .with('string', 'stringArray', () => 'string' as const)
    .with('number', 'numberArray', 'interval', () => 'number' as const)
    .with('boolean', () => 'boolean' as const)
    .with('date', 'time', () => 'date' as const)
    .otherwise(() => null);
};

export const isExprCompatibleWithKind = (data: ExpressionBuilderData, kind: ValueKind): boolean => {
  if (data.kind !== 'simple') return true;
  const op = data.operator.type;
  if (!OPS_BY_KIND[kind].includes(op)) return false;
  if (NO_VALUE_OPS.includes(op)) return true;
  const val = data.value;
  if (!val) return true;
  return match(kind)
    .with('boolean', () => val.type === 'boolean')
    .with('number', () => ['number', 'numberArray', 'interval'].includes(val.type))
    .with('string', () => ['string', 'stringArray'].includes(val.type))
    .with('date', () => ['date', 'time', 'intArray'].includes(val.type))
    .with('any', () => true)
    .exhaustive();
};

// useExpressionState — the same hook as upstream, as a Vue composable.
const useExpressionState = (value: () => string, onChange: (v: string) => void) => {
  const expr = computed(() => {
    const e = ExpressionBuilderWasm.parseUnary(value());
    const d = e.toJson() as ExpressionBuilderData;
    e.free();
    return d;
  });

  const update = (d: ExpressionBuilderData) => {
    const e = ExpressionBuilderWasm.fromJson(d);
    onChange(e.serialize());
    e.free();
  };

  const setVal = (v: SimpleValue | null) => {
    if (expr.value.kind === 'simple') update({ kind: 'simple', operator: expr.value.operator, value: v });
  };

  const isCustom = ref(expr.value.kind === 'complex');
  watch(
    () => expr.value.kind,
    (kind) => {
      if (kind === 'complex') isCustom.value = true;
    },
  );

  const setIsCustom = (v: boolean) => {
    isCustom.value = v;
  };
  const toggleCustom = () => {
    isCustom.value = !isCustom.value;
  };

  return { expr, update, setVal, isCustom, setIsCustom, toggleCustom };
};

type OpDropdownProps = {
  kind: ValueKind;
  operator: OperatorType;
  isCustom?: boolean;
  onSelect: (op: OperatorType) => void;
  onKindChange?: (kind: ValueKind) => void;
  onCustomToggle?: () => void;
  disabled?: boolean;
};

const OpDropdown = defineComponent({
  name: 'OpDropdown',
  props: {
    kind: { type: String as PropType<ValueKind>, required: true },
    operator: { type: String as PropType<OperatorType>, required: true },
    isCustom: { type: Boolean, default: false },
    // PORTING: internal subcomponents keep upstream's callback props
    // (onSelect/onKindChange/onCustomToggle) rather than emits.
    onSelect: { type: Function as PropType<(op: OperatorType) => void>, required: true },
    onKindChange: { type: Function as PropType<(kind: ValueKind) => void>, default: undefined },
    onCustomToggle: { type: Function as PropType<() => void>, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props) {
    const open = ref(false);
    const search = ref('');

    const grid = computed(() => GRID_OPS[props.kind].map(getOp));
    const list = computed(() => OPS_BY_KIND[props.kind].filter((t) => !GRID_OPS[props.kind].includes(t)).map(getOp));
    const filtered = computed(() =>
      list.value.filter((o) => !search.value || o.label.toLowerCase().includes(search.value.toLowerCase())),
    );

    const pick = (t: OperatorType) => {
      props.onSelect(t);
      open.value = false;
      search.value = '';
    };

    return () =>
      // antd Popover → ui/Popover (placement bottomLeft → side bottom/align
      // start; overlayClassName → contentClass; arrow={false} by default).
      h(
        Popover,
        {
          'open': open.value,
          'onUpdate:open': (v: boolean) => {
            open.value = v;
            if (!v) search.value = '';
          },
          'side': 'bottom',
          'align': 'start',
          'contentClass': 'op-dropdown-popover',
        },
        {
          trigger: () =>
            h('button', { class: clsx('op-trigger', { disabled: props.disabled }), disabled: props.disabled }, [
              props.isCustom ? h(SquareFunctionIcon, { size: 14 }) : h(OpIcon, { op: getOp(props.operator), size: 14 }),
            ]),
          default: () =>
            h('div', { class: 'op-panel' }, [
              props.onKindChange
                ? h(
                    'div',
                    { class: 'op-types' },
                    VALUE_KINDS.map((t) =>
                      h(
                        'button',
                        {
                          key: t.kind,
                          class: clsx('op-type-btn', { active: t.kind === props.kind }),
                          onClick: () => props.onKindChange?.(t.kind),
                        },
                        t.label,
                      ),
                    ),
                  )
                : null,
              h('div', { class: 'op-body' }, [
                h('div', { class: 'op-grid' }, [
                  ...grid.value.map((o) =>
                    h(
                      'button',
                      {
                        key: o.type,
                        class: clsx('op-tile', { active: o.type === props.operator && !props.isCustom }),
                        onClick: () => pick(o.type),
                      },
                      [
                        h(OpIcon, { op: o, size: 20, className: 'op-tile-icon' }),
                        h('span', { class: 'op-tile-label' }, o.label),
                      ],
                    ),
                  ),
                  props.onCustomToggle
                    ? h(
                        'button',
                        {
                          class: clsx('op-tile', 'op-tile-wide', { active: props.isCustom }),
                          onClick: () => {
                            props.onCustomToggle?.();
                            open.value = false;
                          },
                        },
                        [
                          h(SquareFunctionIcon, { size: 20, class: 'op-tile-icon' }),
                          h('span', { class: 'op-tile-label' }, 'custom'),
                        ],
                      )
                    : null,
                ]),
                list.value.length > 0
                  ? h('div', { class: 'op-list-section' }, [
                      h('input', {
                        class: 'op-search',
                        placeholder: 'Search...',
                        value: search.value,
                        onInput: (e: Event) => {
                          search.value = (e.target as HTMLInputElement).value;
                        },
                      }),
                      h('div', { class: 'op-list' }, [
                        ...filtered.value.map((o) =>
                          h(
                            'button',
                            {
                              key: o.type,
                              class: clsx('op-row', { active: o.type === props.operator && !props.isCustom }),
                              onClick: () => pick(o.type),
                            },
                            [
                              h(OpIcon, { op: o, size: 16, className: 'op-row-icon' }),
                              h('span', { class: 'op-row-label' }, o.label),
                            ],
                          ),
                        ),
                        !filtered.value.length ? h('div', { class: 'op-empty' }, 'No matches') : null,
                      ]),
                    ])
                  : null,
              ]),
            ]),
        },
      );
  },
});

type ValInputProps = {
  value: SimpleValue | null;
  onChange: (v: SimpleValue | null) => void;
  operator: OperatorType;
  kind: ValueKind;
  disabled?: boolean;
};

type SimpleInputProps = { value: SimpleValue | null; onChange: (v: SimpleValue) => void; disabled?: boolean };

const simpleInputProps = {
  value: { type: Object as PropType<SimpleValue | null>, default: null },
  onChange: { type: Function as PropType<(v: SimpleValue) => void>, required: true },
  disabled: { type: Boolean, default: false },
  // PORTING: `as const` keeps `required: true` literal — without it the
  // widened `boolean` makes Vue's type inference treat onChange as optional.
} as const;

const StrInput = defineComponent({
  name: 'StrInput',
  props: simpleInputProps,
  setup(props) {
    const externalText = computed(() => (props.value?.type === 'string' ? props.value.value : ''));
    const text = ref(externalText.value);
    watch(externalText, (v) => {
      if (text.value !== v) {
        text.value = v;
      }
    });
    const commit = () => props.onChange({ type: 'string', value: text.value });
    return () =>
      h(AutosizeTextArea, {
        class: 'eb-input',
        value: text.value,
        maxRows: 3,
        // PORTING: the ported AutosizeTextArea emits the text value (antd's
        // TextArea handed upstream the event, which read e.target.value).
        onChange: (v: string) => {
          text.value = v;
        },
        onBlur: commit,
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' && !e.shiftKey) commit();
        },
        disabled: props.disabled,
      });
  },
});

const NumInput = defineComponent({
  name: 'NumInput',
  props: simpleInputProps,
  setup: (props) => () =>
    h(InputNumber, {
      'class': 'eb-number',
      'modelValue': props.value?.type === 'number' ? props.value.value : 0,
      // antd InputNumber onChange → ui/InputNumber update:modelValue.
      'onUpdate:modelValue': (v: number | null) => v !== null && props.onChange({ type: 'number', value: v }),
      'disabled': props.disabled,
    }),
});

// PORTING: antd Select took boolean option values; ui/Select is string-typed,
// so true/false are stringified at the boundary.
const BOOL_OPTIONS = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
];

const wrapSelect = (className: string, extra: Record<string, unknown> = {}) =>
  // PORTING: ui/Select's root (reka SelectRoot) renders no element, so the
  // antd className sits on a wrapper div instead of the Select itself.
  h('div', { class: className }, [h(Select, extra)]);

const BoolInput = defineComponent({
  name: 'BoolInput',
  props: simpleInputProps,
  setup: (props) => () =>
    wrapSelect('eb-select', {
      'modelValue': String(props.value?.type === 'boolean' ? props.value.value : true),
      'options': BOOL_OPTIONS,
      'onUpdate:modelValue': (v: string) => props.onChange({ type: 'boolean', value: v === 'true' }),
      'disabled': props.disabled,
    }),
});

const DateInput = defineComponent({
  name: 'DateInput',
  props: simpleInputProps,
  setup(props) {
    const dateVal = computed(() => (props.value?.type === 'date' ? props.value.value : dayjs().format('YYYY-MM-DD')));
    const granularity = computed(() => (props.value?.type === 'date' ? props.value.granularity : undefined));
    return () => [
      h(DatePicker, {
        'class': 'eb-date',
        'modelValue': dayjs(dateVal.value),
        'onUpdate:modelValue': (d: Dayjs | null) =>
          d && props.onChange({ type: 'date', value: d.format('YYYY-MM-DD'), granularity: granularity.value }),
        'disabled': props.disabled,
        'allowClear': false,
      }),
      wrapSelect('eb-granularity', {
        'modelValue': granularity.value ?? '',
        'options': GRANULARITIES,
        'onUpdate:modelValue': (g: string) =>
          props.onChange({ type: 'date', value: dateVal.value, granularity: g || undefined }),
        'disabled': props.disabled,
      }),
    ];
  },
});

const TimeInput = defineComponent({
  name: 'TimeInput',
  props: simpleInputProps,
  setup: (props) => () =>
    h(TimePicker, {
      'class': 'eb-time',
      'modelValue':
        props.value?.type === 'time'
          ? dayjs().hour(props.value.hour).minute(props.value.minute)
          : dayjs().hour(9).minute(0),
      'onUpdate:modelValue': (t: Dayjs | null) =>
        t && props.onChange({ type: 'time', hour: t.hour(), minute: t.minute() }),
      'disabled': props.disabled,
      'format': 'HH:mm',
      'allowClear': false,
      'needConfirm': false,
    }),
});

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 7, l: 'Sun' },
];
const QUARTERS = [
  { v: 1, l: 'Q1' },
  { v: 2, l: 'Q2' },
  { v: 3, l: 'Q3' },
  { v: 4, l: 'Q4' },
];

const ChipInput = defineComponent({
  name: 'ChipInput',
  props: {
    ...simpleInputProps,
    options: { type: Array as PropType<{ v: number; l: string }[]>, required: true },
    defaultValues: { type: Array as PropType<number[]>, required: true },
  },
  setup(props) {
    const valid = computed(() => new Set(props.options.map((o) => o.v)));
    const raw = computed(() => (props.value?.type === 'intArray' ? props.value.values : props.defaultValues));
    const sel = computed(() => raw.value.filter((v) => valid.value.has(v)));

    // Upstream's useEffect also runs on mount; `immediate` keeps that timing.
    watch(
      [() => sel.value.length, () => raw.value.length],
      () => {
        if (sel.value.length !== raw.value.length && sel.value.length > 0) {
          props.onChange({ type: 'intArray', values: sel.value });
        }
      },
      { immediate: true },
    );

    const toggle = (v: number) => {
      if (props.disabled) return;
      const next = sel.value.includes(v) ? sel.value.filter((x) => x !== v) : [...sel.value, v].sort((a, b) => a - b);
      if (next.length) props.onChange({ type: 'intArray', values: next });
    };
    return () =>
      h(
        'div',
        { class: 'eb-chips' },
        props.options.map((o) =>
          h(
            'span',
            {
              key: o.v,
              class: clsx('eb-chip', { active: sel.value.includes(o.v), disabled: props.disabled }),
              onClick: () => toggle(o.v),
            },
            o.l,
          ),
        ),
      );
  },
});

const ArrayInput = defineComponent({
  name: 'ArrayInput',
  props: {
    ...simpleInputProps,
    kind: { type: String as PropType<ValueKind>, required: true },
  },
  setup(props) {
    const vals = computed(() =>
      props.value?.type === 'stringArray'
        ? props.value.values
        : props.value?.type === 'numberArray'
          ? props.value.values.map(String)
          : [],
    );
    return () =>
      h(MultiSelect, {
        'class': 'eb-tags',
        'mode': 'tags',
        'modelValue': vals.value,
        'onUpdate:modelValue': (v: string[]) =>
          props.onChange(
            props.kind === 'number'
              ? { type: 'numberArray', values: v.map((x) => parseFloat(x)).filter((n) => !isNaN(n)) }
              : { type: 'stringArray', values: v },
          ),
        'disabled': props.disabled,
        'tokenSeparators': [','],
      });
  },
});

const IntervalInput = defineComponent({
  name: 'IntervalInput',
  props: simpleInputProps,
  setup(props) {
    // antd theme.useToken() → --grl-* tokens (the '..' span is styled by the
    // .eb-interval-separator class instead of token.colorTextSecondary).
    const iv = computed(() =>
      props.value?.type === 'interval'
        ? props.value
        : { type: 'interval' as const, left: 0, right: 100, leftInclusive: true, rightInclusive: true },
    );
    const upd = (p: Partial<{ left: number; right: number; leftInclusive: boolean; rightInclusive: boolean }>) =>
      props.onChange({ ...iv.value, ...p, type: 'interval' });
    return () =>
      h('div', { class: 'eb-interval' }, [
        h(
          'span',
          { class: 'eb-bracket', onClick: () => !props.disabled && upd({ leftInclusive: !iv.value.leftInclusive }) },
          iv.value.leftInclusive ? '[' : '(',
        ),
        h(InputNumber, {
          'class': 'eb-interval-num',
          'modelValue': iv.value.left,
          'onUpdate:modelValue': (v: number | null) => v !== null && upd({ left: v }),
          'disabled': props.disabled,
        }),
        h('span', { class: 'eb-interval-separator' }, '..'),
        h(InputNumber, {
          'class': 'eb-interval-num',
          'modelValue': iv.value.right,
          'onUpdate:modelValue': (v: number | null) => v !== null && upd({ right: v }),
          'disabled': props.disabled,
        }),
        h(
          'span',
          { class: 'eb-bracket', onClick: () => !props.disabled && upd({ rightInclusive: !iv.value.rightInclusive }) },
          iv.value.rightInclusive ? ']' : ')',
        ),
      ]);
  },
});

const EnumValInput = defineComponent({
  name: 'EnumValInput',
  props: {
    value: { type: Object as PropType<SimpleValue | null>, default: null },
    onChange: { type: Function as PropType<(v: SimpleValue) => void>, required: true },
    operator: { type: String as PropType<OperatorType>, required: true },
    options: { type: Array as PropType<{ label: string; value: string }[]>, required: true },
    loose: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      match(props.operator)
        .with('in', 'notIn', () =>
          // antd Select mode multiple/tags → ui/MultiSelect.
          h(MultiSelect, {
            'class': 'eb-enum',
            'mode': props.loose ? 'tags' : 'multiple',
            'modelValue': props.value?.type === 'stringArray' ? props.value.values : [],
            'onUpdate:modelValue': (v: string[]) => props.onChange({ type: 'stringArray', values: v }),
            'options': props.options,
            'disabled': props.disabled,
            // PORTING: antd single-select showSearch is dropped (ui/Select
            // has no search); MultiSelect implements it for tags mode.
            'filterOption': enumFilterOption,
            ...(props.loose ? { tokenSeparators: [','] } : {}),
          }),
        )
        .with('eq', 'neq', () =>
          props.loose
            ? h(MultiSelect, {
                'class': 'eb-enum',
                'mode': 'tags',
                'maxCount': 1,
                'modelValue': props.value?.type === 'string' && props.value.value ? [props.value.value] : [],
                'onUpdate:modelValue': (v: string[]) => props.onChange({ type: 'string', value: v[0] ?? '' }),
                'options': props.options,
                'disabled': props.disabled,
                'filterOption': enumFilterOption,
              })
            : h('div', { class: 'eb-enum' }, [
                h(Select, {
                  // PORTING: upstream passes variant='borderless' and
                  // suffixIcon={null} (showSearch/filterOption drop noted
                  // above in the loose branch applies here too).
                  'borderless': true,
                  'hideArrow': true,
                  'modelValue': props.value?.type === 'string' ? props.value.value : undefined,
                  'onUpdate:modelValue': (v: string) => props.onChange({ type: 'string', value: v }),
                  'options': props.options,
                  'disabled': props.disabled,
                }),
              ]),
        )
        .otherwise(() => h(StrInput, { value: props.value, onChange: props.onChange, disabled: props.disabled }));
  },
});

const ValInput: FunctionalComponent<ValInputProps> = (props) =>
  match(props.operator)
    .with('between', () => h(IntervalInput, { value: props.value, onChange: props.onChange, disabled: props.disabled }))
    .with('in', 'notIn', () =>
      h(ArrayInput, { value: props.value, onChange: props.onChange, kind: props.kind, disabled: props.disabled }),
    )
    .with('dateAfter', 'dateBefore', 'dateSame', 'dateSameOrAfter', 'dateSameOrBefore', () =>
      h(DateInput, { value: props.value, onChange: props.onChange, disabled: props.disabled }),
    )
    .with('timeGt', 'timeGte', 'timeLt', 'timeLte', () =>
      h(TimeInput, { value: props.value, onChange: props.onChange, disabled: props.disabled }),
    )
    .with('dayOfWeekIn', () =>
      h(ChipInput, {
        value: props.value,
        onChange: props.onChange,
        disabled: props.disabled,
        options: DAYS,
        defaultValues: [1, 2, 3, 4, 5],
      }),
    )
    .with('quarterIn', () =>
      h(ChipInput, {
        value: props.value,
        onChange: props.onChange,
        disabled: props.disabled,
        options: QUARTERS,
        defaultValues: [1],
      }),
    )
    .otherwise(() =>
      match(props.kind)
        .with('boolean', () => h(BoolInput, { value: props.value, onChange: props.onChange, disabled: props.disabled }))
        .with('number', () => h(NumInput, { value: props.value, onChange: props.onChange, disabled: props.disabled }))
        .otherwise(() => h(StrInput, { value: props.value, onChange: props.onChange, disabled: props.disabled })),
    );
ValInput.props = {
  value: { type: Object as PropType<SimpleValue | null>, default: null },
  onChange: { type: Function as PropType<(v: SimpleValue | null) => void>, required: true },
  operator: { type: String as PropType<OperatorType>, required: true },
  kind: { type: String as PropType<ValueKind>, required: true },
  disabled: { type: Boolean, default: false },
};
</script>

<script setup lang="ts">
import './expression-builder.scss';
import { focusBuilderRoot } from './focus-helper';

// PORTING(P7): unknown attrs pass through to the builder root, standing in
// for upstream's prop spread onto the root div.
defineOptions({ inheritAttrs: false });

// withDefaults mirrors upstream's destructuring defaults
// ({ disabled = false, maxRows = 3 }).
const props = withDefaults(defineProps<ExpressionBuilderProps>(), {
  disabled: false,
  maxRows: 3,
});

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const rootRef = ref<HTMLDivElement | null>(null);
const dictionaries = useDictionaries();

// PORTING(P2): upstream forwards useImperativeHandle({ focus }) — exposed
// here via defineExpose.
defineExpose({ focus: () => focusBuilderRoot(rootRef.value) });

const styleVars = computed(() => ({ '--b-max-rows': props.maxRows }));

const onChange = (v: string) => emit('update:modelValue', v);

const enumResult = computed(() => getEnumOptions(props.fieldType, dictionaries));
const enumOpts = computed(() => enumResult.value?.values ?? null);
const isLoose = computed(() => enumResult.value?.loose ?? false);
const externalKind = computed(() => getValueKind(props.fieldType));
const isEnum = computed(() => !!enumOpts.value?.length);
const isAutoType = computed(() => !isEnum.value && externalKind.value === 'any');
const { expr, update, setVal, isCustom, setIsCustom, toggleCustom } = useExpressionState(
  () => props.modelValue,
  onChange,
);
const localKind = ref<ValueKind | null>(null);
const kind = computed<ValueKind>(() =>
  isEnum.value
    ? 'string'
    : isAutoType.value
      ? (localKind.value ?? inferKindFromExpr(expr.value) ?? 'string')
      : externalKind.value,
);
const forceCustom = computed(
  () => !isAutoType.value && expr.value.kind === 'simple' && !isExprCompatibleWithKind(expr.value, kind.value),
);

const setKind = (newKind: ValueKind) => {
  localKind.value = newKind;
  const defaultOp = OPS_BY_KIND[newKind][0];
  update({
    kind: 'simple',
    operator: { type: defaultOp } as SimpleOperator,
    value: defaultValue(defaultOp, newKind),
  });
};

const setOp = (op: OperatorType) => {
  const cur = expr.value.kind === 'simple' ? expr.value.value : null;
  const canReuse = (t: string) => cur?.type === t;
  const val = match(op)
    .with(
      P.when((o) => NO_VALUE_OPS.includes(o)),
      () => null,
    )
    .with('between', () => (canReuse('interval') ? cur : defaultValue(op, kind.value)))
    .with('in', 'notIn', () =>
      canReuse('stringArray') || canReuse('numberArray') ? cur : defaultValue(op, kind.value),
    )
    .with('dateAfter', 'dateBefore', 'dateSame', 'dateSameOrAfter', 'dateSameOrBefore', () =>
      canReuse('date') ? cur : defaultValue(op, kind.value),
    )
    .with('timeGt', 'timeGte', 'timeLt', 'timeLte', () => (canReuse('time') ? cur : defaultValue(op, kind.value)))
    .with('dayOfWeekIn', 'quarterIn', () => (canReuse('intArray') ? cur : defaultValue(op, kind.value)))
    .with('startsWith', 'endsWith', 'contains', () => (canReuse('string') ? cur : defaultValue(op, kind.value)))
    .otherwise(() => {
      const expected = kind.value === 'number' ? 'number' : kind.value === 'boolean' ? 'boolean' : 'string';
      return canReuse(expected) ? cur : defaultValue(op, kind.value);
    });
  update({ kind: 'simple', operator: { type: op } as SimpleOperator, value: val });
};

const handleSelectOp = (op: OperatorType) => {
  setIsCustom(false);
  setOp(op);
};

// Upstream's post-narrow `const op = expr.operator.type` / `expr.value` reads,
// as computeds (template expressions can't narrow the union the way the JSX
// branches after the early return did).
const op = computed<OperatorType>(() =>
  expr.value.kind === 'simple' ? expr.value.operator.type : ('eq' as OperatorType),
);
const simpleValue = computed<SimpleValue | null>(() => (expr.value.kind === 'simple' ? expr.value.value : null));
</script>

<template>
  <div
    v-if="isCustom || forceCustom || expr.kind === 'complex'"
    ref="rootRef"
    v-bind="$attrs"
    class="eb"
    :style="styleVars"
  >
    <OpDropdown
      :kind="kind"
      :operator="op"
      is-custom
      :on-select="handleSelectOp"
      :on-kind-change="isAutoType ? setKind : undefined"
      :on-custom-toggle="toggleCustom"
      :disabled="disabled"
    />
    <CodeEditorBase
      class="eb-code"
      :value="modelValue"
      type="unary"
      :disabled="disabled"
      no-style
      :max-rows="maxRows"
      placeholder="Expression..."
      @change="onChange"
    />
  </div>
  <div v-else ref="rootRef" v-bind="$attrs" class="eb" :style="styleVars">
    <OpDropdown
      :kind="kind"
      :operator="op"
      :on-select="handleSelectOp"
      :on-kind-change="isAutoType ? setKind : undefined"
      :on-custom-toggle="toggleCustom"
      :disabled="disabled"
    />
    <span v-if="NO_VALUE_OPS.includes(op) && op !== 'any'" class="eb-label">{{ getOp(op).label }}</span>
    <EnumValInput
      v-else-if="isEnum"
      :value="simpleValue"
      :on-change="setVal"
      :operator="op"
      :options="enumOpts ?? []"
      :loose="isLoose"
      :disabled="disabled"
    />
    <ValInput v-else :value="simpleValue" :on-change="setVal" :operator="op" :kind="kind" :disabled="disabled" />
  </div>
</template>
