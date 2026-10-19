<script lang="ts">
export type DiffAutosizeTextAreaProps = {
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  noStyle?: boolean;
  maxRows: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
};
</script>

<script setup lang="ts">
import { ref } from 'vue';

import AutosizeTextArea from '../autosize-text-area.vue';

// Ported from components/shared/diff-text-area.tsx.
// PORTING(P2): upstream forwards its ref to the inner text area — exposed
// here as `textArea` (an AutosizeTextArea instance; `.el` is the div).
// PORTING(P7): unknown attrs pass through, standing in for upstream's prop spread.
defineOptions({ inheritAttrs: false });

defineProps<DiffAutosizeTextAreaProps>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();

const textAreaRef = ref<InstanceType<typeof AutosizeTextArea> | null>(null);
defineExpose({ textArea: textAreaRef });
</script>

<template>
  <div v-if="displayDiff" class="diff-text-area-group" :class="{ 'no-style': noStyle }">
    <!-- PORTING(P2): upstream spreads consumer props (disabled/readOnly) on the
         previous side too — only the change handler is stripped. -->
    <AutosizeTextArea
      v-if="(previousValue || '').length > 0"
      :value="previousValue"
      :max-rows="maxRows"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="readOnly"
      class="previous-input"
    />
    <AutosizeTextArea
      v-if="(modelValue || '').length > 0"
      v-bind="$attrs"
      :value="modelValue"
      :max-rows="maxRows"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="readOnly"
      class="current-input"
      @change="(v) => emit('update:modelValue', v)"
    />
  </div>
  <AutosizeTextArea
    v-else
    ref="textAreaRef"
    v-bind="$attrs"
    :value="modelValue"
    :max-rows="maxRows"
    :placeholder="placeholder"
    :disabled="disabled"
    :read-only="readOnly"
    @change="(v) => emit('update:modelValue', v)"
  />
</template>
