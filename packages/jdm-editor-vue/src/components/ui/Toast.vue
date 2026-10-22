<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next';
import { ToastClose, ToastDescription, ToastRoot, ToastTitle, ToastViewport, useToastManager } from 'reka-ui';

const { toasts } = useToastManager();

const iconFor = (status?: string) => {
  if (status === 'success') return CheckCircle2;
  if (status === 'error') return AlertCircle;
  return Info;
};
</script>

<template>
  <ToastViewport class="grl-toast__viewport" aria-label="Notifications">
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      :toast="toast"
      class="grl-toast"
      :data-status="toast.status ?? 'info'"
    >
      <component :is="iconFor(toast.status)" class="grl-toast__icon" :size="16" aria-hidden="true" />
      <div class="grl-toast__content">
        <ToastTitle v-if="toast.title" class="grl-toast__title">{{ toast.title }}</ToastTitle>
        <ToastDescription v-if="toast.description" class="grl-toast__description">
          {{ toast.description }}
        </ToastDescription>
      </div>
      <ToastClose class="grl-toast__close" aria-label="Dismiss notification">
        <X :size="14" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>
  </ToastViewport>
</template>

<style lang="scss">
.grl-toast__viewport {
  position: fixed;
  z-index: 1000;
  top: 8px;
  left: 50%;
  display: flex;
  width: min(calc(100vw - 32px), 480px);
  max-height: 100vh;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
  transform: translateX(-50%);
  outline: none;
  list-style: none;
}

.grl-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  background: var(--grl-color-bg-elevated);
  box-shadow: var(--grl-box-shadow);
  color: var(--grl-color-text);
  font-family: var(--grl-font-family);
  font-size: 14px;
  line-height: 1.5;
  pointer-events: auto;

  &[data-status='success'] .grl-toast__icon {
    color: var(--grl-color-success);
  }

  &[data-status='error'] .grl-toast__icon {
    color: var(--grl-color-error);
  }

  &[data-status='info'] .grl-toast__icon {
    color: var(--grl-color-info);
  }
}

.grl-toast__icon {
  flex: none;
  margin-top: 2px;
}

.grl-toast__content {
  min-width: 0;
  flex: 1;
}

.grl-toast__title {
  display: block;
  margin-bottom: 2px;
  font-weight: 600;
}

.grl-toast__description {
  display: block;
  overflow-wrap: anywhere;
}

.grl-toast__close {
  display: grid;
  flex: none;
  place-items: center;
  padding: 2px;
  border: 0;
  border-radius: var(--grl-border-radius-sm);
  background: transparent;
  color: var(--grl-color-text-tertiary);
  cursor: pointer;

  &:hover {
    background: var(--grl-color-bg-text-hover);
    color: var(--grl-color-text);
  }
}
</style>
