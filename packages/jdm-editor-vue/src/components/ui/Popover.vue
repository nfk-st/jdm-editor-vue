<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';

// antd Popover replacement — reka-ui Popover with a controlled `open`
// (upstream passes open/onOpenChange to antd's Popover).
// New file (no upstream counterpart beyond antd itself), hence PascalCase.
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    open?: boolean;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
    /** antd overlayClassName — merged onto the portal content element. */
    contentClass?: string;
  }>(),
  {
    side: 'bottom',
    align: 'center',
    sideOffset: 4,
  },
);

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();
</script>

<template>
  <PopoverRoot :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <!-- PORTING: attrs land on the trigger element (antd spreads consumer
         props onto the wrapping trigger span). -->
    <PopoverTrigger as-child v-bind="$attrs">
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="grl-popover__content"
        :class="contentClass"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        data-testid="grl-popover-content"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss">
.grl-popover__content {
  z-index: 1050;
  min-width: max-content;
  color: var(--grl-color-text);
  font-family: var(--grl-font-family);
  font-size: 14px;
  background-color: var(--grl-color-bg-elevated);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  box-shadow: var(--grl-box-shadow);
}
</style>
