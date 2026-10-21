<script setup lang="ts">
// antd Checkbox replacement — native input styled with --grl-* tokens.
// New file (no upstream counterpart beyond antd itself), hence PascalCase.
// Landed with decision-table's field editors (antd Checkbox call sites).
const props = defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'change', value: boolean): void }>();

const onChange = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  emit('update:modelValue', checked);
  emit('change', checked);
};
</script>

<template>
  <label class="grl-checkbox" :class="{ 'grl-checkbox--disabled': disabled }">
    <input class="grl-checkbox__input" type="checkbox" :checked="modelValue" :disabled="disabled" @change="onChange" />
    <span class="grl-checkbox__label"><slot /></span>
  </label>
</template>

<style lang="scss">
.grl-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--grl-color-text);
  cursor: pointer;

  &:has(.grl-checkbox__input:disabled) {
    cursor: not-allowed;
  }

  &__input {
    box-sizing: border-box;
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--grl-color-primary);
    cursor: inherit;
  }

  &__label {
    min-width: 0;
  }
}
</style>
