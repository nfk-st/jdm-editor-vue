<script lang="ts">
// Ported from components/decision-table/table/table.tsx.
// TanStack/Vue API notes (differences from the React originals):
// - useVueTable takes the options object once — reactivity reaches the table
//   core through GETTER properties (data/columns/meta/state) that the
//   library's lazy mergeProxy reads at property-access time.
// - useVirtualizer returns a Ref<Virtualizer>; every access (.getVirtualItems,
//   .measureElement, .scrollToIndex, …) goes through .value.
// - React's MutableRefObject.current props (scrollContainerRef/scrollApiRef)
//   become Ref.value writes.
// - TableBody + StyledTable were in-file React components; TableBody is
//   inlined below (template + setup), StyledTable is a plain <table>.
import type { ColumnDef } from '@tanstack/vue-table';
import equal from 'fast-deep-equal/es6/react';
import type { Ref } from 'vue';
import { z } from 'zod';

export type TableScrollApi = {
  getTopRowIndex: () => number;
  scrollToRowIndex: (index: number) => void;
};

export type TableProps = {
  id?: string;
  maxHeight: string | number;
  scrollContainerRef?: Ref<HTMLDivElement | null>;
  scrollApiRef?: Ref<TableScrollApi | null>;
};

type ColumnSizing = Record<string, number>;

export const columnSizeKey = (id: string) => `jdm-editor:decisionTable:columns:${id}`;

export const loadColumnSizing = (id?: string) => {
  if (!id) {
    return {};
  }

  try {
    const sizeData = localStorage.getItem(columnSizeKey(id));
    const jsonData = JSON.parse(sizeData ?? '{}');
    return z.record(z.string(), z.number()).parse(jsonData);
  } catch {
    return {};
  }
};

// PORTING(test): spacer math extracted from the render below.
export const computeVirtualPadding = (virtualItems: { start: number; end: number }[], totalSize: number) => {
  const paddingTop = virtualItems.length > 0 ? virtualItems?.[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - (virtualItems?.[virtualItems.length - 1]?.end || 0) : 0;
  return { paddingTop, paddingBottom };
};
</script>

<script setup lang="ts">
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { PlusCircle } from 'lucide-vue-next';
import {
  type CSSProperties,
  type ComponentPublicInstance,
  computed,
  h,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { type UseDraggableOptions, useDraggable } from 'vue-draggable-plus';

import { useThemeMode } from '../../../theme';
import Button from '../../ui/Button.vue';
import type { TableSchemaItem } from '../context/dt-store.context';
import { useDecisionTableActions, useDecisionTableListeners, useDecisionTableState } from '../context/dt-store.context';
import TableContextMenu from './table-context-menu.vue';
import { TableDefaultCell } from './table-default-cell.vue';
import {
  TableHeadCellInput,
  TableHeadCellInputField,
  TableHeadCellOutput,
  TableHeadCellOutputField,
} from './table-head-cell.vue';
import TableHeadRow from './table-head-row.vue';
import TableRow from './table-row.vue';

const props = defineProps<TableProps>();

const themeMode = useThemeMode();

const tableContainerRef = ref<HTMLDivElement | null>(null);

// PORTING: React callback ref writing MutableRefObject.current → Vue
// function ref (typed per Vue's signature — coerced to the div); scrollContainerRef
// is a Ref held by the parent (dt.tsx).
const setContainerRef = (el: Element | ComponentPublicInstance | null) => {
  const div = el instanceof HTMLDivElement ? el : null;
  tableContainerRef.value = div;
  if (props.scrollContainerRef) props.scrollContainerRef.value = div;
};

const tableActions = useDecisionTableActions();
const cellRenderer = useDecisionTableListeners(({ cellRenderer }) => cellRenderer);
const columnSizing = ref<ColumnSizing>(loadColumnSizing(props.id));

const permission = useDecisionTableState(({ permission }) => permission);
const disabled = useDecisionTableState(({ disabled }) => disabled);
const inputs = useDecisionTableState(({ decisionTable }) => decisionTable.inputs);
const outputs = useDecisionTableState(({ decisionTable }) => decisionTable.outputs);
const minColWidth = useDecisionTableState(({ minColWidth }) => minColWidth);
const colWidth = useDecisionTableState(({ colWidth }) => colWidth);

const rulesSource = useDecisionTableState(({ decisionTable }) => decisionTable.rules);

// PORTING: upstream selects `rules` with a zustand equalityFn that compares
// the _id lists — cell edits must not rebuild the row model. Vue computeds
// have no equality hook, so the result is memoized on the _id list by hand.
let cachedIds: string[] | undefined;
let cachedRules: Record<string, string>[] = [];
const rules = computed(() => {
  const rs = rulesSource.value ?? [];
  const ids = rs.map((i: any) => i?._id);
  if (cachedIds && equal(cachedIds, ids)) {
    return cachedRules;
  }
  cachedIds = ids;
  cachedRules = rs;
  return rs;
});

// PORTING: upstream's React.useMemo dep list [permission, disabled, inputs,
// outputs] misses minColWidth/colWidth (size changes went stale); a computed
// tracks every read — deliberate fix while keeping the same shape.
const columns = computed<ColumnDef<Record<string, string>>[]>(() => [
  {
    id: 'inputs',
    minSize: minColWidth.value,
    size: colWidth.value,
    enableResizing: true,
    header: () => h(TableHeadCellInput, { permission: permission.value, disabled: disabled.value }),
    columns: [
      ...(inputs.value || []).map((input: TableSchemaItem) => {
        return {
          accessorKey: input.id,
          id: input.id,
          minSize: minColWidth.value,
          size: colWidth.value,
          header: () =>
            h(TableHeadCellInputField, { schema: input, permission: permission.value, disabled: disabled.value }),
        };
      }),
    ],
  },
  {
    id: 'outputs',
    minSize: minColWidth.value,
    size: minColWidth.value,
    header: () => h(TableHeadCellOutput, { disabled: disabled.value, permission: permission.value }),
    columns: [
      ...(outputs.value || []).map((output: TableSchemaItem) => {
        return {
          accessorKey: output.id,
          id: output.id,
          minSize: minColWidth.value,
          size: colWidth.value,
          header: () =>
            h(TableHeadCellOutputField, { schema: output, permission: permission.value, disabled: disabled.value }),
        };
      }),
    ],
  },
  {
    id: '_description',
    accessorKey: '_description',
    header: () =>
      h('div', { class: 'head-cell' }, [h('span', { class: 'grl-typography grl-dt-text-primary' }, 'Description')]),
    minSize: minColWidth.value,
    size: colWidth.value,
  },
]);

// PORTING: onColumnSizingChange receives an updater (React setState
// semantics) — unwrap it onto the ref.
const table = useVueTable<Record<string, string>>({
  get data() {
    return rules.value;
  },
  columnResizeMode: 'onChange',
  getRowId: (row) => row._id,
  get columns() {
    return columns.value;
  },
  getCoreRowModel: getCoreRowModel(),
  defaultColumn: {
    cell: (context) => h(TableDefaultCell, { context }),
  },
  get meta() {
    return { getCell: cellRenderer.value };
  },
  ...(!props.id
    ? {}
    : {
        state: {
          get columnSizing() {
            return columnSizing.value;
          },
        },
        onColumnSizingChange: (updater: ColumnSizing | ((prev: ColumnSizing) => ColumnSizing)) => {
          columnSizing.value = typeof updater === 'function' ? updater(columnSizing.value) : updater;
        },
      }),
});

let disconnectObserver: (() => void) | undefined;

onMounted(() => {
  const el = tableContainerRef.value;
  if (!el) return;

  let wasVisible = el.offsetWidth > 0;

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (!(entry.target instanceof HTMLDivElement)) continue;
      entry.target.style.setProperty('--dt-container-width', `${entry.contentRect.width}px`);

      const isVisible = entry.contentRect.width > 0;
      if (!wasVisible && isVisible) {
        el.scrollTop = 0;
        el.style.opacity = '0';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.opacity = '';
          });
        });
      }
      wasVisible = isVisible;
    }
  });

  resizeObserver.observe(el);

  disconnectObserver = () => resizeObserver.disconnect();
});
onBeforeUnmount(() => disconnectObserver?.());

watch(
  () => props.id,
  (id) => {
    if (!id) {
      return;
    }

    columnSizing.value = loadColumnSizing(id);
  },
);

// upstream persists on every columnSizing change (effects run on mount too)
watch(columnSizing, (sizing) => {
  if (!props.id) {
    return;
  }

  localStorage.setItem(columnSizeKey(props.id), JSON.stringify(sizing));
});

// --- TableBody (upstream: in-file forwardRef component) ---------------------

const rows = computed(() => table.getRowModel().rows);
const cursor = useDecisionTableState(({ cursor }) => cursor);

const virtualizer = useVirtualizer<HTMLDivElement, HTMLElement>(
  computed(() => ({
    getScrollElement: () => tableContainerRef.value,
    estimateSize: () => 38,
    indexAttribute: 'data-virtual-index',
    count: rows.value.length,
    overscan: 5,
  })),
);

// PORTING: upstream assigns scrollApiRef.current in an effect and nulls it on
// cleanup; the same api object is also exposed on this component (ref-method
// surface for consumers that don't pass a ref).
const scrollApi: TableScrollApi = {
  getTopRowIndex: () => {
    const offset = tableContainerRef.value?.scrollTop ?? 0;
    return virtualizer.value.getVirtualItemForOffset(offset)?.index ?? 0;
  },
  scrollToRowIndex: (index: number) => virtualizer.value.scrollToIndex(index, { align: 'start' }),
};

onMounted(() => {
  if (props.scrollApiRef) props.scrollApiRef.value = scrollApi;
});
onBeforeUnmount(() => {
  if (props.scrollApiRef) props.scrollApiRef.value = null;
});
defineExpose({ getTopRowIndex: scrollApi.getTopRowIndex, scrollToRowIndex: scrollApi.scrollToRowIndex });

const virtualItems = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());
const padding = computed(() => computeVirtualPadding(virtualItems.value, totalSize.value));

const measureElement = (node: HTMLElement | null) => {
  if (node) virtualizer.value.measureElement(node);
};

const onKeyDown = (e: KeyboardEvent) => {
  if (disabled.value) {
    return;
  }

  if (e.code === 'ArrowUp' && (e.metaKey || e.altKey)) {
    if (cursor.value) tableActions.addRowAbove(cursor.value.y);
  }
  if (e.code === 'ArrowDown' && (e.metaKey || e.altKey)) {
    if (cursor.value) tableActions.addRowBelow(cursor.value.y);
  }
  if (e.code === 'Backspace' && (e.metaKey || e.altKey)) {
    if (cursor.value) tableActions.removeRow(cursor.value.y);
  }
};

// --- Row drag & drop ---------------------------------------------------------

// PORTING(DnD): react-dnd's per-row useDrag/useDrop (drop = swapRows(dragged,
// hovered)) → list-level vue-draggable-plus on the tbody, per PORTING.md's
// DnD map and expression-list.vue's pattern. Sortable reports indices
// relative to the RENDERED window, which is not the row index once the table
// scrolls — so the absolute source/target indices are captured from
// data-virtual-index and the binding's setter replays upstream's swap (the
// reordered array Sortable computes is discarded).
const readVirtualIndex = (el: HTMLElement | null | undefined): number | null => {
  const raw = el?.getAttribute?.('data-virtual-index');
  const parsed = raw == null ? NaN : Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const dragState = reactive({ sourceIndex: null as number | null, targetId: null as string | null });
const drop = reactive({ id: null as string | null, direction: null as 'up' | 'down' | null });
const draggingId = ref<string | null>(null);

const tbodyRef = ref<HTMLElement | null>(null);

const rulesBinding = computed({
  get: () => rules.value,
  set: () => {
    if (dragState.sourceIndex == null || dragState.targetId == null) {
      return;
    }

    const targetIndex = rules.value.findIndex((r) => r._id === dragState.targetId);
    if (targetIndex >= 0) {
      tableActions.swapRows(dragState.sourceIndex, targetIndex);
    }
  },
});

const clearDragState = () => {
  dragState.sourceIndex = null;
  dragState.targetId = null;
  drop.id = null;
  drop.direction = null;
  draggingId.value = null;
};

const dragOptions = computed<UseDraggableOptions<Record<string, string>>>(() => ({
  handle: '.sort-handler',
  // exclude the virtual spacer rows Sortable would otherwise count as items
  draggable: '.table-row',
  animation: 0,
  disabled: disabled.value,
  onStart: (evt) => {
    const index = readVirtualIndex(evt.item as HTMLElement);
    dragState.sourceIndex = index;
    draggingId.value = index == null ? null : (rules.value[index]?._id ?? null);
  },
  onMove: (evt) => {
    const index = readVirtualIndex(evt.related as HTMLElement | undefined);
    const row = index == null ? undefined : rows.value[index];
    drop.id = row?.id ?? null;
    drop.direction = evt.willInsertAfter ? 'down' : 'up';
    return true;
  },
  onUpdate: () => {
    // the binding's setter has replayed the swap by now; reset the indicators
    dragState.sourceIndex = null;
    dragState.targetId = null;
    drop.id = null;
    drop.direction = null;
  },
  onEnd: clearDragState,
}));

useDraggable(tbodyRef, rulesBinding, dragOptions);

// --- Render -------------------------------------------------------------------

// PORTING: React px-ifies numeric style values; Vue does not.
const containerStyle = computed<CSSProperties>(() => ({
  maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
  overflowY: 'auto',
}));

const tableWidth = computed(() => `${table.getCenterTotalSize()}px`);
</script>

<template>
  <div :ref="setContainerRef" class="grl-dt__container" :style="containerStyle" :data-theme="themeMode">
    <!-- upstream StyledTable (in-file wrapper) inlined -->
    <table class="table" :style="{ width: tableWidth }">
      <thead>
        <TableHeadRow
          v-for="headerGroup in table.getHeaderGroups().filter((_, i) => i === 0)"
          :key="headerGroup.id"
          :header-group="headerGroup"
        />
      </thead>
    </table>
    <table class="table" :style="{ width: tableWidth }">
      <thead>
        <TableHeadRow
          v-for="headerGroup in table.getHeaderGroups().filter((_, i) => i === 1)"
          :key="headerGroup.id"
          :header-group="headerGroup"
        />
      </thead>
      <TableContextMenu>
        <tbody ref="tbodyRef" @keydown="onKeyDown">
          <tr v-if="padding.paddingTop > 0">
            <td :style="{ height: `${padding.paddingTop}px` }" />
          </tr>
          <TableRow
            v-for="item in virtualItems"
            :key="String(item.key)"
            :virtual-item="item"
            :row="rows[item.index]"
            :disabled="disabled"
            :on-resize="measureElement"
            :drop-direction="drop.id !== null && drop.id === rows[item.index]?.id ? drop.direction : null"
            :dragging="draggingId !== null && draggingId === rows[item.index]?.id"
          />
          <tr v-if="padding.paddingBottom > 0">
            <td :style="{ height: `${padding.paddingBottom}px` }" />
          </tr>
        </tbody>
      </TableContextMenu>
      <tfoot>
        <tr>
          <td :colspan="inputs.length + outputs.length + 2">
            <div class="grl-dt__add-row-wrapper">
              <Button
                class="grl-dt__add-row"
                type="link"
                :disabled="disabled"
                @click="() => tableActions.addRowBelow()"
              >
                <template #icon><PlusCircle :size="14" /></template>
                Add row
              </Button>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
