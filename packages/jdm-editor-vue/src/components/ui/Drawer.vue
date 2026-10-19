<script setup lang="ts">
// antd Drawer replacement — Reka UI Dialog rendered as a side panel.
import { X } from 'lucide-vue-next';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

withDefaults(
  defineProps<{
    open?: boolean;
    title?: string;
    width?: number | string;
    placement?: 'right' | 'left';
  }>(),
  { open: false, width: 378, placement: 'right' },
);

const emit = defineEmits<{ (e: 'update:open', open: boolean): void }>();
</script>

<template>
  <DialogRoot :open="open" @update:open="(o) => emit('update:open', o)">
    <DialogPortal>
      <DialogOverlay class="grl-drawer__overlay" />
      <DialogContent
        class="grl-drawer"
        :style="{
          width: typeof width === 'number' ? `${width}px` : width,
          [placement]: 0,
        }"
      >
        <DialogTitle v-if="title || $slots.title" class="grl-drawer__title"><slot name="title">{{ title }}</slot></DialogTitle>
        <div class="grl-drawer__body">
          <slot />
        </div>
        <DialogClose class="grl-drawer__close" aria-label="Close">
          <X :size="14" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss">
.grl-drawer__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: var(--grl-color-bg-mask);
}

.grl-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background-color: var(--grl-color-bg-elevated);
  box-shadow: var(--grl-box-shadow);
  padding: 16px 20px;

  &__title {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--grl-color-text);
  }

  &__body {
    flex: 1;
    overflow: auto;
    font-size: 14px;
    color: var(--grl-color-text);
  }

  &__close {
    position: absolute;
    top: 12px;
    right: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--grl-border-radius-sm);
    background: transparent;
    color: var(--grl-color-text-secondary);
    cursor: pointer;

    &:hover {
      color: var(--grl-color-text);
      background-color: var(--grl-color-bg-text-hover);
    }
  }
}
</style>
