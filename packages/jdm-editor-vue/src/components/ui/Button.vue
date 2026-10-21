<script setup lang="ts">
// antd Button replacement — token-styled, supports the variants the port uses
// (text/link/default), danger state, icon slot, small/default sizes.
// PORTING: antd swallows clicks while `loading` (its handleClick returns
// early). The port also sets the disabled attribute, so a loading button is
// inert to both pointer and keyboard — the semantics the REVIEW-PROMPT's
// ui/ primitive bar asks for.
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    type?: 'default' | 'primary' | 'text' | 'link';
    // antd's `shape` — 'round' is the pill button the edge's delete
    // affordance uses.
    shape?: 'default' | 'round';
    danger?: boolean;
    disabled?: boolean;
    size?: 'default' | 'small';
    block?: boolean;
    // antd parity: loading spinner state
    loading?: boolean;
  }>(),
  {
    type: 'default',
    shape: 'default',
    danger: false,
    disabled: false,
    size: 'default',
    block: false,
    loading: false,
  },
);

const emit = defineEmits<{ (e: 'click', event: MouseEvent): void; (e: 'blur', event: FocusEvent): void }>();
</script>

<template>
  <button
    class="grl-btn"
    :class="[
      `grl-btn--${type}`,
      `grl-btn--${size}`,
      `grl-btn--${shape}`,
      danger && 'grl-btn--danger',
      (disabled || loading) && 'grl-btn--disabled',
      block && 'grl-btn--block',
    ]"
    type="button"
    :disabled="disabled || loading"
    @click="(e) => emit('click', e)"
    @blur="(e) => emit('blur', e)"
    v-bind="$attrs"
  >
    <span v-if="$slots.icon" class="grl-btn__icon"><slot name="icon" /></span>
    <span v-if="loading" class="grl-btn__spinner" />
    <slot />
  </button>
</template>

<style lang="scss">
.grl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 32px;
  padding: 4px 15px;
  font-size: 14px;
  font-family: var(--grl-font-family);
  line-height: 1.5714;
  color: var(--grl-color-text);
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  cursor: pointer;
  transition: var(--grl-transition);
  white-space: nowrap;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--grl-control-outline);
  }

  &--small {
    height: var(--grl-control-height-sm, 24px);
    padding: 0 7px;
    font-size: 12px;
  }

  // antd shape='round'
  &--round {
    border-radius: 999px;
  }

  // antd type='text'
  &--text {
    background-color: transparent;
    border-color: transparent;
    box-shadow: none;

    &:hover:not(.grl-btn--disabled) {
      background-color: var(--grl-color-bg-text-hover);
    }
  }

  // antd type='link'
  &--link {
    background-color: transparent;
    border-color: transparent;
    box-shadow: none;
    color: var(--grl-color-primary);
    padding: 4px 0;

    &:hover:not(.grl-btn--disabled) {
      color: var(--grl-color-primary-hover);
    }
  }

  &--default:hover:not(.grl-btn--disabled) {
    border-color: var(--grl-color-primary-hover);
    color: var(--grl-color-primary-hover);
  }

  // antd type='primary'
  &--primary {
    color: var(--grl-color-text-solid);
    background-color: var(--grl-color-primary);
    border-color: var(--grl-color-primary);

    &:hover:not(.grl-btn--disabled) {
      color: var(--grl-color-text-solid);
      background-color: var(--grl-color-primary-hover);
      border-color: var(--grl-color-primary-hover);
    }

    &:active:not(.grl-btn--disabled) {
      background-color: var(--grl-color-primary-active);
      border-color: var(--grl-color-primary-active);
    }
  }

  &--danger {
    &.grl-btn--text,
    &.grl-btn--link {
      color: var(--grl-color-error);

      &:hover:not(.grl-btn--disabled) {
        color: var(--grl-color-error-hover);
      }
    }

    &.grl-btn--default {
      color: var(--grl-color-error);
      border-color: var(--grl-color-error);

      &:hover:not(.grl-btn--disabled) {
        color: var(--grl-color-error-hover);
        border-color: var(--grl-color-error-hover);
      }
    }

    // antd's danger button is a PRIMARY button in the error colour.
    &.grl-btn--primary {
      background-color: var(--grl-color-error);
      border-color: var(--grl-color-error);

      &:hover:not(.grl-btn--disabled) {
        background-color: var(--grl-color-error-hover);
        border-color: var(--grl-color-error-hover);
      }
    }
  }

  &--block {
    width: 100%;
  }

  &--disabled {
    cursor: not-allowed;
    color: var(--grl-color-text-disabled);
    background-color: var(--grl-color-bg-container-disabled);

    &:hover {
      color: var(--grl-color-text-disabled);
      border-color: var(--grl-color-border);
    }

    &.grl-btn--text,
    &.grl-btn--link {
      background-color: transparent;
      border-color: transparent;
    }
  }

  &__icon {
    display: inline-flex;
    align-items: center;
  }

  // antd loading parity — token spinner
  &__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentcolor;
    border-top-color: transparent;
    border-radius: 50%;
    opacity: 0.7;
    animation: grl-btn-spin 0.6s linear infinite;
  }
}

@keyframes grl-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
