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
  color: var(--grl-color-text-inverse, #fff);
  background-color: rgba(0, 0, 0, 0.85);
  border-radius: var(--grl-border-radius-sm, 4px);
  box-shadow: var(--grl-box-shadow);

  .grl-root[data-mode='dark'] & {
    color: rgba(0, 0, 0, 0.85);
    background-color: rgba(255, 255, 255, 0.85);
  }

  &__arrow {
    fill: rgba(0, 0, 0, 0.85);

    .grl-root[data-mode='dark'] & {
      fill: rgba(255, 255, 255, 0.85);
    }
  }
}
</style>
