<script lang="ts">
// Ported from components/decision-table/components/input-field-edit.tsx.
// PORTING: `trigger` React prop → default slot (the trigger override);
// onChange/onRemove/onCreate props → 'change'/'remove'/'create' emits (the
// h() call sites in table-head-cell pass onXxx listeners, which Vue maps to
// those emits); CodeEditor uses our modelValue v-model convention.
import type { Variable } from '@gorules/zen-engine-wasm';

import type { ColumnEnum, ColumnFieldType } from '../../../helpers/schema';

export type InputFieldEditProps = {
  disabled?: boolean;
  value?: string;
  variableType?: unknown;
  inputData?: Variable;
  referenceData?: { field: string; value: unknown };
  fieldType?: ColumnFieldType;
  mode?: 'edit' | 'create';
};
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { COLUMN_FIELD_TYPE_OPTIONS } from '../../../helpers/schema';
import AutosizeTextArea from '../../autosize-text-area.vue';
import { CodeEditor, type CodeEditorRef } from '../../code-editor';
import CodeEditorPreview from '../../code-editor/ce-preview.vue';
import Checkbox from '../../ui/Checkbox.vue';
import Input from '../../ui/Input.vue';
import Select from '../../ui/Select.vue';
import { useDecisionTableState } from '../context/dt-store.context';
import { ENUM_MODE_OPTIONS, type EnumMode, getEnumMode, parseEnumString, serializeEnumValues } from './enum-utils';
import FieldEditPopover from './field-edit-popover.vue';
import FieldTypeTags from './field-type-tags.vue';

const props = withDefaults(defineProps<InputFieldEditProps>(), { mode: 'edit' });

const emit = defineEmits<{
  (e: 'change', value: string, fieldType?: ColumnFieldType): void;
  (e: 'remove'): void;
  (e: 'create', name: string, field: string, fieldType?: ColumnFieldType): void;
}>();

const dictionariesState = useDecisionTableState((s) => s.dictionaries);
const dictionaries = computed(() => dictionariesState.value ?? {});
const uiMode = useDecisionTableState((s) => s.mode);
const showAdvanced = computed(() => uiMode.value === 'business');

const open = ref(false);
const innerName = ref('');
const innerValue = ref(props.value);
const innerFieldType = ref<string>(props.fieldType?.type ?? 'any');
const ftEnum = computed(() => (props.fieldType?.type === 'string' ? props.fieldType.enum : undefined));
const enumMode = ref<EnumMode>(getEnumMode(ftEnum.value));
const enumText = ref(ftEnum.value?.type === 'inline' ? serializeEnumValues(ftEnum.value.values) : '');
const enumRef = ref(ftEnum.value?.type === 'ref' ? ftEnum.value.ref : '');
const enumLoose = ref(ftEnum.value?.loose ?? false);
const codeEditor = ref<CodeEditorRef | null>(null);

// PORTING: upstream re-runs this in useEffect([open]) after React commits the
// popover content; a post-flush watch gives the same guarantee (refs to the
// freshly-mounted popover content are set by then).
watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    if (props.mode === 'create') {
      innerName.value = '';
      innerValue.value = '';
      innerFieldType.value = 'any';
      enumMode.value = 'none';
      enumText.value = '';
      enumRef.value = '';
      enumLoose.value = false;
      setTimeout(() => {
        codeEditor.value?.codeMirror?.focus();
      });
    } else {
      innerValue.value = props.value;
      innerFieldType.value = props.fieldType?.type ?? 'any';
      const e = props.fieldType?.type === 'string' ? props.fieldType.enum : undefined;
      enumMode.value = getEnumMode(e);
      enumText.value = e?.type === 'inline' ? serializeEnumValues(e.values) : '';
      enumRef.value = e?.type === 'ref' ? e.ref : '';
      enumLoose.value = e?.loose ?? false;
      if (!codeEditor.value) return;

      setTimeout(() => {
        codeEditor.value?.codeMirror?.focus();
        // upstream reads .cm-content off the editor's container element
        const content = codeEditor.value?.el?.querySelector('.cm-content');
        const selection = window.getSelection();
        if (content && selection) selection.selectAllChildren(content);
      });
    }
  },
  { flush: 'post' },
);

const buildFieldType = (): ColumnFieldType | undefined => {
  if (!showAdvanced.value) return props.fieldType;
  if (innerFieldType.value === 'any') return undefined;
  if (innerFieldType.value === 'string') {
    let enumConfig: ColumnEnum | undefined;
    if (enumMode.value === 'inline') {
      const items = parseEnumString(enumText.value);
      if (items.length) enumConfig = { type: 'inline', values: items, ...(enumLoose.value ? { loose: true } : {}) };
    } else if (enumMode.value === 'ref' && enumRef.value) {
      enumConfig = { type: 'ref', ref: enumRef.value, ...(enumLoose.value ? { loose: true } : {}) };
    }
    return { type: 'string', ...(enumConfig ? { enum: enumConfig } : {}) };
  }
  return { type: innerFieldType.value } as ColumnFieldType;
};

const handleSubmit = () => {
  if (props.mode === 'create') {
    emit('create', innerName.value || 'New field', innerValue.value ?? '', buildFieldType());
  } else {
    emit('change', innerValue.value ?? '', buildFieldType());
  }
  open.value = false;
};

const enumModeOptions = computed(() =>
  Object.keys(dictionaries.value).length ? ENUM_MODE_OPTIONS : ENUM_MODE_OPTIONS.filter((o) => o.value !== 'ref'),
);
const dictionaryOptions = computed(() => Object.keys(dictionaries.value).map((k) => ({ label: k, value: k })));

const showTypeSection = computed(() => !!(showAdvanced.value && innerValue.value?.trim()));
const showEnumSection = computed(() => showTypeSection.value && innerFieldType.value === 'string');
</script>

<template>
  <FieldEditPopover
    :value="value"
    :open="open"
    :disabled="disabled"
    :mode="mode"
    @update:open="(o) => (open = o)"
    @submit="handleSubmit"
    @remove="emit('remove')"
  >
    <!-- PORTING: the consumer's trigger (upstream `trigger` prop) rides as this
         component's default slot — forwarded only when provided so
         FieldEditPopover's default pill still renders for trigger-less (edit
         mode) consumers. -->
    <template v-if="$slots.default" #trigger><slot /></template>

    <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '2px' }">Input Field</span>
    <CodeEditor
      ref="codeEditor"
      :model-value="innerValue"
      :variable-type="variableType"
      :disabled="disabled"
      @update:model-value="(v) => (innerValue = v)"
    />
    <div :style="{ marginTop: '16px' }">
      <CodeEditorPreview
        :expression="innerValue ?? ''"
        :input-data="inputData"
        :initial="referenceData ? { expression: referenceData.field, result: referenceData.value } : undefined"
      />
    </div>
    <div v-if="mode === 'create'" :style="{ marginTop: '12px' }">
      <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '2px' }">Label</span>
      <Input v-model="innerName" placeholder="Field label" :disabled="disabled" />
    </div>
    <div v-if="showTypeSection" :style="{ marginTop: '16px' }">
      <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '4px' }">Type</span>
      <FieldTypeTags
        :options="COLUMN_FIELD_TYPE_OPTIONS"
        :model-value="innerFieldType as ColumnFieldType['type']"
        :disabled="disabled"
        @update:model-value="(v) => (innerFieldType = v)"
      />
    </div>
    <div v-if="showEnumSection" :style="{ marginTop: '12px' }">
      <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '4px' }">Enum</span>
      <FieldTypeTags
        :options="enumModeOptions"
        :model-value="enumMode"
        :disabled="disabled"
        @update:model-value="(v) => (enumMode = v as EnumMode)"
      />
      <div v-if="enumMode === 'inline'" :style="{ marginTop: '8px' }">
        <AutosizeTextArea
          :max-rows="6"
          placeholder="United States;us&#10;Canada;ca&#10;Mexico"
          :value="enumText"
          :disabled="disabled"
          :style="{ fontSize: '12px' }"
          @change="(v) => (enumText = v)"
        />
        <span
          class="grl-typography grl-typography--secondary"
          :style="{ fontSize: '11px', display: 'block', marginTop: '2px' }"
        >
          One per line. Use "Label;value" format.
        </span>
      </div>
      <div v-if="enumMode === 'ref'" :style="{ marginTop: '8px' }">
        <Select
          :model-value="enumRef || undefined"
          placeholder="Select dictionary..."
          :disabled="disabled"
          :style="{ width: '100%' }"
          size="small"
          :options="dictionaryOptions"
          @update:model-value="(v) => (enumRef = v)"
        />
      </div>
      <div v-if="enumMode !== 'none'" :style="{ marginTop: '8px' }">
        <Checkbox :model-value="enumLoose" :disabled="disabled" @update:model-value="(v) => (enumLoose = v)">
          <span class="grl-typography" :style="{ fontSize: '12px' }">Allow custom values</span>
        </Checkbox>
      </div>
    </div>
  </FieldEditPopover>
</template>
