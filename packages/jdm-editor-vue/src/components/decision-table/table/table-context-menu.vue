<script setup lang="ts">
// Ported from components/decision-table/table/table-context-menu.tsx —
// antd Dropdown trigger=['contextMenu'] → reka-ui ContextMenu (recipe from
// expression/expression-item-context-menu.vue).
// PORTING: React.memo dropped — Vue components re-render only on dep change;
// destroyPopupOnHide/transitionName='' are antd options (reka unmounts the
// content when closed and has no enter transition by default).
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from 'reka-ui';

import SpacedText from '../../spaced-text.vue';
import { useDecisionTableActions, useDecisionTableState } from '../context/dt-store.context';

const cursor = useDecisionTableState(({ cursor }) => cursor);
const disabled = useDecisionTableState(({ disabled }) => disabled);
const tableActions = useDecisionTableActions();

const onAddRowAbove = () => {
  if (cursor.value) tableActions.addRowAbove(cursor.value.y);
};

const onAddRowBelow = () => {
  if (cursor.value) tableActions.addRowBelow(cursor.value.y);
};

const onRemoveRow = () => {
  if (cursor.value) tableActions.removeRow(cursor.value.y);
};
</script>

<template>
  <ContextMenuRoot :disabled="disabled">
    <ContextMenuTrigger as-child><slot /></ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="grl-context-menu" :style="{ minWidth: '270px' }">
        <ContextMenuItem class="grl-context-menu__item" @select="onAddRowAbove">
          <SpacedText left="Add row above" />
        </ContextMenuItem>
        <ContextMenuItem class="grl-context-menu__item" @select="onAddRowBelow">
          <SpacedText left="Add row below" />
        </ContextMenuItem>
        <ContextMenuSeparator class="grl-context-menu__separator" />
        <ContextMenuItem class="grl-context-menu__item" @select="onRemoveRow">
          <SpacedText left="Remove row" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style lang="scss">
// PORTING: antd Divider (menu divider) → token-styled separator; pairs with
// the .grl-context-menu block defined in expression-item-context-menu.vue.
.grl-context-menu__separator {
  height: 1px;
  margin: 4px 0;
  background-color: var(--grl-color-border-secondary, var(--grl-color-border));
}
</style>
