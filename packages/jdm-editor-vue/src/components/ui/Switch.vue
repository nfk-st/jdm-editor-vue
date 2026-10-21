<script setup lang="ts">
// antd Switch replacement — Reka UI SwitchRoot styled with --grl-* tokens.
import { SwitchRoot, SwitchThumb } from 'reka-ui';

withDefaults(
  defineProps<{
    modelValue?: boolean;
    disabled?: boolean;
    size?: 'small' | 'default';
  }>(),
  { modelValue: false, disabled: false, size: 'default' },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'change', value: boolean): void }>();
</script>

<template>
  <SwitchRoot
    class="grl-switch"
    :class="[size === 'small' && 'grl-switch--small', disabled && 'grl-switch--disabled']"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="
      (v: boolean) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <SwitchThumb class="grl-switch__thumb" />
  </SwitchRoot>
</template>

<style lang="scss">
.grl-switch {
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 22px;
  padding: 2px;
  // antd's switch track rests on colorTextQuaternary and darkens to
  // colorTextTertiary on hover — not on colorBgMask.
  background-color: var(--grl-color-text-placeholder);
  border-radius: 999px;
  transition: var(--grl-transition);
  cursor: pointer;

  // antd: the UNCHECKED track darkens to colorTextTertiary on hover, and a
  // CHECKED one goes to colorPrimaryHover. The grey hover must not reach
  // the checked switch (it outranks the checked rule on specificity).
  &[data-state='unchecked']:hover:not(.grl-switch--disabled) {
    background-color: var(--grl-color-text-tertiary);
  }

  &[data-state='checked'] {
    background-color: var(--grl-color-primary);

    &:hover:not(.grl-switch--disabled) {
      background-color: var(--grl-color-primary-hover);
    }
  }

  &--small {
    width: 28px;
    height: 16px;
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.65;

    background-color: var(--grl-color-text-disabled);
  }

  &__thumb {
    display: block;
    width: 18px;
    height: 18px;
    background-color: var(--grl-color-text-solid);
    border-radius: 50%;
    transition: transform var(--grl-transition);
    will-change: transform;

    [data-state='checked'] & {
      transform: translateX(22px);
    }

    .grl-switch--small & {
      width: 12px;
      height: 12px;

      &[data-state='checked'] {
        transform: translateX(12px);
      }
    }
  }
}
</style>
