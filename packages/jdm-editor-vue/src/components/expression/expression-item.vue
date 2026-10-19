<script lang="ts">
// Ported from components/expression/expression-item.tsx.
// Module-scope subcomponents (upstream keeps ResultOverlay + LivePreview
// in-file) live here as render-function components.
import { GripVertical } from 'lucide-vue-next';
import { type PropType, computed, defineComponent, h } from 'vue';

import { getTrace } from '../../helpers/trace';
import CodeEditorPreview from '../code-editor/ce-preview.vue';
import ConfirmAction from '../confirm-action.vue';
import DiffIcon from '../diff-icon.vue';
import DiffCodeEditor from '../shared/diff-ce.vue';
import DiffAutosizeTextArea from '../shared/diff-text-area.vue';
import type { ExpressionEntry } from './context/expression-store';
import { useExpressionStoreRaw } from './context/expression-store';
import ExpressionItemContextMenu from './expression-item-context-menu.vue';

export type ExpressionItemProps = {
  expression: ExpressionEntry;
  index: number;
  variableType?: unknown;
  dropDirection?: 'up' | 'down' | null;
};

// upstream: const ResultOverlay = React.FC<{ expression: ExpressionEntry }>
const ResultOverlay = defineComponent({
  name: 'ResultOverlay',
  props: { expression: { type: Object as PropType<ExpressionEntry>, required: true } },
  setup(props) {
    const store = useExpressionStoreRaw();
    // PORTING: any-cast — traceData's element typing arrives with decision-graph.
    const trace = computed(
      () => (getTrace(store.debug?.trace?.traceData as any, store.debugIndex) as any)?.[props.expression.key]?.result,
    );
    return () =>
      trace.value === undefined
        ? null
        : h('div', { class: 'expression-list-item__resultOverlay' }, [
            h(
              'span',
              {
                class: 'grl-typography grl-typography--ellipsis',
                title: JSON.stringify(trace.value),
                style: { maxWidth: '60px', overflow: 'hidden' },
              },
              `= ${JSON.stringify(trace.value)}`,
            ),
          ]);
  },
});

// upstream: const LivePreview = React.memo<{ id: string; value: string }>
const LivePreview = defineComponent({
  name: 'LivePreview',
  props: {
    id: { type: String, required: true },
    value: { type: String, required: true },
  },
  setup(props) {
    const store = useExpressionStoreRaw();
    const inputData = computed(() => store.calculatedInputData);
    const initial = computed(() => {
      const snapshot = (store.debug?.snapshot?.expressions ?? []).find((e) => e.id === props.id);
      const trace = snapshot?.key
        ? (getTrace(store.debug?.trace?.traceData as any, store.debugIndex) as any)?.[snapshot.key]
        : undefined;

      return snapshot && trace ? { expression: snapshot.value, result: trace.result } : undefined;
    });

    return () =>
      h('div', { class: 'expression-list-item__livePreview' }, [
        h(CodeEditorPreview, { expression: props.value, inputData: inputData.value, initial: initial.value }),
      ]);
  },
});
</script>

<script setup lang="ts">
// PORTING(DnD): upstream's per-row useDrag/useDrop (react-dnd) is replaced by
// list-level vue-draggable-plus (SortableJS) in expression-list.vue: swaps
// land through the bound list → setExpressions, so swapRows is no longer
// called here. Drag/drop VISUAL states arrive via Sortable classes.
import { ref } from 'vue';

const props = defineProps<ExpressionItemProps>();

const emit = defineEmits<{ (e: 'focusChange', focused: boolean): void }>();

const store = useExpressionStoreRaw();
const { updateRow, removeRow } = store;

const isFocused = ref(false);

const onChange = (update: Partial<Omit<ExpressionEntry, 'id'>>) => {
  updateRow(props.index, update);
};

const onRemove = () => {
  removeRow(props.index);
};

const setFocused = (focused: boolean) => {
  isFocused.value = focused;
  emit('focusChange', focused);
};
</script>

<template>
  <div
    class="expression-list-item expression-list__item"
    :class="[
      dropDirection === 'down' && 'dropping-down',
      dropDirection === 'up' && 'dropping-up',
      expression?._diff?.status && `expression-list__item--${expression?._diff?.status}`,
    ]"
  >
    <div class="expression-list-item__drag" :aria-disabled="store.permission !== 'edit:full' || store.disabled">
      <div class="expression-list-item__drag__inner">
        <DiffIcon v-if="expression?._diff?.status" :status="expression?._diff?.status" :style="{ fontSize: '16px' }" />
        <GripVertical v-else :size="10" />
      </div>
    </div>
    <div class="expression-list-item__key">
      <ExpressionItemContextMenu :index="index">
        <!-- PORTING: upstream's onChange received a synthetic event and read
             e.target.value; our AutosizeTextArea emits the string directly. -->
        <DiffAutosizeTextArea
          no-style
          placeholder="Key"
          :max-rows="10"
          :read-only="store.permission !== 'edit:full' || store.disabled"
          :display-diff="expression?._diff?.fields?.key?.status === 'modified'"
          :previous-value="expression?._diff?.fields?.key?.previousValue"
          :model-value="expression?.key"
          @update:model-value="(v) => onChange({ key: v })"
        />
      </ExpressionItemContextMenu>
    </div>
    <div class="expression-list-item__code">
      <ExpressionItemContextMenu :index="index">
        <div>
          <DiffCodeEditor
            class="expression-list-item__value"
            placeholder="Expression"
            :max-rows="9"
            :disabled="store.disabled"
            :model-value="expression?.value"
            :display-diff="expression?._diff?.fields?.value?.status === 'modified'"
            :previous-value="expression?._diff?.fields?.value?.previousValue"
            :variable-type="variableType"
            @update:model-value="(value) => onChange({ value })"
            @focus="() => setFocused(true)"
            @blur="() => setFocused(false)"
            no-style
          />
          <ResultOverlay :expression="expression" />
        </div>
      </ExpressionItemContextMenu>
    </div>
    <div class="expression-list-item__action">
      <ConfirmAction icon-only :disabled="store.permission !== 'edit:full' || store.disabled" @confirm="onRemove" />
      <LivePreview v-if="isFocused" :id="expression.id" :value="expression.value" />
    </div>
  </div>
</template>
