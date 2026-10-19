<script lang="ts">
// Ported from components/decision-table/dt.tsx — the public DecisionTable.
import type { Ref } from 'vue';

import type { DecisionTableContextProps } from './context/dt-store.context';
import type { DecisionTableEmptyType } from './dt-empty.vue';

export type { TableScrollApi } from './table/table.vue';

export type DecisionTableProps = {
  id?: string;
  tableHeight: string | number;
  mountDialogsOnBody?: boolean;
  // PORTING(P2): upstream's public `manager?: DragDropManager` (react-dnd)
  // shared a DnD context with decision-graph's tab wrapper. Deprecated stub:
  // accepted and ignored — Sortable lists self-coordinate (expression.vue
  // precedent).
  manager?: unknown;
  scrollContainerRef?: Ref<HTMLDivElement | null>;
  scrollApiRef?: Ref<TableScrollApi | null>;
} & DecisionTableContextProps &
  DecisionTableEmptyType;
</script>

<script setup lang="ts">
// PORTING(DnD): upstream wraps everything in react-dnd's DndProvider (its only
// purpose was row reordering, now vue-draggable-plus inside table.vue) —
// dropped per PORTING.md's DnD map. The `ref.current &&` + setMounted gate is
// kept as a mounted ref so the dialog container ref exists before children
// render (expression.vue's client-only stance).
import { computed, defineComponent, h, onMounted, reactive, ref, watch, useSlots } from 'vue';

import { type DictionaryMap, provideDictionaries } from '../../theme';
import { DecisionTableDialogProvider } from './context/dt-dialog.context';
import { DecisionTableProvider, useDecisionTableState } from './context/dt-store.context';
import type { TableCellProps } from './context/dt-store.context';
import DecisionTableDialogs from './dialog/dt-dialogs.vue';
import DecisionTableCommandBar from './dt-command-bar.vue';
import DecisionTableEmpty from './dt-empty.vue';
import './dt.scss';
import type { TableScrollApi } from './table/table.vue';
import Table from './table/table.vue';

const props = withDefaults(defineProps<DecisionTableProps>(), { mountDialogsOnBody: false });

const emit = defineEmits<{
  (e: 'update:modelValue', value: DecisionTableEmptyType['modelValue']): void;
}>();

// upstream: const [_, setMounted] = useState(false) + useEffect(setMounted(true))
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const rootRef = ref<HTMLElement | null>(null);
const getContainer = () => rootRef.value as HTMLElement;

// Providers (upstream renders them; provide() is setup-scoped in Vue).
DecisionTableProvider();
// PORTING: upstream re-reads mountDialogsOnBody per render; ours captures the
// initial value (it is static in practice — decision-graph passes it fixed).
DecisionTableDialogProvider(props.mountDialogsOnBody ? undefined : getContainer);

// upstream: <DecisionTableEmpty {...props} /> — everything except the
// dt-specific keys rides through to the empty-state controller.
const emptyProps = computed(() => {
  const { id, tableHeight, mountDialogsOnBody, manager, scrollContainerRef, scrollApiRef, ...rest } = props;
  return rest;
});

// PORTING: upstream's `cellRenderer` is a public function prop (kept — it
// still rides through emptyProps); the Vue-idiomatic #cell slot adapts onto
// it (PORTING.md's render-props → slots rule; dt-empty.vue's porting note).
const slots = useSlots();
const cellRenderer = computed<DecisionTableEmptyType['cellRenderer']>(() => {
  if (!slots.cell) {
    return props.cellRenderer;
  }

  return (cellProps: TableCellProps) => {
    const nodes = slots.cell?.(cellProps) ?? [];
    if (!nodes.length) return null;
    return nodes.length === 1 ? nodes[0] : h('div', nodes);
  };
});

// upstream: const DictionaryBridge = ({ children }) => {
//   const dictionaries = useDecisionTableState((s) => s.dictionaries) ?? {};
//   return <DictionaryProvider value={dictionaries}>{children}</DictionaryProvider>;
// }
// PORTING: upstream re-provides per render via React context value; provide()
// runs once per setup here, so a reactive holder is provided and kept in
// sync with the store slice.
const DictionaryBridge = defineComponent({
  name: 'DictionaryBridge',
  setup(_, { slots }) {
    const dictionaries = useDecisionTableState((s) => s.dictionaries);
    const provided = reactive<DictionaryMap>({});
    watch(
      dictionaries,
      (d) => {
        for (const key of Object.keys(provided)) delete provided[key];
        Object.assign(provided, d ?? {});
      },
      { immediate: true },
    );
    provideDictionaries(provided);
    return () => slots.default?.();
  },
});

// PORTING: upstream forwards the caller's MutableRefObjects straight into
// Table; ours also keeps local fallbacks and exposes them so ref-less
// consumers can reach the scroll surface (Table re-exposes the same api).
// The refs ride inside a plain holder because script-setup templates
// auto-unwrap top-level ref bindings (which would strip the Ref Table wants).
const innerScrollContainerRef = ref<HTMLDivElement | null>(null);
const innerScrollApiRef = ref<TableScrollApi | null>(null);
const scrollRefs = {
  container: props.scrollContainerRef ?? innerScrollContainerRef,
  api: props.scrollApiRef ?? innerScrollApiRef,
};
// expose unwraps the refs — consumers get the element / api directly
defineExpose({ scrollContainer: scrollRefs.container, scrollApi: scrollRefs.api });
</script>

<template>
  <div ref="rootRef" class="grl-dt" :style="{ background: 'var(--grl-color-bg-elevated)' }">
    <template v-if="mounted">
      <DecisionTableCommandBar />
      <DictionaryBridge>
        <Table
          :id="id"
          :max-height="tableHeight"
          :scroll-container-ref="scrollRefs.container"
          :scroll-api-ref="scrollRefs.api"
        />
      </DictionaryBridge>
      <DecisionTableDialogs />
      <DecisionTableEmpty
        v-bind="emptyProps"
        :cell-renderer="cellRenderer"
        @update:model-value="(v) => emit('update:modelValue', v)"
      />
    </template>
  </div>
</template>
