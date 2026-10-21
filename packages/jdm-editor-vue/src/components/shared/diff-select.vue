<script lang="ts">
export type DiffSelectProps = {
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  direction?: 'horizontal' | 'vertical';
  options?: { label: string; value: string }[];
  placeholder?: string;
  disabled?: boolean;
};
</script>

<script setup lang="ts">
import clsx from 'clsx';

import ArrowDiffIcon from '../arrow-diff-icon.vue';
import Select from '../ui/Select.vue';

// Ported from components/shared/diff-select.tsx (antd Space → inline flex).
// PORTING(P7): unknown attrs pass through to the live select.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DiffSelectProps>(), { direction: 'horizontal' });

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();
</script>

<template>
  <div class="grl-space" :style="{ flexDirection: direction === 'vertical' ? 'column' : 'row', gap: '8px' }">
    <template v-if="displayDiff">
      <Select
        v-bind="$attrs"
        :model-value="previousValue"
        :options="options"
        :placeholder="placeholder"
        disabled
        class="text-removed"
      />
      <ArrowDiffIcon />
    </template>
    <Select
      v-bind="$attrs"
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      :disabled="props.disabled || displayDiff"
      :class="clsx(displayDiff && 'text-added')"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @change="(v) => emit('change', v)"
    />
  </div>
</template>
