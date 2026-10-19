<script setup lang="ts">
// Ported from components/decision-table/components/field-type-tags.tsx —
// generic tag-picker (styles live in dt.scss, .grl-field-type-tag(s)).
import clsx from 'clsx';

const props = defineProps<{
  options: { value: string; label: string }[];
  modelValue: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();

const onSelect = (value: string) => {
  if (props.disabled) return;
  emit('update:modelValue', value);
  emit('change', value);
};
</script>

<template>
  <div class="grl-field-type-tags">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="clsx('grl-field-type-tag', { active: modelValue === opt.value })"
      :disabled="disabled"
      @click="onSelect(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
