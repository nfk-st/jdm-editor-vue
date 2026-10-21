<script setup lang="ts">
// Ported from components/decision-graph/dg-empty.tsx — renderless controller
// bridging the public DecisionGraph props into the store (the dt-empty
// pattern). Renders nothing.
import { useDebounceFn } from '@vueuse/core';
import equal from 'fast-deep-equal/es6/react';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import type { DictionaryMap } from '../../theme';
import type { JdmUiMode } from '../decision-table/context/dt-store.context';
import type { DecisionGraphStoreType } from './context/dg-store.context';
import { useDecisionGraphActions, useDecisionGraphRaw, useDecisionGraphState } from './context/dg-store.context';
import type { DecisionGraphType } from './dg-types';

export type DecisionGraphEmptyType = {
  id?: string;
  defaultValue?: DecisionGraphType;
  modelValue?: DecisionGraphType;

  disabled?: boolean;

  components?: DecisionGraphStoreType['state']['components'];
  customNodes?: DecisionGraphStoreType['state']['customNodes'];

  hideLeftToolbar?: DecisionGraphStoreType['state']['hideLeftToolbar'];

  name?: DecisionGraphStoreType['state']['name'];

  viewConfigCta?: DecisionGraphStoreType['state']['viewConfigCta'];
  viewConfig?: DecisionGraphStoreType['state']['viewConfig'];
  onViewConfigCta?: DecisionGraphStoreType['listeners']['onViewConfigCta'];

  defaultActivePanel?: string;
  panels?: DecisionGraphStoreType['state']['panels'];
  onPanelsChange?: DecisionGraphStoreType['listeners']['onPanelsChange'];

  simulate?: DecisionGraphStoreType['state']['simulate'];

  dictionaries?: DictionaryMap;
  mode?: JdmUiMode;

  onChange?: DecisionGraphStoreType['listeners']['onChange'];
  onReactFlowInit?: DecisionGraphStoreType['listeners']['onReactFlowInit'];

  onCodeExtension?: DecisionGraphStoreType['listeners']['onCodeExtension'];
  onFunctionReady?: DecisionGraphStoreType['listeners']['onFunctionReady'];
};

const props = defineProps<DecisionGraphEmptyType>();

const emit = defineEmits<{ (e: 'update:modelValue', graph: DecisionGraphType): void }>();

const mounted = ref(false);
const graphActions = useDecisionGraphActions();
const { stateStore, listenerStore } = useDecisionGraphRaw();
const decisionGraph = useDecisionGraphState(({ decisionGraph }) => decisionGraph);
const openTabs = useDecisionGraphState(({ openTabs }) => openTabs);
const activeTab = useDecisionGraphState(({ activeTab }) => activeTab);

// upstream: useDebouncedCallback(onChange, 100)
// PORTING: React's use-debounce cancels the pending call when the component
// unmounts; @vueuse/core's debounce does not, so the change event could
// fire after the editor was gone.
let unmounted = false;

const innerChange = useDebounceFn((graph: DecisionGraphType) => {
  if (unmounted) {
    return;
  }

  emit('update:modelValue', graph);
  props.onChange?.(graph);
}, 100);

onBeforeUnmount(() => {
  unmounted = true;
});

watch(
  () => props.viewConfig,
  (viewConfig) => {
    if (viewConfig?.enabled) {
      const filtered = openTabs.value.filter((tab) => !!viewConfig?.permissions?.[tab]);

      stateStore.setState({
        openTabs: filtered,
        activeTab: !!viewConfig?.permissions?.[activeTab.value] ? activeTab.value : 'graph',
      });
    }
  },
  { immediate: true },
);

watch(
  () =>
    [
      props.id,
      props.disabled,
      props.components,
      props.customNodes,
      props.panels,
      props.viewConfig,
      props.viewConfigCta,
      props.hideLeftToolbar,
      props.dictionaries,
      props.mode,
    ] as const,
  ([id, disabled, components, customNodes, panels, viewConfig, viewConfigCta, hideLeftToolbar, dictionaries, mode]) => {
    stateStore.setState({
      id,
      disabled,
      components: Array.isArray(components) ? components : [],
      customNodes: Array.isArray(customNodes) ? customNodes : [],
      panels,
      viewConfig,
      viewConfigCta,
      hideLeftToolbar,
      dictionaries,
      mode,
    });
  },
  { immediate: true },
);

watch(
  () => props.name,
  (name) => {
    stateStore.setState({ name: name ?? 'graph.json' });
  },
  { immediate: true },
);

watch(
  () => props.simulate,
  (simulate) => {
    stateStore.setState({ simulate });
  },
  { immediate: true },
);

watch(
  () =>
    [
      props.onReactFlowInit,
      props.onPanelsChange,
      props.onCodeExtension,
      props.onFunctionReady,
      props.onViewConfigCta,
    ] as const,
  ([onReactFlowInit, onPanelsChange, onCodeExtension, onFunctionReady, onViewConfigCta]) => {
    listenerStore.setState({
      onReactFlowInit,
      onPanelsChange,
      onCodeExtension,
      onFunctionReady,
      onViewConfigCta,
    });
  },
  { immediate: true },
);

watch(
  () => innerChange,
  () => {
    listenerStore.setState({ onChange: innerChange });
  },
  { immediate: true },
);

onMounted(() => {
  if (props.modelValue !== undefined) {
    graphActions.setDecisionGraph(props.modelValue);
  } else if (props.defaultValue !== undefined) {
    graphActions.setDecisionGraph(props.defaultValue);
  }

  stateStore.setState({
    activePanel: props.defaultActivePanel,
    hideLeftToolbar: props.hideLeftToolbar,
  });
  mounted.value = true;
});

watch(
  () => props.modelValue,
  (value) => {
    if (mounted.value && value !== undefined && !equal(value, decisionGraph.value)) {
      graphActions.setDecisionGraph(value);
    }
  },
);
</script>

<template>
  <slot />
</template>
