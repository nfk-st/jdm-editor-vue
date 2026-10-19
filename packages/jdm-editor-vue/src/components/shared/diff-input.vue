<script lang="ts">
export type DiffInputProps = {
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
};
</script>

<script setup lang="ts">
import Input from '../ui/Input.vue';

// Ported from components/shared/diff-input.tsx.
// PORTING(P7): upstream spreads full InputProps; unknown attrs pass through
// to the underlying input to narrow that gap.
defineOptions({ inheritAttrs: false });

defineProps<DiffInputProps>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();
</script>

<template>
  <div v-if="displayDiff" class="diff-input-group">
    <!-- PORTING(P1): upstream strips only the change handler here; consumer
         disabled/readOnly pass through unchanged. -->
    <Input
      v-if="(previousValue || '').length > 0"
      :model-value="previousValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="readOnly"
      class="previous-input"
    />
    <Input
      v-if="(modelValue || '').length > 0"
      v-bind="$attrs"
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
    v-bind="$attrs"
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :read-only="readOnly"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @change="(v) => emit('change', v)"
  />
</template>
