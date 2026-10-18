<script setup lang="ts">
// antd Select replacement — Reka UI Select over {label, value} options.
import { ChevronDown, Check } from 'lucide-vue-next';
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';

withDefaults(
  defineProps<{
    modelValue?: string;
    options?: { label: string; value: string }[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { options: () => [] },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="
      (v: string) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <SelectTrigger class="grl-select" :class="{ 'grl-select--disabled': disabled }">
      <SelectValue class="grl-select__value" :placeholder="placeholder" />
      <ChevronDown class="grl-select__arrow" :size="12" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="grl-select__content" position="popper" :side-offset="4">
        <SelectViewport class="grl-select__viewport">
          <SelectItem v-for="option in options" :key="option.value" :value="option.value" class="grl-select__item">
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="grl-select__indicator">
              <Check :size="12" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style lang="scss">
.grl-select {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  height: 32px;
  padding: 0 11px;
  color: var(--grl-color-text);
  font-size: 14px;
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  cursor: pointer;
  transition: var(--grl-transition);

  &:hover:not(.grl-select--disabled) {
    border-color: var(--grl-color-primary-hover);
  }

  &[data-state='open'],
  &:focus-visible {
    outline: none;
    border-color: var(--grl-color-primary-hover);
    box-shadow: 0 0 0 2px var(--grl-control-outline);
  }

  &--disabled {
    cursor: not-allowed;
    color: var(--grl-color-text-disabled);
    background-color: var(--grl-color-bg-container-disabled);

    &:hover {
      border-color: var(--grl-color-border);
    }
  }

  &__value {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    &[data-placeholder] {
      color: var(--grl-color-text-placeholder);
    }
  }

  &__arrow {
    flex-shrink: 0;
    color: var(--grl-color-text-secondary);
    transition: transform var(--grl-transition);

    [data-state='open'] & {
      transform: rotate(180deg);
    }
  }

  &__content {
    z-index: 1050;
    min-width: var(--reka-select-trigger-width);
    max-height: 264px;
    background-color: var(--grl-color-bg-elevated);
    border-radius: var(--grl-border-radius);
    box-shadow: var(--grl-box-shadow);
    overflow: hidden;
  }

  &__viewport {
    padding: 4px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 32px;
    padding: 0 8px 0 12px;
    font-size: 14px;
    color: var(--grl-color-text);
    border-radius: var(--grl-border-radius);
    cursor: pointer;
    outline: none;

    &[data-highlighted] {
      background-color: var(--grl-color-bg-text-hover);
    }

    &[data-state='checked'] {
      color: var(--grl-color-primary);
      font-weight: 600;
    }
  }

  &__indicator {
    display: inline-flex;
    color: var(--grl-color-primary);
  }
}
</style>
