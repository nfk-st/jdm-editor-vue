<script lang="ts">
// Ported from components/decision-graph/graph/tab-expression.tsx.
// PORTING(DnD): upstream's `manager?: DragDropManager` prop is dropped with
// react-dnd (docs/PORTING.md dependency map) — renderTab passes only the id.
export type TabExpressionProps = {
  id: string;
};

// upstream: tab-expression.tsx:123-129
const safeJson = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};
</script>

<script setup lang="ts">
import { P, match } from 'ts-pattern';
import { computed, ref } from 'vue';
import type { z } from 'zod';

import type { GetNodeDataResult } from '../../../helpers/node-data';
import { getNodeData } from '../../../helpers/node-data';
import type { expressionNodeSchema } from '../../../helpers/schema';
import { get } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import { Expression } from '../../expression';
import type { ExpressionPermission } from '../../expression/context/expression-store.context';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { useTabSerializer } from '../context/serializer.context';
import type { NodeExpressionData } from '../nodes/specifications/expression.specification';
import type { SimulationTrace, SimulationTraceDataExpression } from '../simulator/simulation.types';

type ScrollPosition = { top: number; left: number };

const props = defineProps<TabExpressionProps>();

const graphActions = useDecisionGraphActions();
const scrollContainerRef = ref<HTMLDivElement | null>(null);

useTabSerializer<ScrollPosition>(props.id, 'scroll', {
  serialize: () => {
    const el = scrollContainerRef.value;
    if (!el) return { top: 0, left: 0 };
    return { top: el.scrollTop, left: el.scrollLeft };
  },
  restore: (position) => {
    if (!position) return;
    let attempts = 0;
    const apply = () => {
      const el = scrollContainerRef.value;
      if (!el || el.scrollHeight <= el.clientHeight) {
        if (attempts++ < 60) requestAnimationFrame(apply);
        return;
      }
      el.scrollTop = position.top;
      el.scrollLeft = position.left;
    };
    requestAnimationFrame(apply);
  },
});

const state = useDecisionGraphState(({ disabled, decisionGraph }) => ({
  disabled,
  content: (decisionGraph?.nodes ?? []).find((node) => node.id === props.id)?.content as NodeExpressionData,
}));

const simulateState = useDecisionGraphState(({ simulate, decisionGraph, viewConfig }) => ({
  nodeTrace: match(simulate)
    .with(
      { result: P.nonNullable },
      ({ result }) => result.trace[props.id] as SimulationTrace<SimulationTraceDataExpression>,
    )
    .otherwise(() => null),
  inputData: match(simulate)
    .with({ result: P.nonNullable }, ({ result }) => getNodeData(props.id, { trace: result.trace, decisionGraph }))
    .otherwise(() => null),
  nodeSnapshot: match(simulate)
    .with(
      { result: P.nonNullable },
      ({ result }) =>
        (result.snapshot?.nodes || []).find((n) => n.id === props.id)?.content as z.infer<
          typeof expressionNodeSchema
        >['content'],
    )
    .otherwise(() => null),
  viewConfig,
}));

const debug = computed(() => {
  const { nodeTrace, inputData, nodeSnapshot } = simulateState.value;
  if (!nodeTrace || !inputData || !nodeSnapshot) {
    return undefined;
  }

  if (!isWasmAvailable()) {
    return { trace: nodeTrace, snapshot: nodeSnapshot };
  }

  const $data = Object.fromEntries(
    Object.entries(nodeTrace?.traceData ?? {}).map(([k, v]) => [k, safeJson((v as { result: string }).result)]),
  );
  const extendedInputData: GetNodeDataResult = {
    ...inputData,
    $: $data,
  };

  if (state.value.content?.inputField) {
    extendedInputData.data = get(extendedInputData.data, state.value.content.inputField, {});
  }

  return { trace: nodeTrace, inputData: extendedInputData, snapshot: nodeSnapshot };
});

const permission = computed(
  () =>
    (simulateState.value.viewConfig?.enabled
      ? simulateState.value.viewConfig?.permissions?.[props.id]
      : 'edit:full') as ExpressionPermission,
);
</script>

<template>
  <div ref="scrollContainerRef" :style="{ height: '100%', overflowY: 'auto', boxSizing: 'border-box' }">
    <Expression
      :model-value="state.content?.expressions"
      :disabled="state.disabled"
      :permission="permission"
      :debug="debug"
      @update:model-value="
        (val) => {
          graphActions.updateNode(id, (draft) => {
            draft.content.expressions = val;
            return draft;
          });
        }
      "
    />
  </div>
</template>
