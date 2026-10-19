<script setup lang="ts">
// antd Modal replacement — Reka UI Dialog with token styling. Controlled
// `open` (upstream drives modals via open props), #default body, #footer.
// PORTING(additive): `getContainer` (antd prop of the same name) portals the
// dialog into a custom element; `centered` matches antd's centered layout.
import { DialogClose } from 'reka-ui';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { X } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    open?: boolean;
    title?: string;
    width?: number | string;
    centered?: boolean;
    getContainer?: () => HTMLElement;
  }>(),
  { open: false, width: 520, centered: false },
);

const emit = defineEmits<{ (e: 'update:open', open: boolean): void }>();
</script>

<template>
  <DialogRoot :open="open" @update:open="(o) => emit('update:open', o)">
    <DialogPortal :to="getContainer ? getContainer() : undefined">
      <DialogOverlay class="grl-modal__overlay" :class="{ 'grl-modal__overlay--contained': getContainer }" />
      <DialogContent
        class="grl-modal"
        :class="{ 'grl-modal--centered': centered, 'grl-modal--contained': getContainer }"
        :style="{ width: typeof width === 'number' ? `${width}px` : width }"
      >
        <DialogTitle v-if="title || $slots.title" class="grl-modal__title"><slot name="title">{{ title }}</slot></DialogTitle>
        <DialogDescription v-if="$slots.description" class="grl-modal__description"><slot name="description" /></DialogDescription>
        <div class="grl-modal__body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="grl-modal__footer">
          <slot name="footer" />
        </div>
        <DialogClose class="grl-modal__close" aria-label="Close">
          <X :size="14" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss">
.grl-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: var(--grl-color-bg-mask);

  // PORTING(additive): antd getContainer — the overlay spans the container's
  // nearest positioned ancestor instead of the viewport.
  &--contained {
    position: absolute;
  }
}

.grl-modal {
  position: fixed;
  top: 20vh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 128px);
  display: flex;
  flex-direction: column;
  background-color: var(--grl-color-bg-elevated);
  border-radius: var(--grl-border-radius);
  box-shadow: var(--grl-box-shadow);
  padding: 20px 24px;

  // PORTING(additive): antd centered layout.
  &--centered {
    top: 50%;
    transform: translate(-50%, -50%);
  }

  // PORTING(additive): antd getContainer — the dialog renders inside the
  // caller's element, positioned absolutely against the nearest positioned
  // ancestor (same anchoring antd's absolute wrap relies on).
  &--contained {
    position: absolute;
  }

  &__title {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--grl-color-text);
  }

  &__description {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--grl-color-text-secondary);
  }

  &__body {
    flex: 1;
    overflow: auto;
    font-size: 14px;
    color: var(--grl-color-text);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;

    > button + button {
      margin-left: 0;
    }
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
    transition: var(--grl-transition);

    &:hover {
      color: var(--grl-color-text);
      background-color: var(--grl-color-bg-text-hover);
    }
  }
}
</style>
