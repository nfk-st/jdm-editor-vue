<script lang="ts">
// Ported from components/decision-graph/dg-wrapper.tsx.
import type { DecisionGraphSnapshot } from './context/serializer.context';
import type { GraphRef } from './graph/graph.vue';

export type DecisionGraphWrapperProps = {
  // PORTING: upstream's `reactFlowProOptions?: ProOptions` is DROPPED
  // entirely — vue-flow is MIT, so there is no attribution to carry
  // (docs/vue-flow-mapping.md). The prop is not accepted at all.
  //
  // PORTING: upstream's `tabBarExtraContent?: TabsProps['tabBarExtraContent']`
  // (a ReactNode prop) becomes the #tab-bar-extra-content slot — upstream
  // render props become Vue slots (docs/PORTING.md's React → Vue table).
};
</script>

<script setup lang="ts">
// PORTING(DnD): upstream's in-file TabContents builds a react-dnd
// HTML5Backend manager scoped to the tab container and hands it to every
// specification's renderTab({ id, manager }). react-dnd is replaced by
// vue-draggable-plus (docs/PORTING.md dependency map), so the manager is
// dropped — renderTab receives only the node id (expression.vue / dt.vue
// precedent).
//
// PORTING: upstream wraps the tree in reactflow's <ReactFlowProvider>.
// Dropped — useVueFlow() self-provides (docs/vue-flow-mapping.md).
import clsx from 'clsx';
import { match } from 'ts-pattern';
import { type VNode, defineComponent, h, ref } from 'vue';

import { useDecisionGraphActions, useDecisionGraphState } from './context/dg-store.context';
import DgPanel from './dg-panel.vue';
import GraphNodes from './graph/graph-nodes.vue';
import GraphSideToolbar from './graph/graph-side-toolbar.vue';
import GraphTabs from './graph/graph-tabs.vue';
import Graph from './graph/graph.vue';
import { decisionTableSpecification } from './nodes/specifications/decision-table.specification';
import { expressionSpecification } from './nodes/specifications/expression.specification';
import { functionSpecification } from './nodes/specifications/function.specification';
import { inputSpecification } from './nodes/specifications/input.specification';
import { outputSpecification } from './nodes/specifications/output.specification';
import { NodeKind } from './nodes/specifications/specification-types';
import type { NodeSpecification } from './nodes/specifications/specification-types';

// upstream: const [disableTabs, setDisableTabs] = useState(false)
const disableTabs = ref(false);

const graphActions = useDecisionGraphActions();
const hideLeftToolbar = useDecisionGraphState((s) => s.hideLeftToolbar);
const viewConfig = useDecisionGraphState((s) => s.viewConfig);
const hasActiveNode = useDecisionGraphState(({ decisionGraph, activeTab }) =>
  (decisionGraph?.nodes ?? []).some((node) => node.id === activeTab),
);

// upstream: the forwarded ref points at the graph canvas, whose imperative
// handle is GraphRef (the store actions + stateStore + serialize/restore).
const graphRef = ref<InstanceType<typeof Graph> | null>(null);

defineExpose({
  // upstream: useImperativeHandle(ref, () => ({ ...graphActions, stateStore,
  // serialize, restore })). The actions are a stable object; the rest
  // delegate to the canvas through the template ref.
  ...graphActions,
  get stateStore() {
    return (graphRef.value as unknown as GraphRef | null)?.stateStore;
  },
  serialize: (): DecisionGraphSnapshot =>
    (graphRef.value as unknown as GraphRef | null)?.serialize() ?? ({} as DecisionGraphSnapshot),
  restore: (snapshot: DecisionGraphSnapshot) => {
    (graphRef.value as unknown as GraphRef | null)?.restore(snapshot);
  },
});

// upstream: the in-file TabContents (dg-wrapper.tsx:67-115) — renders the
// open tabs' bodies. PORTING: the react-dnd manager is dropped; the
// specification's renderTab receives only the node id.
const renderTabContent = (node: { id: string; type?: string }, components: NodeSpecification[]): VNode | null => {
  const specification = match(node?.type)
    .with(NodeKind.DecisionTable, () => decisionTableSpecification)
    .with(NodeKind.Function, () => functionSpecification)
    .with(NodeKind.Expression, () => expressionSpecification)
    .with(NodeKind.Input, () => inputSpecification)
    .with(NodeKind.Output, () => outputSpecification)
    .otherwise(() => components.find((cmp) => cmp.type === node.type));

  return specification?.renderTab?.({ id: node.id }) ?? null;
};

const TabContents = defineComponent({
  name: 'TabContents',
  setup() {
    const openNodes = useDecisionGraphState(({ decisionGraph, openTabs }) =>
      (decisionGraph?.nodes ?? []).filter((node) => openTabs.includes(node.id)).map(({ id, type }) => ({ id, type })),
    );
    const activeNodeId = useDecisionGraphState(
      ({ decisionGraph, activeTab }) => (decisionGraph?.nodes ?? []).find((node) => node.id === activeTab)?.id,
    );
    const components = useDecisionGraphState((s) => s.components);

    return () =>
      h(
        'div',
        { style: { display: 'contents' } },
        openNodes.value.map((node) =>
          h('div', { key: node.id, class: clsx(['tab-content', activeNodeId.value === node.id && 'active']) }, [
            renderTabContent(node, components.value),
          ]),
        ),
      );
  },
});
</script>

<template>
  <div>
    <GraphSideToolbar v-if="!hideLeftToolbar" />
    <div class="grl-dg__graph">
      <GraphTabs :disabled="disableTabs">
        <template #extra>
          <slot name="tab-bar-extra-content" />
        </template>
      </GraphTabs>

      <Graph
        ref="graphRef"
        :class-name="clsx([!hasActiveNode && !viewConfig?.enabled && 'active'])"
        :on-disable-tabs="(val: boolean) => (disableTabs = val)"
      />
      <GraphNodes :class-name="clsx([!hasActiveNode && viewConfig?.enabled && 'active'])" />
      <TabContents />
    </div>
    <DgPanel />
  </div>
</template>
