<script setup lang="ts">
// antd InputNumber replacement — native input[type=number] styled with
// --grl-* tokens like ui/Input.vue. New file (no upstream counterpart beyond
// antd itself), hence PascalCase.
// antd's `controls={false}` (every upstream usage here) maps to hiding the
// native spinners below; `variant='borderless'` is handled by consumers' SCSS.
import { computed } from 'vue';

const props = defineProps<{
  modelValue?: number | null;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void;
  (e: 'change', value: number | null): void;
}>();

// antd InputNumber reports changes as the user types (no step controls).
const onInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value;
  const value = raw === '' || isNaN(Number(raw)) ? null : Number(raw);
  emit('update:modelValue', value);
  emit('change', value);
};

const value = computed(() =>
  props.modelValue === undefined || props.modelValue === null ? '' : String(props.modelValue),
);
</script>

<template>
  <input
    class="grl-input-number"
    :class="{ 'grl-input-number--disabled': disabled }"
    type="number"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readOnly"
    @input="onInput"
  />
</template>

<style lang="scss">
.grl-input-number {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 4px 11px;
  color: var(--grl-color-text);
  font-size: 14px;
  font-family: var(--grl-font-family);
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  transition: var(--grl-transition);

  &::placeholder {
    color: var(--grl-color-text-placeholder);
  }

  // antd controls={false}: no native steppers.
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }

  appearance: textfield;
  -moz-appearance: textfield;

  &:hover:not(.grl-input-number--disabled, :focus) {
    border-color: var(--grl-color-primary-hover);
  }

  &:focus {
    outline: none;
    border-color: var(--grl-color-primary-hover);
    box-shadow: 0 0 0 2px var(--grl-control-outline);
  }

  &.grl-input-number--disabled {
    cursor: not-allowed;
    color: var(--grl-color-text-disabled);
    background-color: var(--grl-color-bg-container-disabled);

    &:hover {
      border-color: var(--grl-color-border);
    }
  }
}
</style>
