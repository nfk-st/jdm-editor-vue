<script setup lang="ts">
// antd Select replacement — Reka UI Select over {label, value} options.
import { Check, ChevronDown, X } from 'lucide-vue-next';
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
import { computed } from 'vue';

// antd allows empty-string option values (e.g. the date-granularity "Exact"
// option); reka-ui's <SelectItem> throws on them. Map '' to a sentinel at
// the boundary so the public contract (and emitted values) stay upstream-shaped.
const EMPTY_VALUE = '__grl-empty__';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options?: { label: string; value: string }[];
    placeholder?: string;
    disabled?: boolean;
    // antd parity: variant='borderless' and suffixIcon={null}.
    borderless?: boolean;
    hideArrow?: boolean;
    size?: 'default' | 'small';
    // antd allowClear — an X affordance that clears the selection (emits '').
    allowClear?: boolean;
  }>(),
  { options: () => [], borderless: false, hideArrow: false, size: 'default', allowClear: false },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'change', value: string): void }>();

const onClear = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  emit('update:modelValue', '');
  emit('change', '');
};

const rootModelValue = () => (props.modelValue === '' ? EMPTY_VALUE : props.modelValue);

const showClear = computed(
  () => props.allowClear && !props.disabled && props.modelValue !== undefined && props.modelValue !== '',
);

// reka's SelectValue shows the raw value until its item has rendered once
// (antd shows the option label immediately) — resolve the label ourselves,
// falling back to the raw value (antd behavior for unmatched presets).
const selectedLabel = computed(() => {
  if (props.modelValue === undefined) return undefined;
  return props.options.find((o) => o.value === props.modelValue)?.label ?? props.modelValue;
});
</script>

<template>
  <SelectRoot
    :model-value="rootModelValue()"
    :disabled="disabled"
    @update:model-value="
      (v) => {
        const value = v === EMPTY_VALUE ? '' : v == null ? '' : String(v);
        emit('update:modelValue', value);
        emit('change', value);
      }
    "
  >
    <SelectTrigger
      class="grl-select"
      :class="{
        'grl-select--disabled': disabled,
        'grl-select--borderless': borderless,
        'grl-select--small': size === 'small',
        'grl-select--clearable': showClear,
      }"
    >
      <SelectValue class="grl-select__value" :placeholder="placeholder">{{ selectedLabel }}</SelectValue>
      <span v-if="showClear" class="grl-select__clear" role="button" aria-label="Clear select" @click="onClear">
        <X :size="12" />
      </span>
      <ChevronDown v-if="!hideArrow" class="grl-select__arrow" :size="12" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="grl-select__content" position="popper" :side-offset="4">
        <SelectViewport class="grl-select__viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value === '' ? EMPTY_VALUE : option.value"
            class="grl-select__item"
          >
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
  position: relative;
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

  // antd variant='borderless'
  &--borderless {
    background-color: transparent;
    border-color: transparent;
    box-shadow: none;

    &:hover:not(.grl-select--disabled) {
      border-color: transparent;
    }
  }

  // antd size='small'
  &--small {
    height: 24px;
    font-size: 12px;
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
    transition:
      transform var(--grl-transition),
      opacity var(--grl-transition-quick);

    [data-state='open'] & {
      transform: rotate(180deg);
    }
  }

  // antd allowClear affordance
  &__clear {
    display: inline-flex;
    position: absolute;
    top: 50%;
    right: 11px;
    z-index: 1;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    color: var(--grl-color-text-quaternary);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%);
    transition:
      opacity var(--grl-transition-quick),
      color var(--grl-transition-quick);

    &:hover {
      color: var(--grl-color-icon);
    }
  }

  &--clearable:hover,
  &--clearable:focus-within {
    .grl-select__clear {
      opacity: 1;
      pointer-events: auto;
    }

    .grl-select__arrow {
      opacity: 0;
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
