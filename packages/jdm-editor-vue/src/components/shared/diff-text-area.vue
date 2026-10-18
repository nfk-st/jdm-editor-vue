<script setup lang="ts">
// Ported from components/shared/diff-text-area.tsx.
import AutosizeTextArea from '../autosize-text-area.vue';

const props = defineProps<{
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  noStyle?: boolean;
  maxRows?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();
</script>

<template>
  <div v-if="displayDiff" class="diff-text-area-group" :class="{ 'no-style': noStyle }">
    <AutosizeTextArea
      v-if="(previousValue || '').length > 0"
      :value="previousValue"
      :max-rows="maxRows"
      :placeholder="placeholder"
      :disabled="true"
      class="previous-input"
    />
    <AutosizeTextArea
      v-if="(modelValue || '').length > 0"
      :value="modelValue"
      :max-rows="maxRows"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="readOnly"
      class="current-input"
      @change="(v) => emit('update:modelValue', v)"
      @input="(v) => emit('update:modelValue', v)"
    />
  </div>
  <AutosizeTextArea
    v-else
    :value="modelValue"
    :max-rows="maxRows"
    :placeholder="placeholder"
    :disabled="disabled"
    :read-only="readOnly"
    @change="(v) => emit('update:modelValue', v)"
    @input="(v) => emit('update:modelValue', v)"
  />
</template>
