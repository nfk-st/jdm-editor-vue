<script lang="ts">
// Ported from components/code-editor/business/standard-expression-builder.tsx
// — the standard (non-unary) expression builder used by decision tables.
import { type StandardExpressionData, parseStandardExpression } from '@gorules/zen-engine-wasm';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CalendarIcon,
  HashIcon,
  ListIcon,
  type LucideIcon,
  SquareFunctionIcon,
  ToggleLeftIcon,
  TypeIcon,
} from 'lucide-vue-next';

import type { ColumnEnum, OutputFieldType } from '../../../helpers/schema';
import { type DictionaryMap, useDictionaries } from '../../../theme';

export type { OutputFieldType };

// PORTING(public): upstream `value`/`onChange` → `modelValue` +
// `update:modelValue` per docs/PORTING.md's public-prop convention.
export type StandardExpressionBuilderProps = {
  modelValue: string;
  disabled?: boolean;
  fieldType?: OutputFieldType;
  maxRows?: number;
};

export type StandardExpressionBuilderRef = {
  focus: () => void;
};

const TYPE_ICONS: Record<Exclude<OutputFieldType['type'], 'auto'>, LucideIcon> = {
  'string': TypeIcon,
  'string-array': ListIcon,
  'number': HashIcon,
  'boolean': ToggleLeftIcon,
  'date': CalendarIcon,
};

// PORTING: upstream keeps these module-private; exported here for vitest
// coverage of the module's pure logic (upstream has no tests).
export const enumFilterOption = (input: string, option?: { label?: string; value?: string }) => {
  const search = input.toLowerCase();
  return (option?.label?.toLowerCase().includes(search) || option?.value?.toLowerCase().includes(search)) ?? false;
};

export const formatDateValue = (date: string): string => `d('${date}')`;
export const formatStringValue = (value: string): string => `"${value}"`;
export const formatStringArrayValue = (values: string[]): string =>
  !values.length ? '[]' : `[${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(', ')}]`;

export const parseStringArrayValue = (value: string): string[] => {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return [];
};

export const isStringArrayValue = (value: string): boolean => {
  if (!value?.trim() || value.trim() === '[]') return true;
  try {
    return Array.isArray(JSON.parse(value));
  } catch {}
  return false;
};

export const getEnumOptions = (
  ft?: OutputFieldType,
  dictionaries?: DictionaryMap,
): { values: { label: string; value: string }[]; loose: boolean } | null => {
  if (!ft) return null;
  if (ft.type !== 'string' && ft.type !== 'string-array') return null;
  const e: ColumnEnum | undefined = ft.enum;
  if (!e) return null;
  if (e.type === 'inline') {
    return e.values.length ? { values: e.values, loose: e.loose ?? false } : null;
  }
  const resolved = dictionaries?.[e.ref];
  return resolved?.length ? { values: resolved, loose: e.loose ?? false } : null;
};
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import AutosizeTextArea from '../../autosize-text-area.vue';
import CodeEditorBase from '../ce-base.vue';
import DatePicker from '../../ui/DatePicker.vue';
import InputNumber from '../../ui/InputNumber.vue';
import MultiSelect from '../../ui/MultiSelect.vue';
import Select from '../../ui/Select.vue';
import { focusBuilderRoot } from './focus-helper';
import './standard-expression-builder.scss';

// PORTING(P7): unknown attrs pass through to the builder root, standing in
// for upstream's prop spread onto the root div.
defineOptions({ inheritAttrs: false });

// withDefaults mirrors upstream's destructuring defaults
// ({ disabled = false, maxRows = 3 }).
const props = withDefaults(defineProps<StandardExpressionBuilderProps>(), {
  disabled: false,
  maxRows: 3,
});

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const rootRef = ref<HTMLDivElement | null>(null);
const dictionaries = useDictionaries();
const ftType = computed(() => props.fieldType?.type ?? 'auto');
const styleVars = computed(() => ({ '--b-max-rows': props.maxRows }));

// PORTING(P2): upstream forwards useImperativeHandle({ focus }) — exposed
// here via defineExpose.
defineExpose({ focus: () => focusBuilderRoot(rootRef.value) });

const onChange = (v: string) => emit('update:modelValue', v);

const parsed = computed<StandardExpressionData>(() => parseStandardExpression(props.modelValue));

const computeExprMode = () => {
  if (ftType.value === 'string-array') return !isStringArrayValue(props.modelValue);
  if (parsed.value.kind === 'expression') return true;
  if (ftType.value === 'auto') return false;
  return parsed.value.kind !== ftType.value;
};
const isExprMode = ref(computeExprMode());
// Upstream's useState(computeExprMode) + useEffect([ftType]) pair — the
// recomputation stays keyed to ftType only (value changes keep the user's
// manual mode choice).
watch(ftType, () => {
  isExprMode.value = computeExprMode();
});

const forceExprMode = computed(
  () =>
    ftType.value !== 'auto' &&
    ftType.value !== 'string-array' &&
    parsed.value.kind !== 'expression' &&
    parsed.value.kind !== ftType.value,
);

const TypeIcon = computed(() => (ftType.value !== 'auto' ? TYPE_ICONS[ftType.value] : null));
const enumOptions = computed(() => getEnumOptions(props.fieldType, dictionaries));

// Upstream's inline narrowed reads (`parsed.kind === 'string' ? parsed.value
// : …`), hoisted as computeds so the template avoids union narrowing.
const stringValue = computed(() => (parsed.value.kind === 'string' ? parsed.value.value : ''));
const numberValue = computed(() => (parsed.value.kind === 'number' ? parsed.value.value : 0));
const booleanValue = computed(() => (parsed.value.kind === 'boolean' ? parsed.value.value : true));
const dateValue = computed<Dayjs>(() => {
  const dateStr = parsed.value.kind === 'date' ? parsed.value.value : null;
  return dateStr && dayjs(dateStr).isValid() ? dayjs(dateStr) : dayjs();
});

const switchToValueMode = () => {
  if (parsed.value.kind !== ftType.value) {
    const t = ftType.value;
    if (t === 'string') onChange(formatStringValue(''));
    else if (t === 'number') onChange('0');
    else if (t === 'boolean') onChange('true');
    else if (t === 'date') onChange(formatDateValue(dayjs().format('YYYY-MM-DD')));
  }
  isExprMode.value = false;
};

// PORTING: antd Select took boolean option values; ui/Select is string-typed,
// so true/false are stringified at the boundary.
const BOOL_OPTIONS = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
];
</script>

<template>
  <div
    v-if="ftType === 'auto' || isExprMode || forceExprMode"
    ref="rootRef"
    v-bind="$attrs"
    class="seb"
    :style="styleVars"
  >
    <button
      v-if="ftType !== 'auto'"
      class="seb-mode-btn"
      :disabled="disabled"
      title="Currently: Expression. Click for value mode."
      @click="switchToValueMode"
    >
      <SquareFunctionIcon :size="14" />
    </button>
    <CodeEditorBase
      class="seb-code"
      :value="modelValue"
      type="standard"
      :disabled="disabled"
      no-style
      :max-rows="maxRows"
      @change="onChange"
    />
  </div>
  <div v-else ref="rootRef" v-bind="$attrs" class="seb" :style="styleVars">
    <button
      class="seb-mode-btn"
      :disabled="disabled"
      title="Currently: Value. Click for expression mode."
      @click="isExprMode = true"
    >
      <component :is="TypeIcon" v-if="TypeIcon" :size="14" />
    </button>
    <!-- PORTING: the ported AutosizeTextArea emits the text value (antd's
         TextArea handed upstream the event, which read e.target.value). -->
    <AutosizeTextArea
      v-if="ftType === 'string' && !enumOptions"
      class="seb-input"
      :value="stringValue"
      :max-rows="maxRows"
      :disabled="disabled"
      @change="(v) => onChange(formatStringValue(v))"
    />
    <div v-if="ftType === 'string' && enumOptions" class="seb-select">
      <Select
        :model-value="parsed.kind === 'string' ? parsed.value : undefined"
        :options="enumOptions.values"
        :disabled="disabled"
        @update:model-value="(v: string) => onChange(formatStringValue(v))"
      />
    </div>
    <MultiSelect
      v-if="ftType === 'string-array'"
      class="seb-select-multi"
      :mode="enumOptions && !enumOptions.loose ? 'multiple' : 'tags'"
      :model-value="parseStringArrayValue(modelValue)"
      :options="enumOptions?.values"
      :disabled="disabled"
      :filter-option="enumFilterOption"
      @update:model-value="(v: string[]) => onChange(formatStringArrayValue(v))"
    />
    <InputNumber
      v-if="ftType === 'number'"
      class="seb-number"
      :model-value="numberValue"
      :disabled="disabled"
      @update:model-value="(v: number | null) => onChange(String(v ?? 0))"
    />
    <div v-if="ftType === 'boolean'" class="seb-select">
      <Select
        :model-value="String(booleanValue)"
        :options="BOOL_OPTIONS"
        :disabled="disabled"
        @update:model-value="(v: string) => onChange(String(v === 'true'))"
      />
    </div>
    <DatePicker
      v-if="ftType === 'date'"
      class="seb-date"
      :value="dateValue"
      :disabled="disabled"
      :allow-clear="false"
      @change="(d: Dayjs | null) => d && onChange(formatDateValue(d.format('YYYY-MM-DD')))"
    />
  </div>
</template>
