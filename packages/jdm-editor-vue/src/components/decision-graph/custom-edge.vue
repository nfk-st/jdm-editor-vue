<script lang="ts">
// Ported from components/decision-graph/custom-edge.tsx.
// upstream: React.FC<EdgeProps> — reactflow's EdgeProps → @vue-flow/core's
// EdgeProps. PORTING: the props the component reads are declared explicitly:
// the SFC compiler cannot resolve a built-in utility type (e.g.
// `Record<string, unknown>`) as the TOP-LEVEL props type, and declaring the
// fields keeps the runtime prop list meaningful. `inheritAttrs: false` (the
// repo's ui/ primitive convention) keeps the rest of vue-flow's edge props
// off the DOM — React ignored them, so they must not become attributes.
export type CustomEdgeProps = {
  id: string;
  sourceX: number;
  sourceY: number;
  sourcePosition: string;
  targetX: number;
  targetY: number;
  targetPosition: string;
  style?: Record<string, unknown>;
  markerEnd?: unknown;
};
</script>

<script setup lang="ts">
// PORTING: vue-flow passes the whole GraphEdge as props (vue-flow-mapping.md)
// — destructure the upstream EdgeProps fields it carries.
import { BaseEdge, EdgeLabelRenderer, type Position, getBezierPath } from '@vue-flow/core';
import clsx from 'clsx';
import { Delete } from 'lucide-vue-next';
import { match } from 'ts-pattern';
import { computed } from 'vue';

import Button from '../ui/Button.vue';
import { useDecisionGraphActions, useDecisionGraphState, useEdgeDiff } from './context/dg-store.context';

defineOptions({ inheritAttrs: false });

const props = defineProps<CustomEdgeProps>();

const graphActions = useDecisionGraphActions();
const id = computed(() => props.id);
const state = useDecisionGraphState(({ hoveredEdgeId, disabled }) => ({
  isHovered: hoveredEdgeId === id.value,
  disabled,
}));

// one CustomEdge instance per edge — id is stable for the component lifetime
const { diff } = useEdgeDiff(id.value);

const path = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition as Position,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition as Position,
  }),
);

const edgeStyle = computed(() => ({
  ...(props.style || {}),
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
