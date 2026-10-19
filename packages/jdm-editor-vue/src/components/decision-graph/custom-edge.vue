<script setup lang="ts">
// Ported from components/decision-graph/custom-edge.tsx.
// PORTING: vue-flow passes the whole GraphEdge as props (vue-flow-mapping.md)
// — destructure the upstream EdgeProps fields it carries.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Position } from '@vue-flow/core';
import clsx from 'clsx';
import { Delete } from 'lucide-vue-next';
import { match } from 'ts-pattern';
import { computed } from 'vue';

import { useDecisionGraphActions, useDecisionGraphState, useEdgeDiff } from './context/dg-store.context';
import Button from '../ui/Button.vue';

const props = defineProps<Record<string, unknown>>();

const graphActions = useDecisionGraphActions();
const id = computed(() => props.id as string);
const state = useDecisionGraphState(({ hoveredEdgeId, disabled }) => ({
  isHovered: hoveredEdgeId === id.value,
  disabled,
}));

// one CustomEdge instance per edge — id is stable for the component lifetime
const { diff } = useEdgeDiff(id.value as string);

const path = computed(() =>
  getBezierPath({
    sourceX: props.sourceX as number,
    sourceY: props.sourceY as number,
    sourcePosition: props.sourcePosition as Position,
    targetX: props.targetX as number,
    targetY: props.targetY as number,
    targetPosition: props.targetPosition as Position,
  }),
);

const edgeStyle = computed(() => ({
  ...((props.style as object) || {}),
  stroke: match(diff.value)
    .with({ status: 'added' }, () => 'var(--grl-color-success)')
    .with({ status: 'removed' }, () => 'var(--grl-color-error)')
    .otherwise(() => undefined),
}));
</script>

<template>
  <BaseEdge :path="path[0]" :marker-end="props.markerEnd as never" :style="edgeStyle" />
  <EdgeLabelRenderer>
    <div
      class="nodrag nopan edge-renderer"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px,${path[2]}px)` }"
    >
      <Button
        v-if="!state.disabled"
        type="primary"
        danger
        :class="clsx('grl-edge-delete-button')"
        :data-visible="state.isHovered"
        @click="() => graphActions.removeEdges([id])"
      >
        <template #icon><Delete :size="14" /></template>
      </Button>
    </div>
  </EdgeLabelRenderer>
</template>
