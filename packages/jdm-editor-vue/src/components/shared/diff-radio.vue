<script lang="ts">
export type DiffRadioProps = {
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  options?: { label: string; value: string }[];
  disabled?: boolean;
};
</script>

<script setup lang="ts">
import clsx from 'clsx';

import RadioGroup from '../ui/RadioGroup.vue';

// Ported from components/shared/diff-radio.tsx.
// PORTING(P7): unknown attrs pass through to the radio group.
defineOptions({ inheritAttrs: false });

const props = defineProps<DiffRadioProps>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();

const itemClass = (option: { label: string; value: string }) =>
  clsx(
    props.displayDiff && option.value === props.previousValue && 'text-removed',
    props.displayDiff && option.value === props.modelValue && 'text-added',
  );
</script>

<template>
  <RadioGroup
    v-bind="$attrs"
    :model-value="modelValue"
    :options="options"
    :disabled="disabled"
    :item-class="itemClass"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @change="(v) => emit('change', v)"
  />
</template>
