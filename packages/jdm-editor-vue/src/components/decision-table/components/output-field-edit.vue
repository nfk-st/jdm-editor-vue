<script lang="ts">
// Ported from components/decision-table/components/output-field-edit.tsx.
// PORTING: `trigger` React prop → default slot; onChange/onRemove/onCreate
// props → 'change'/'remove'/'create' emits (h() call sites pass onXxx
// listeners, which Vue maps onto those emits).
import type { ColumnEnum, OutputFieldType } from '../../../helpers/schema';

const getEnumFromFieldType = (ft?: OutputFieldType): ColumnEnum | undefined => {
  if (!ft) return undefined;
  if (ft.type === 'string' || ft.type === 'string-array') return ft.enum;
  return undefined;
};

export type OutputFieldEditProps = {
  disabled?: boolean;
  value?: string;
  fieldType?: OutputFieldType;
  mode?: 'edit' | 'create';
};
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { OUTPUT_FIELD_TYPE_OPTIONS } from '../../../helpers/schema';
import AutosizeTextArea from '../../autosize-text-area.vue';
import Checkbox from '../../ui/Checkbox.vue';
import Input from '../../ui/Input.vue';
import Select from '../../ui/Select.vue';
import { useDecisionTableState } from '../context/dt-store.context';
import { ENUM_MODE_OPTIONS, type EnumMode, getEnumMode, parseEnumString, serializeEnumValues } from './enum-utils';
import FieldEditPopover from './field-edit-popover.vue';
import FieldTypeTags from './field-type-tags.vue';

const props = withDefaults(defineProps<OutputFieldEditProps>(), { mode: 'edit' });

const emit = defineEmits<{
  (e: 'change', value: string, fieldType?: OutputFieldType): void;
  (e: 'remove'): void;
  (e: 'create', name: string, field: string, outputFieldType?: OutputFieldType): void;
}>();

const dictionariesState = useDecisionTableState((s) => s.dictionaries);
const dictionaries = computed(() => dictionariesState.value ?? {});
const uiMode = useDecisionTableState((s) => s.mode);
const showAdvanced = computed(() => uiMode.value === 'business');

const open = ref(false);
const innerName = ref('');
const innerValue = ref(props.value);
const innerFieldType = ref<OutputFieldType['type']>(props.fieldType?.type ?? 'auto');
const ftEnum = computed(() => getEnumFromFieldType(props.fieldType));
const enumMode = ref<EnumMode>(getEnumMode(ftEnum.value));
const enumText = ref(ftEnum.value?.type === 'inline' ? serializeEnumValues(ftEnum.value.values) : '');
const enumRef = ref(ftEnum.value?.type === 'ref' ? ftEnum.value.ref : '');
const enumLoose = ref(ftEnum.value?.loose ?? false);
const input = ref<InstanceType<typeof Input> | null>(null);

// PORTING: post-flush watch stands in for upstream's useEffect([open]) —
// refs into the freshly-mounted popover content are set by then.
watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    if (props.mode === 'create') {
      innerName.value = '';
      innerValue.value = '';
      innerFieldType.value = 'auto';
      enumMode.value = 'none';
      enumText.value = '';
      enumRef.value = '';
      enumLoose.value = false;
      setTimeout(() => {
        input.value?.focus();
      });
    } else {
      innerValue.value = props.value;
      innerFieldType.value = props.fieldType?.type ?? 'auto';
      const e = getEnumFromFieldType(props.fieldType);
      enumMode.value = getEnumMode(e);
      enumText.value = e?.type === 'inline' ? serializeEnumValues(e.values) : '';
      enumRef.value = e?.type === 'ref' ? e.ref : '';
      enumLoose.value = e?.loose ?? false;
      if (!input.value) return;

      input.value.focus();
      input.value.select();
    }
  },
  { flush: 'post' },
);

const supportsEnum = computed(() => innerFieldType.value === 'string' || innerFieldType.value === 'string-array');

const buildOutputFieldType = (): OutputFieldType | undefined => {
  if (!showAdvanced.value) return props.fieldType?.type === 'auto' ? undefined : props.fieldType;
  if (innerFieldType.value === 'auto') return undefined;
  if (innerFieldType.value === 'string' || innerFieldType.value === 'string-array') {
    let enumConfig: ColumnEnum | undefined;
    if (enumMode.value === 'inline') {
      const items = parseEnumString(enumText.value);
      if (items.length) enumConfig = { type: 'inline', values: items, ...(enumLoose.value ? { loose: true } : {}) };
    } else if (enumMode.value === 'ref' && enumRef.value) {
      enumConfig = { type: 'ref', ref: enumRef.value, ...(enumLoose.value ? { loose: true } : {}) };
    }
    return { type: innerFieldType.value, ...(enumConfig ? { enum: enumConfig } : {}) };
  }
  return { type: innerFieldType.value } as OutputFieldType;
};

const handleSubmit = () => {
  if (props.mode === 'create') {
    emit('create', innerName.value || 'Output', innerValue.value ?? 'output', buildOutputFieldType());
  } else {
    emit('change', innerValue.value ?? '', buildOutputFieldType());
  }
  open.value = false;
};

const enumModeOptions = computed(() =>
  Object.keys(dictionaries.value).length ? ENUM_MODE_OPTIONS : ENUM_MODE_OPTIONS.filter((o) => o.value !== 'ref'),
);
const dictionaryOptions = computed(() => Object.keys(dictionaries.value).map((k) => ({ label: k, value: k })));
</script>

<template>
  <FieldEditPopover
    :value="value"
    :open="open"
    :disabled="disabled"
    :trigger-class-name="mode === 'edit' ? 'grl-field-edit--output' : undefined"
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

    <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '2px' }">
      Output Field
    </span>
    <Input ref="input" v-model="innerValue" :read-only="disabled" />
    <div v-if="mode === 'create'" :style="{ marginTop: '12px' }">
      <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '2px' }">Label</span>
      <Input v-model="innerName" placeholder="Field label" :disabled="disabled" />
    </div>
    <div v-if="showAdvanced" :style="{ marginTop: '16px' }">
      <span class="grl-typography" :style="{ fontSize: '12px', display: 'block', marginBottom: '4px' }">Type</span>
      <FieldTypeTags
        :options="OUTPUT_FIELD_TYPE_OPTIONS"
        :model-value="innerFieldType"
        :disabled="disabled"
        @update:model-value="(v) => (innerFieldType = v as OutputFieldType['type'])"
      />
    </div>
    <div v-if="showAdvanced && supportsEnum" :style="{ marginTop: '12px' }">
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
