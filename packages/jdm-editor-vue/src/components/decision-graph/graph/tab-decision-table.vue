<script lang="ts">
// Ported from components/decision-graph/graph/tab-decision-table.tsx.
// PORTING(DnD): upstream's `manager?: DragDropManager` prop is dropped with
// react-dnd (docs/PORTING.md dependency map) — renderTab passes only the id.
export type TabDecisionTableProps = {
  id: string;
};
</script>

<script setup lang="ts">
import { P, match } from 'ts-pattern';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import { getNodeData } from '../../../helpers/node-data';
import { get } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import { DecisionTable } from '../../decision-table';
import type { DecisionTableType, TableScrollApi } from '../../decision-table';
import type { DecisionTablePermission } from '../../decision-table/context/dt-store.context';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { useTabSerializer } from '../context/serializer.context';
import type { NodeDecisionTableData } from '../nodes/specifications/decision-table.specification';
import type { SimulationTrace, SimulationTraceDataTable } from '../simulator/simulation.types';

type TableScrollSnapshot = { rowIndex: number; scrollLeft: number };

const props = defineProps<TabDecisionTableProps>();

const graphActions = useDecisionGraphActions();
const scrollContainerRef = ref<HTMLDivElement | null>(null);
const scrollApiRef = ref<TableScrollApi | null>(null);

useTabSerializer<TableScrollSnapshot>(props.id, 'scroll', {
  serialize: () => ({
    rowIndex: scrollApiRef.value?.getTopRowIndex() ?? 0,
    scrollLeft: scrollContainerRef.value?.scrollLeft ?? 0,
  }),
  restore: (snapshot) => {
    if (!snapshot) return;
    let attempts = 0;
    const apply = () => {
      const api = scrollApiRef.value;
      const el = scrollContainerRef.value;
      if (!api || !el || el.scrollHeight <= el.clientHeight) {
        if (attempts++ < 60) requestAnimationFrame(apply);
        return;
      }
      api.scrollToRowIndex(snapshot.rowIndex);
      el.scrollLeft = snapshot.scrollLeft;
    };
    requestAnimationFrame(apply);
  },
});

const state = useDecisionGraphState(({ simulate, decisionGraph, viewConfig, dictionaries, mode }) => ({
  nodeName: decisionGraph.nodes.find((n) => n.id === props.id)?.name,
  nodeTrace: match(simulate)
    .with(
      { result: P.nonNullable },
      ({ result }) => result.trace[props.id] as SimulationTrace<SimulationTraceDataTable>,
    )
    .otherwise(() => null),
  inputData: match(simulate)
    .with({ result: P.nonNullable }, ({ result }) => getNodeData(props.id, { trace: result.trace, decisionGraph }))
    .otherwise(() => null),
  nodeSnapshot: match(simulate)
    .with(
      { result: P.nonNullable },
      ({ result }) => (result.snapshot?.nodes || []).find((n) => n.id === props.id)?.content as DecisionTableType,
    )
    .otherwise(() => null),
  viewConfig,
  dictionaries,
  mode,
}));

const contentState = useDecisionGraphState(({ disabled, decisionGraph }) => ({
  disabled,
  content: (decisionGraph?.nodes ?? []).find((node) => node.id === props.id)?.content as NodeDecisionTableData,
}));

const debug = computed(() => {
  const { nodeTrace, inputData, nodeSnapshot } = state.value;
  if (!nodeTrace || !inputData || !nodeSnapshot) {
    return undefined;
  }

  if (!isWasmAvailable()) {
    return { trace: nodeTrace, snapshot: nodeSnapshot };
  }

  const extendedInputData = { ...inputData };
  if (contentState.value.content?.inputField) {
    extendedInputData.data = get(extendedInputData.data, contentState.value.content.inputField, {});
  }

  return { trace: nodeTrace, inputData: extendedInputData, snapshot: nodeSnapshot };
});

const permission = computed<DecisionTablePermission>(() =>
  state.value.viewConfig?.enabled
    ? (state.value.viewConfig?.permissions?.[props.id] as DecisionTablePermission)
    : 'edit:full',
);

// PORTING: upstream forwards its MutableRefObjects; the Table re-exposes the
// same refs (dt.vue keeps local fallbacks when none ride in) — Ref objects
// ride inside a plain holder because script-setup templates auto-unwrap
// top-level ref bindings (which would strip the Ref Table wants).
const scrollRefs: { container: Ref<HTMLDivElement | null>; api: Ref<TableScrollApi | null> } = {
  container: scrollContainerRef,
  api: scrollApiRef,
};
</script>

<template>
  <DecisionTable
    :id="id"
    :name="state.nodeName"
    table-height="100%"
    :model-value="contentState.content as any"
    :scroll-container-ref="scrollRefs.container"
    :scroll-api-ref="scrollRefs.api"
    :disabled="contentState.disabled"
    :permission="permission"
    :dictionaries="state.dictionaries"
    :mode="state.mode"
    :debug="debug"
    @update:model-value="
      (val) => {
        graphActions.updateNode(id, (draft) => {
          Object.assign(draft.content, val);
          return draft;
        });
      }
    "
  />
</template>
