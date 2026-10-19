<script setup lang="ts">
// antd Spin replacement — token-styled rotating ring (new file, no upstream
// counterpart beyond antd itself, hence PascalCase). Covers the `loading`
// placeholders the port needs; size follows antd's small/default/large.
withDefaults(
  defineProps<{
    size?: 'small' | 'default' | 'large';
  }>(),
  { size: 'default' },
);
</script>

<template>
  <span class="grl-spinner" :class="`grl-spinner--${size}`" role="status" aria-label="loading" />
</template>

<style lang="scss">
.grl-spinner {
  display: inline-block;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  border: 2px solid var(--grl-color-border);
  border-top-color: var(--grl-color-primary);
  border-radius: 50%;
  animation: grl-spinner-rotate 1s linear infinite;

  &--small {
    width: 14px;
    height: 14px;
  }

  &--large {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }
}

@keyframes grl-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
