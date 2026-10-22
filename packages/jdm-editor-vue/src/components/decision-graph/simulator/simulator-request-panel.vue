<script setup lang="ts">
// Ported from simulator/simulator-request-panel.tsx.
// PORTING: antd notification → ui/Toast.
import { VariableType } from '@gorules/zen-engine-wasm';
import json5 from 'json5';
import { Info, Play } from 'lucide-vue-next';
import { ref, watch } from 'vue';

import { isWasmAvailable } from '../../../helpers/wasm';
import Button from '../../ui/Button.vue';
import Tooltip from '../../ui/Tooltip.vue';
import { useToast } from '../../ui/toast';
import { NodeTypeKind, useDecisionGraphRaw } from '../context/dg-store.context';
import type { DecisionGraphType } from '../dg-types';
import SimulatorEditor from './simulator-editor.vue';

const requestTooltip =
  'Your business context that enters through the Request node, starting the decision process. Supply JSON or JSON5 format.';

export type SimulatorRequestPanelProps = {
  defaultRequest?: string;
  hasInputNode?: boolean;
  loading?: boolean;
  // PORTING: upstream's optional callback props. The Run button is rendered
  // only when `onRun` is provided (upstream: `{onRun && …}`), so the
  // availability is carried by the prop itself.
  onRun?: (payload: { graph: DecisionGraphType; context: unknown }) => void;
  onChange?: (contextJson: string) => void;
};

const props = defineProps<SimulatorRequestPanelProps>();

const requestValue = ref(props.defaultRequest);
const toast = useToast();
const { stateStore, actions } = useDecisionGraphRaw();

watch(
  requestValue,
  (value) => {
    if (!isWasmAvailable()) {
      return;
    }

    const { decisionGraph } = stateStore.getState();
    const requestNode = decisionGraph.nodes.find((n) => n.type === 'inputNode');
    if (!requestNode) {
      return;
    }

    try {
      const parsed = value ? json5.parse(value) : 'Any';
      actions.setNodeType(requestNode.id, NodeTypeKind.InferredOutput, new VariableType(parsed));
    } catch {
      // Skip
    }
  },
  { immediate: true },
);

const onRun = () => {
  try {
    const parsed = (requestValue.value || '').trim().length === 0 ? null : json5.parse(requestValue.value || '');
    props.onRun?.({ graph: stateStore.getState().decisionGraph, context: parsed });
  } catch {
    toast.notificationError({
      message: 'Invalid format',
      description: 'Unable to format request, invalid JSON format',
    });
  }
};
</script>

<template>
  <div class="grl-dg__simulator__section__bar grl-dg__simulator__section__bar--request">
    <Tooltip :content="requestTooltip">
      <span class="grl-typography" :style="{ fontSize: '13px', cursor: 'help' }">
        Request
        <Info :size="10" :style="{ marginLeft: '4px', opacity: 0.5, verticalAlign: 'text-top' }" />
      </span>
    </Tooltip>
    <div class="grl-dg__simulator__section__bar__actions">
      <Tooltip
        v-if="props.onRun"
        :content="
          !hasInputNode
            ? 'Request node is required to run the graph. Drag-and-drop it from the Components panel.'
            : undefined
        "
      >
        <Button size="small" type="primary" :loading="loading" :disabled="!hasInputNode" @click="onRun">
          <template #icon><Play :size="12" /></template>
          Run
        </Button>
      </Tooltip>
    </div>
  </div>
  <div class="grl-dg__simulator__section__content">
    <SimulatorEditor
      :model-value="requestValue"
      @update:model-value="
        (text) => {
          requestValue = text;
          props.onChange?.(text ?? '');
        }
      "
    />
  </div>
</template>
