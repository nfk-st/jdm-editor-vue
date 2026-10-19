<script lang="ts">
// Ported from components/decision-table/dialog/fields-reorder-dialog.tsx.
// PORTING(DnD): per-card react-dnd (FieldCard's useDrag/useDrop hover math) →
// vue-draggable-plus on the list container (PORTING.md's DnD map); upstream's
// moveCard splice is the binding's setter. The Form/okButtonProps submit
// plumbing collapses into the footer's Update button calling onSuccess
// directly (same handler timing).
import type { TableSchemaItem } from '../context/dt-store.context';

export type FieldsReorderProps = {
  fields?: TableSchemaItem[];
  onSuccess?: (columns: TableSchemaItem[]) => void;
  onDismiss?: () => void;
  isOpen?: boolean;
  getContainer?: () => HTMLElement;
};
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { type UseDraggableOptions, useDraggable } from 'vue-draggable-plus';

import Stack from '../../stack.vue';
import Button from '../../ui/Button.vue';
import Modal from '../../ui/Modal.vue';

const props = withDefaults(defineProps<FieldsReorderProps>(), { isOpen: false });

const columns = ref<TableSchemaItem[]>([]);

watch(
  () => [props.isOpen, props.fields] as const,
  ([isOpen, fields]) => {
    if (isOpen) {
      columns.value = [...(fields || [])];
    }
  },
);

// Sortable binding: the reordered list Sortable computes IS the new order.
const columnsBinding = computed({
  get: () => columns.value,
  set: (list: TableSchemaItem[]) => {
    columns.value = list;
  },
});

const listRef = ref<HTMLElement | null>(null);
const draggingId = ref<string | null>(null);

const dragOptions = computed<UseDraggableOptions<TableSchemaItem>>(() => ({
  animation: 0,
  // the list lives inside the modal body (unmounted while closed) — Sortable
  // starts when the ref resolves instead of at component mount
  immediate: false,
  onStart: (evt) => {
    draggingId.value = (evt.item as HTMLElement).getAttribute('data-col-id');
  },
  onEnd: () => {
    draggingId.value = null;
  },
}));

const { start: startSortable } = useDraggable(listRef, columnsBinding, dragOptions);

// PORTING: vue-draggable-plus defaults to initializing Sortable onMounted
// (immediate: true), which throws for the null ref while the modal body is
// unmounted — start() is driven by the ref resolving instead.
watch(
  listRef,
  (el) => {
    if (el) startSortable();
  },
  { flush: 'post' },
);

const submit = () => props.onSuccess?.(columns.value);
</script>

<template>
  <Modal
    :open="isOpen"
    title="Reorder fields"
    :width="360"
    :get-container="getContainer"
    @update:open="(o) => !o && props.onDismiss?.()"
  >
    <!-- PORTING: upstream's antd Form makes Enter submit (okButtonProps);
         a native form restores that here. -->
    <form @submit.prevent="submit">
      <Stack :gap="8" horizontal-align="stretch">
        <!-- PORTING: Sortable needs a real parent element for its items —
           upstream's Stack IS the list; ours wraps an inner flex column. -->
        <div ref="listRef" class="grl-dt__fields-reorder__list">
          <!-- antd Card → token-styled stand-in (additive class, styled below) -->
          <div
            v-for="column in columns"
            :key="column.id"
            :data-col-id="column.id"
            class="grl-dt__fields-reorder__card"
            :style="{ opacity: draggingId === column.id ? 0 : 1 }"
          >
            <div class="grl-dt__fields-reorder__item">
              <Stack horizontal vertical-align="center">
                <div class="grl-dt__fields-reorder__handle">=</div>
                <Stack :gap="0" grow>
                  <span class="grl-typography">{{ column.name }}</span>
                  <span class="grl-typography grl-typography--secondary" :style="{ fontSize: '12px' }">
                    {{ column.field }}
                  </span>
                </Stack>
              </Stack>
            </div>
          </div>
        </div>
      </Stack>
    </form>
    <template #footer>
      <Button @click="props.onDismiss?.()">Cancel</Button>
      <Button type="primary" @click="submit">Update</Button>
    </template>
  </Modal>
</template>

<style lang="scss">
// PORTING(additive): antd Card + bodyStyle padding 0.5rem → token-styled card.
.grl-dt__fields-reorder__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.grl-dt__fields-reorder__card {
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  padding: 0.5rem;
}
</style>
