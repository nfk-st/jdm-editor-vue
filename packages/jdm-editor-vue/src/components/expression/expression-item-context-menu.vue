<script setup lang="ts">
// Ported from components/expression/expression-item-context-menu.tsx —
// antd Dropdown trigger=['contextMenu'] → reka-ui ContextMenu.
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';

import SpacedText from '../spaced-text.vue';
import { useExpressionStore } from './context/expression-store.context';

const props = defineProps<{ index: number }>();

const store = useExpressionStore(({ addRowAbove, addRowBelow, disabled }) => ({ addRowAbove, addRowBelow, disabled }));
</script>

<template>
  <ContextMenuRoot :disabled="store.disabled">
    <ContextMenuTrigger as-child class="expression-item-context-menu__trigger"><slot /></ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="grl-context-menu" :style="{ minWidth: '200px' }">
        <ContextMenuItem class="grl-context-menu__item" @select="store.addRowAbove(props.index)">
          <SpacedText left="Add row above" />
        </ContextMenuItem>
        <ContextMenuItem class="grl-context-menu__item" @select="store.addRowBelow(props.index)">
          <SpacedText left="Add row below" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style lang="scss">
// PORTING: antd Dropdown menu styling → token-styled .grl-context-menu.
.grl-context-menu {
  z-index: 1050;
  min-width: 120px;
  padding: 4px;
  background-color: var(--grl-color-bg-elevated);
  border-radius: var(--grl-border-radius);
  box-shadow: var(--grl-box-shadow);

  &__item {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    font-size: 14px;
    color: var(--grl-color-text);
    border-radius: var(--grl-border-radius-sm);
    cursor: pointer;
    outline: none;

    &[data-highlighted] {
      background-color: var(--grl-color-bg-text-hover);
    }
  }
}
</style>
