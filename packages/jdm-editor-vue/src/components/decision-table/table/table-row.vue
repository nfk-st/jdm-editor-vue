<script lang="ts">
// Ported from components/decision-table/table/table-row.tsx.
import type { Row } from '@tanstack/vue-table';
import type { VirtualItem } from '@tanstack/vue-virtual';

// PORTING(sweep): stand-in retired — canonical dg-types DiffMetadata.
import type { DiffMetadata } from '../../decision-graph/dg-types';

export type TableRowProps = {
  row: Row<Record<string, string>>;
  disabled?: boolean;
  virtualItem: VirtualItem;
  onResize?: (node: HTMLElement) => void;
  // PORTING(DnD): react-dnd per-row useDrag/useDrop lived here upstream; the
  // list-level Sortable lives in table.vue now — the drop indicator classes
  // and drag opacity arrive via these props instead of dnd monitors.
  dropDirection?: 'up' | 'down' | null;
  dragging?: boolean;
};
</script>

<script setup lang="ts">
import { FlexRender } from '@tanstack/vue-table';
import clsx from 'clsx';
import { P, match } from 'ts-pattern';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useDecisionTableActions, useDecisionTableState } from '../context/dt-store.context';

const props = defineProps<TableRowProps>();

const trRef = ref<HTMLTableRowElement | null>(null);
// PORTING: upstream also accepted a forwarded row ref; the parent never
// passes one — dropped.
defineExpose({ tr: trRef });

const tableActions = useDecisionTableActions();
const cursor = useDecisionTableState(({ cursor }) => cursor);
const debugIndex = useDecisionTableState(({ debugIndex }) => debugIndex);
// PORTING: any-cast — the debug trace's `rule` typing arrives with
// decision-graph (same stance as expression-item.vue's trace reads).
const debugTraceData = useDecisionTableState(({ debug }) => debug?.trace?.traceData as any);
const isActive = computed(() =>
  match(debugTraceData.value)
    .with(P.array(), (t: any[]) => t?.[debugIndex.value]?.rule?._id === props.row.id)
    .otherwise((t: any) => t?.rule?._id === props.row.id),
);

const diff = useDecisionTableState(({ decisionTable }) => {
  if (!decisionTable._diff) {
    return undefined;
  }

  return (decisionTable.rules.find((r) => r._id === props.row.original._id) as any)?._diff as DiffMetadata | undefined;
});

const diffStatus = computed(() => diff.value?.status);

let disconnectObserver: (() => void) | undefined;

onMounted(() => {
  if (!trRef.value) {
    return;
  }

  props.onResize?.(trRef.value);
  const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.target.hasAttribute('data-virtual-index')) {
        return;
      }
      // Skip 0-height measurements from display:none (tab hidden) to avoid
      // the virtualizer caching incorrect sizes and causing a layout jump on return.
      if (entry.contentRect.height === 0) {
        return;
      }

      props.onResize?.(entry.target as HTMLElement);
    });
  });

  resizeObserver.observe(trRef.value);
  disconnectObserver = () => resizeObserver.disconnect();
});
onBeforeUnmount(() => disconnectObserver?.());

const rowClasses = computed(() =>
  clsx(
    'table-row',
    props.dropDirection === 'down' && 'dropping-down',
    props.dropDirection === 'up' && 'dropping-up',
    !diffStatus.value && isActive.value && 'active',
    !diffStatus.value && props.disabled && 'disabled',
    !diffStatus.value && cursor.value?.y === props.virtualItem.index && !props.disabled && 'selected',
    diffStatus.value && `diff-${diffStatus.value}`,
  ),
);
</script>

<template>
  <tr
    ref="trRef"
    :class="rowClasses"
    :style="{
      opacity: dragging ? 0.5 : 1,
    }"
    :data-virtual-index="virtualItem.index"
  >
    <td
      :class="clsx('sort-handler', !disabled && 'draggable', diffStatus && 'diff')"
      @contextmenu.capture="tableActions.setCursor({ x: 'id', y: virtualItem.index })"
    >
      <div class="text">
        <span class="grl-typography">{{ virtualItem.index + 1 }}</span>
      </div>
    </td>
    <td
      v-for="cell in row.getVisibleCells()"
      :key="cell.id"
      :class="[
        !disabled && cursor?.x === cell.column.id && cursor?.y === virtualItem.index && 'selected',
        diff?.fields?.[cell?.column?.id]?.status && `diff-${diff?.fields?.[cell?.column?.id]?.status}`,
      ]"
      :style="{ width: `${cell.column.getSize()}px` }"
    >
      <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
    </td>
  </tr>
</template>
