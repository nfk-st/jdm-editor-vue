<script lang="ts">
// Ported from components/expression/expression.tsx — the public Expression.
import { Variable, VariableType, type VariableType as VariableTypeType } from '@gorules/zen-engine-wasm';
import { type PropType, computed, defineComponent, watch } from 'vue';

import { isWasmAvailable, useWasmReady } from '../../helpers/wasm';
import type { ExpressionStore } from './context/expression-store';
import { useExpressionStoreRaw } from './context/expression-store';
import type { ExpressionControllerProps } from './expression-controller.vue';

export type ExpressionProps = {
  inputVariableType?: VariableTypeType;
  debug?: ExpressionStore['debug'];
  hideCommandBar?: boolean;
} & ExpressionControllerProps;

// upstream: const SimulateDataSync = React.FC<Pick<ExpressionProps, 'debug' | 'inputVariableType'>>
const SimulateDataSync = defineComponent({
  name: 'SimulateDataSync',
  props: {
    debug: { type: Object as PropType<ExpressionProps['debug']>, default: undefined },
    inputVariableType: { type: Object as PropType<ExpressionProps['inputVariableType']>, default: undefined },
  },
  setup(props) {
    const expressionStoreRaw = useExpressionStoreRaw();
    const wasmReady = useWasmReady();

    watch(
      () => props.inputVariableType,
      (inputVariableType) => {
        expressionStoreRaw.setState({ inputVariableType });
      },
      { immediate: true },
    );

    watch(
      () => props.debug,
      (debug) => {
        const currentState = expressionStoreRaw.getState();
        if (currentState.debug === debug) {
          return;
        }

        expressionStoreRaw.setState({ debug });
      },
      { immediate: true },
    );

    const isLoop = (store: ExpressionStore) => store.debug?.snapshot.executionMode === 'loop';

    const applyDebug = (state: ExpressionStore) => {
      const inputData = state.debug?.inputData;
      if (!inputData) {
        return;
      }

      const varInputData = new Variable(inputData.data);
      let newInputData;
      if (isLoop(state)) {
        newInputData = varInputData.get(state.debugIndex).cloneWith('$nodes', inputData.$nodes);
        if (inputData.$) {
          newInputData = newInputData.cloneWith('$', inputData.$);
        }
      } else {
        newInputData = varInputData.cloneWith('$nodes', inputData.$nodes);
        if (inputData.$) {
          newInputData = newInputData.cloneWith('$', inputData.$);
        }
      }

      expressionStoreRaw.setState({
        calculatedInputData: newInputData,
        inputVariableType: VariableType.fromVariable(newInputData),
      });
    };

    // upstream checks isWasmAvailable() once in the effect; our wasm module
    // may load later, so watch readiness too.
    watch(
      wasmReady,
      (ready) => {
        if (!ready || !isWasmAvailable()) {
          return;
        }

        applyDebug(expressionStoreRaw.getState());
      },
      { immediate: true },
    );

    // upstream: store.subscribe((state, prevState) => ...) re-applies when
    // debugIndex/debug change.
    expressionStoreRaw.subscribe((state, prevState) => {
      if (state.debugIndex === prevState.debugIndex && state.debug === prevState.debug) {
        return;
      }
      if (!isWasmAvailable()) {
        return;
      }
      applyDebug(state);
    });

    return () => null;
  },
});
</script>

<script setup lang="ts">
// PORTING(DnD): upstream wraps everything in react-dnd's DndProvider (its only
// purpose was row reordering, now vue-draggable-plus in expression-list) and
// mounts children only after the container ref exists (client-only stance).
import { provideExpressionStore } from './context/expression-store';
import ExpressionCommandBar from './expression-command-bar.vue';
import ExpressionController from './expression-controller.vue';
import ExpressionList from './expression-list.vue';
import './expression.scss';

const props = withDefaults(
  defineProps<
    {
      inputVariableType?: ExpressionProps['inputVariableType'];
      debug?: ExpressionProps['debug'];
      hideCommandBar?: boolean;
    } & ExpressionControllerProps
  >(),
  { hideCommandBar: false },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: ExpressionControllerProps['modelValue']): void }>();

provideExpressionStore();
</script>

<template>
  <div>
    <ExpressionController
      :model-value="props.modelValue"
      :default-value="props.defaultValue"
      :disabled="props.disabled"
      :permission="props.permission"
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
    <ExpressionCommandBar v-if="!hideCommandBar" />
    <ExpressionList />
    <SimulateDataSync :debug="props.debug" :input-variable-type="props.inputVariableType" />
  </div>
</template>
