<script setup lang="ts">
// Ported from components/shared/diff-input.tsx.
import Input from '../ui/Input.vue';

const props = defineProps<{
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();
</script>

<template>
  <div v-if="displayDiff" class="diff-input-group">
    <Input
      v-if="(previousValue || '').length > 0"
      :model-value="previousValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="true"
      class="previous-input"
    />
    <Input
      v-if="(modelValue || '').length > 0"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="readOnly"
      class="current-input"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @change="(v) => emit('change', v)"
    />
  </div>
  <Input
    v-else
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :read-only="readOnly"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @change="(v) => emit('change', v)"
  />
</template>
