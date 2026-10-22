<script lang="ts">
// Ported from components/decision-graph/dg.tsx — the public DecisionGraph.
import type { DecisionGraphContextProps } from './context/dg-store.context';
import type { DecisionGraphEmptyType } from './dg-empty.vue';
import type { DecisionGraphType } from './dg-types';
import type { GraphRef } from './graph/graph.vue';

export type DecisionGraphProps = {
  // PORTING(P2): upstream's public `manager?: DragDropManager` (react-dnd)
  // shared a DnD context with decision-graph's tab wrapper. Deprecated stub:
  // accepted and ignored — the port's drag-and-drop is HTML5-native
  // (expression.vue / dt.vue precedent).
  manager?: unknown;
  // PORTING: upstream's `reactFlowProOptions?: ProOptions` is DROPPED
  // entirely — vue-flow is MIT, so there is no attribution to carry
  // (docs/vue-flow-mapping.md). The prop is not accepted at all.
  //
  // PORTING: upstream's `tabBarExtraContent?: TabsProps['tabBarExtraContent']`
  // becomes slots: #tab-bar-extra-content (single/right content), or
  // #tab-bar-extra-content-left and -right for its { left, right } form.
} & DecisionGraphContextProps &
  DecisionGraphEmptyType;

// upstream: export type DecisionGraphRef = GraphRef
export type DecisionGraphRef = GraphRef;
</script>

<script setup lang="ts">
// PORTING: upstream wraps the tree in reactflow's <ReactFlowProvider>.
// Dropped — useVueFlow() self-provides (docs/vue-flow-mapping.md).
import { computed, ref } from 'vue';

import { DecisionGraphProvider } from './context/dg-store.context';
import type { DecisionGraphSnapshot } from './context/serializer.context';
import { SerializerProvider } from './context/serializer.context';
import DecisionGraphEmpty from './dg-empty.vue';
import { DecisionGraphInferTypes } from './dg-infer';
import DgWrapper from './dg-wrapper.vue';
import './dg.scss';

const props = defineProps<DecisionGraphProps>();

const emit = defineEmits<{ (e: 'update:modelValue', graph: DecisionGraphType): void }>();

// upstream: <DecisionGraphProvider> / <SerializerProvider> — provide() is
// setup-scoped in Vue, so the providers run here and the tree below injects
// them (dt.vue precedent). The provider returns the bundle it created, so
// the public ref surface can reuse it — a component cannot inject what it
// provided itself.
const bundle = DecisionGraphProvider();
SerializerProvider();

const wrapperRef = ref<InstanceType<typeof DgWrapper> | null>(null);

// upstream: forwardRef<DecisionGraphRef> → <DecisionGraphWrapper ref={ref} />;
// the wrapper's imperative handle is GraphRef (the store actions + stateStore
// + serialize/restore).
defineExpose({
  ...bundle.actions,
  get stateStore() {
    return wrapperRef.value?.stateStore;
  },
  serialize: () => wrapperRef.value?.serialize(),
  restore: (snapshot: DecisionGraphSnapshot) => {
    wrapperRef.value?.restore(snapshot);
  },
});

// upstream: <DecisionGraphEmpty {...props} /> — everything except the
// dg-specific keys rides through to the empty-state controller (dt.vue
// precedent).
const emptyProps = computed(() => {
  const { manager, ...rest } = props;
  return rest;
});
</script>

<template>
  <div class="grl-dg" :class="{ 'hidden-left-toolbar': props.hideLeftToolbar }">
    <DgWrapper ref="wrapperRef">
      <template v-if="$slots['tab-bar-extra-content']" #tab-bar-extra-content>
        <slot name="tab-bar-extra-content" />
      </template>
      <template v-if="$slots['tab-bar-extra-content-left']" #tab-bar-extra-content-left>
        <slot name="tab-bar-extra-content-left" />
      </template>
      <template v-if="$slots['tab-bar-extra-content-right']" #tab-bar-extra-content-right>
        <slot name="tab-bar-extra-content-right" />
      </template>
    </DgWrapper>
    <DecisionGraphInferTypes />
    <DecisionGraphEmpty v-bind="emptyProps" @update:model-value="(v) => emit('update:modelValue', v)" />
  </div>
</template>
