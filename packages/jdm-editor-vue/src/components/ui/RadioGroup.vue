<script setup lang="ts">
// antd Radio.Group replacement — Reka UI RadioGroup over {label, value} options.
// `itemClass` lets callers (e.g. DiffRadio) tag individual options.
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator } from 'reka-ui';

defineProps<{
  modelValue?: string;
  options?: { label: string; value: string }[];
  disabled?: boolean;
  itemClass?: (option: { label: string; value: string }) => string | undefined;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();
</script>

<template>
  <RadioGroupRoot
    class="grl-radio-group"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="
      (v) => {
        const value = v == null ? undefined : String(v);
        if (value !== undefined) {
          emit('update:modelValue', value);
          emit('change', value);
        }
      }
    "
  >
    <label
      v-for="option in options || []"
      :key="option.value"
      class="grl-radio"
      :class="itemClass?.(option)"
    >
      <RadioGroupItem class="grl-radio__input" :value="option.value" :disabled="disabled">
        <RadioGroupIndicator class="grl-radio__dot" />
      </RadioGroupItem>
      <span class="grl-radio__label">{{ option.label }}</span>
    </label>
  </RadioGroupRoot>
</template>

<style lang="scss">
.grl-radio-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--grl-color-text);
}

.grl-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:has(.grl-radio__input:disabled) {
    cursor: not-allowed;
  }
}

.grl-radio__input {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: 50%;
  transition: var(--grl-transition);

  &:hover:not(:disabled) {
    border-color: var(--grl-color-primary);
  }

  &:disabled {
    cursor: not-allowed;
    background-color: var(--grl-color-bg-container-disabled);
    border-color: var(--grl-color-border);
  }

  &[data-state='checked'] {
    border-color: var(--grl-color-primary);
  }
}

.grl-radio__dot {
  display: block;
  width: 8px;
  height: 8px;
  background-color: var(--grl-color-primary);
  border-radius: 50%;
  transform: scale(0);
  transition: transform var(--grl-transition-quick);

  [data-state='checked'] & {
    transform: scale(1);
  }
}
</style>
