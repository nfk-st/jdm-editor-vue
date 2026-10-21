<script setup lang="ts">
// antd Tooltip replacement — Reka UI Tooltip wrapper.
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';

withDefaults(
  defineProps<{
    content?: string;
    // Controlled open (antd `open`); undefined = uncontrolled hover.
    open?: boolean;
    delay?: number;
  }>(),
  { delay: 100 },
);

const emit = defineEmits<{ (e: 'update:open', open: boolean): void }>();
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot :open="open" @update:open="(o) => emit('update:open', o)">
      <TooltipTrigger as-child class="grl-tooltip__trigger"><slot /></TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="grl-tooltip" :side-offset="6">
          {{ content }}
          <TooltipArrow class="grl-tooltip__arrow" :width="8" />
          <slot name="content" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style lang="scss">
.grl-tooltip {
  z-index: 1070;
  max-width: 264px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--grl-color-text-inverse);
  background-color: var(--grl-color-bg-spotlight);
  border-radius: var(--grl-border-radius-sm);
  box-shadow: var(--grl-box-shadow);

  .grl-root[data-mode='dark'] & {
    color: var(--grl-color-text-inverse);
    background-color: var(--grl-color-bg-spotlight);
  }

  &__arrow {
    fill: var(--grl-color-bg-spotlight);

    .grl-root[data-mode='dark'] & {
      fill: var(--grl-color-bg-spotlight);
    }
  }
}
</style>
