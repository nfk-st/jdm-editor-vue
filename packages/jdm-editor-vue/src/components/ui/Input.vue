<script setup lang="ts">
// antd Input replacement — native input styled with --grl-* tokens.
// New file (no upstream counterpart beyond antd itself), hence PascalCase.
import { computed } from 'vue';

const props = defineProps<{
  modelValue?: string | number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();

const onInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  emit('update:modelValue', value);
  emit('change', value);
};

const value = computed(() => (props.modelValue === undefined ? undefined : String(props.modelValue)));
</script>

<template>
  <input
    class="grl-input"
    :class="{ 'grl-input--disabled': disabled }"
    type="text"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readOnly"
    @input="onInput"
  />
</template>

<style lang="scss">
.grl-input {
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

  &:hover:not(.grl-input--disabled, :focus) {
    border-color: var(--grl-color-primary-hover);
  }

  &:focus {
    outline: none;
    border-color: var(--grl-color-primary-hover);
    box-shadow: 0 0 0 2px var(--grl-control-outline);
  }

  &.grl-input--disabled {
    cursor: not-allowed;
    color: var(--grl-color-text-disabled);
    background-color: var(--grl-color-bg-container-disabled);

    &:hover {
      border-color: var(--grl-color-border);
    }
  }
}
</style>
