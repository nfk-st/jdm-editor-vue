<script lang="ts">
// Ported from simulator/dg-simulator.tsx — the GraphSimulator panel.
// Module-scope pure helpers + StatusIcon kept in-file (upstream shape);
// displaySegment exported for tests.
import json5 from 'json5';
import { P, match } from 'ts-pattern';
import { defineComponent, h } from 'vue';

enum SimulationSegment {
  Output = 'Output',
  Input = 'Input',
  Trace = 'Trace',
}

// upstream: const displaySegment = (data, segment) => ...
// PORTING(test): exported for logic-core coverage.
export const displaySegment = (data: unknown, segment: SimulationSegment) => {
  const jsonData = match([segment, data])
    .with([SimulationSegment.Output, { output: P._ }], ([, { output }]) => output)
    .with([SimulationSegment.Input, { input: P._ }], ([, { input }]) => input)
    .with([SimulationSegment.Trace, { trace: P._ }], ([, { trace }]) => trace)
    .with([SimulationSegment.Trace, { traceData: P._ }], ([, { traceData }]) => traceData)
    .otherwise(() => ({}));

  return json5.stringify(jsonData, undefined, 2);
};

// upstream: const StatusIcon = React.FC<{ status }> — antd two-tone icons →
// lucide circles with token colors.
const StatusIcon = defineComponent({
  name: 'StatusIcon',
  props: { status: { type: String, required: true } },
  setup(props) {
    return () => {
      if (props.status === 'not-run') {
        return null;
      }

      if (props.status === 'success') {
        return h('span', {
          class: 'grl-dg__simulator__status-icon grl-dg__simulator__status-icon--success',
        });
      }

      return h('span', {
        class: 'grl-dg__simulator__status-icon grl-dg__simulator__status-icon--error',
      });
    };
  },
});

export { SimulationSegment };
</script>

<script setup lang="ts">
import clsx from 'clsx';
import { Eraser, X } from 'lucide-vue-next';
import { Splitpane, Splitpanes } from 'splitpanes';
import { type Component, computed, ref } from 'vue';

import { usePersistentState } from '../../../helpers/use-persistent-state';
import Button from '../../ui/Button.vue';
import Tabs from '../../ui/Tabs.vue';
import Tooltip from '../../ui/Tooltip.vue';
import { useDecisionGraphRaw, useDecisionGraphState } from '../context/dg-store.context';
import { NodeKind } from '../nodes/specifications/specification-types';
import type { SimulationTrace } from './simulation.types';
import SimulatorEditor from './simulator-editor.vue';
import SimulatorRequestPanel from './simulator-request-panel.vue';

export type GraphSimulatorProps = {
  loading?: boolean;
  defaultRequest?: string;
  leftPanel?: Component;
};

const props = withDefaults(defineProps<GraphSimulatorProps>(), { loading: false });

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'change', contextJson: string): void;
  (e: 'run', payload: { graph: never; context: unknown }): void;
}>();

const [search, setSearch] = usePersistentState<string>('simulation.search', '');
const [segment, setSegment] = usePersistentState<SimulationSegment>('simulation.segment', SimulationSegment.Output);

const viewConfig = useDecisionGraphState((state) => state.viewConfig);

const { actions } = useDecisionGraphRaw();
const simulatorState = useDecisionGraphState(({ decisionGraph, simulate }) => ({
  simulate,
  hasInputNode: decisionGraph.nodes.some((n) => n.type === NodeKind.Input),
  nodeTypes: (decisionGraph.nodes ?? []).reduce<Record<string, string | undefined>>(
    (acc, curr) => ({
      ...acc,
      [curr.id]: curr.type,
    }),
    {},
  ),
}));

const selectedNode = ref<string>('graph');

const LeftPanel = computed(() => props.leftPanel ?? SimulatorRequestPanel);

const traces = computed<Array<SimulationTrace & { nodeId: string }>>(() => {
  const simulate = simulatorState.value.simulate;
  if (!simulate) {
    return [];
  }

  if (!('result' in simulate)) {
    return [];
  }

  return Object.entries(simulate.result?.trace ?? {})
    .filter(([id]) => (viewConfig.value?.enabled ? !!viewConfig.value?.permissions?.[id] : true))
    .map(([key, data]) => ({ ...data, nodeId: key }))
    .filter((t) => ![NodeKind.Input].includes(simulatorState.value.nodeTypes?.[t.nodeId] as NodeKind))
    .filter((t) => t.name.toLowerCase().includes(search.value?.toLowerCase() ?? ''))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

const simulate = computed(() => simulatorState.value.simulate);

const responseValue = computed(() =>
  match(simulate.value)
    .with({ result: P._ }, ({ result }) =>
      match(selectedNode.value)
        .with('graph', () =>
          displaySegment(
            {
              traceData: result?.trace,
              output: result?.result,
            },
            segment.value ?? SimulationSegment.Output,
          ),
        )
        .otherwise(() => displaySegment(result?.trace[selectedNode.value], segment.value ?? SimulationSegment.Output)),
    )
    .otherwise(() => ''),
);

const graphStatus = computed(() =>
  match(simulate.value)
    .with({ error: P.nonNullable }, () => 'error' as const)
    .with({ result: P.nonNullable }, () => 'success' as const)
    .otherwise(() => 'not-run' as const),
);

const graphPerformance = computed(() =>
  match(simulate.value)
    .with({ result: P._ }, ({ result }) => result?.performance)
    .otherwise(() => undefined),
);

const onClear = () => {
  emit('clear');
  selectedNode.value = 'graph';
  setSearch('');
};
</script>

<template>
  <!-- PORTING: PanelGroup autoSaveId dropped (splitpanes has no equivalent). -->
  <Splitpanes class="grl-dg__simulator">
    <Splitpane :size="30" :min-size="20" class="grl-dg__simulator__section grl-dg__simulator__request">
      <component
        :is="LeftPanel"
        :default-request="props.defaultRequest"
        :loading="props.loading"
        :has-input-node="simulatorState.hasInputNode"
        @run="(payload: unknown) => emit('run', payload as never)"
        @change="(v: string) => emit('change', v)"
      />
    </Splitpane>
    <Splitpane :size="20" :min-size="20" :max-size="20" class="grl-dg__simulator__section grl-dg__simulator__nodes">
      <div class="grl-dg__simulator__section__bar grl-dg__simulator__section__bar--nodes">
        <input v-model="search" class="grl-dg__simulator__search" type="text" placeholder="Search nodes..." />
        <div class="grl-dg__simulator__section__bar__actions">
          <Tooltip content="Clear">
            <Button size="small" type="text" @click="onClear">
              <template #icon><Eraser :size="12" /></template>
            </Button>
          </Tooltip>
        </div>
      </div>
      <div class="grl-dg__simulator__section__content">
        <div class="grl-dg__simulator__loading" :class="{ 'grl-dg__simulator__loading--active': props.loading }">
          <div class="grl-dg__simulator__nodes-list">
            <span
              v-if="!simulate"
              class="grl-typography grl-typography--secondary"
              :style="{ textAlign: 'center', marginTop: '60px', fontSize: '13px', display: 'block' }"
            >
              Ready to simulate!<br />
              Run a request to see the node trace in action.<br />
              <a
                href="https://docs.gorules.io/docs/simulator"
                target="_blank"
                :style="{ fontSize: '13px', marginTop: '4px', display: 'inline-block' }"
              >
                Learn more
              </a>
            </span>
            <div
              v-if="'graph'.includes(search?.toLowerCase() ?? '') && simulate"
              :class="clsx('grl-dg__simulator__nodes-list__node', selectedNode === 'graph' && 'active')"
              @click="selectedNode = 'graph'"
            >
              <span class="grl-typography" data-role="name">
                <StatusIcon :status="graphStatus" />
                Graph
              </span>
              <span class="grl-typography grl-typography--secondary" data-role="performance">
                {{ graphPerformance }}
              </span>
            </div>
            <div
              v-for="trace in traces"
              :key="trace.nodeId"
              :class="clsx('grl-dg__simulator__nodes-list__node', trace.nodeId === selectedNode && 'active')"
              :title="trace.name"
              @click="selectedNode = trace.nodeId"
              @dblclick="() => actions.goToNode(trace.nodeId)"
            >
              <span class="grl-typography grl-typography--ellipsis" data-role="name">
                <StatusIcon :status="trace.nodeId === (simulate as any)?.error?.data?.nodeId ? 'error' : 'success'" />
                {{ trace.name }}
              </span>
              <span class="grl-typography grl-typography--secondary" data-role="performance">
                {{ trace.performance }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Splitpane>
    <Splitpane :size="50" :min-size="30" class="grl-dg__simulator__section grl-dg__simulator__response">
      <div class="grl-dg__simulator__section__bar grl-dg__simulator__section__bar--response">
        <Tabs
          class="grl-inline-tabs"
          size="small"
          :model-value="segment"
          :items="Object.values(SimulationSegment).map((s) => ({ key: s, label: s }))"
          :style="{ width: '100%' }"
          @update:model-value="(tab) => setSegment(tab as SimulationSegment)"
        >
          <template #extra>
            <Tooltip content="Close panel">
              <Button type="text" @click="() => actions.setActivePanel(undefined)">
                <template #icon><X :size="12" /></template>
              </Button>
            </Tooltip>
          </template>
        </Tabs>
      </div>
      <div class="grl-dg__simulator__section__content">
        <SimulatorEditor read-only :value="responseValue" />
      </div>
    </Splitpane>
  </Splitpanes>
</template>

<style lang="scss">
// antd Spin.spinning → overlay stand-in
.grl-dg__simulator__loading {
  position: relative;
  height: 100%;

  &--active::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--grl-color-bg-mask);
    opacity: 0.1;
    pointer-events: all;
  }
}

// StatusIcon (antd two-tone circles → token dots)
.grl-dg__simulator__status-icon {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: text-top;

  &--success {
    background-color: var(--grl-color-success);
    opacity: 0.5;
  }

  &--error {
    background-color: var(--grl-color-error);
  }
}
</style>
