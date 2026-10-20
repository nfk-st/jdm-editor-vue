<script lang="ts">
// Ported from components/decision-table/dt-empty.tsx — renderless controller
// bridging the DecisionTable props to the store.
// PORTING: public `value`/`onChange` → `modelValue`/`update:modelValue`
// (v-model) per docs/PORTING.md; `cellRenderer` stays a function prop —
// dt.tsx (chrome phase) adapts the public #cell slot onto it.
import { Variable, VariableType } from '@gorules/zen-engine-wasm';
import type { VariableType as VariableTypeType } from '@gorules/zen-engine-wasm';
import type { VNode } from 'vue';

import type { SchemaSelectProps } from '../../helpers/components';
import type { GetNodeDataResult } from '../../helpers/node-data';
import type { DictionaryMap } from '../../theme';
// PORTING(sweep): local stand-ins retired — canonical simulator types.
import type { SimulationTrace, SimulationTraceDataTable } from '../decision-graph/simulator/simulation.types';
import type { DecisionTableStoreType, JdmUiMode } from './context/dt-store.context';
import type { DecisionTableType, TableCellProps } from './context/dt-store.context';

export type DecisionTableEmptyType = {
  id?: string;
  name?: string;
  defaultValue?: DecisionTableType;
  modelValue?: DecisionTableType;
  disabled?: boolean;
  disableHitPolicy?: boolean;
  cellRenderer?: (props: TableCellProps) => VNode | null | undefined;
  inputsSchema?: SchemaSelectProps[];
  outputsSchema?: SchemaSelectProps[];
  permission?: DecisionTableStoreType['state']['permission'];
  mode?: JdmUiMode;
  dictionaries?: DictionaryMap;
  inputVariableType?: VariableTypeType;
  debug?: {
    trace: SimulationTrace<SimulationTraceDataTable>;
    inputData?: GetNodeDataResult;
    snapshot: DecisionTableType;
  };
  minColWidth?: number;
  colWidth?: number;
};
</script>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';

import { isWasmAvailable, useWasmReady } from '../../helpers/wasm';
import { useDictionaries } from '../../theme';
import { decisionTableEqual as equal } from './context/dt-store.context';
import {
  parseDecisionTable,
  useDecisionTableActions,
  useDecisionTableRaw,
  useDecisionTableState,
} from './context/dt-store.context';

const props = withDefaults(defineProps<DecisionTableEmptyType>(), {
  disabled: false,
  disableHitPolicy: false,
  permission: 'edit:full',
  mode: 'dev',
});

const emit = defineEmits<{ (e: 'update:modelValue', val: DecisionTableType): void }>();

// upstream: const mountedRef = useRef(false)
let mounted = false;

const { stateStore, listenerStore } = useDecisionTableRaw();
const tableActions = useDecisionTableActions();
const contextDictionaries = useDictionaries();
const decisionTable = useDecisionTableState(({ decisionTable }) => decisionTable);

const resolvedDictionaries = computed(() =>
  props.dictionaries && Object.keys(props.dictionaries).length > 0 ? props.dictionaries : contextDictionaries,
);

// PORTING: use-debounce → @vueuse/core useDebounceFn (PORTING.md dependency map).
const innerChange = useDebounceFn((table: DecisionTableType) => {
  emit('update:modelValue', table);
}, 100);

watch(
  () =>
    [
      props.id,
      props.name,
      props.disabled,
      props.disableHitPolicy,
      props.inputsSchema,
      props.outputsSchema,
      props.colWidth,
      props.minColWidth,
      props.permission,
      props.mode,
      resolvedDictionaries.value,
    ] as const,
  () => {
    stateStore.setState({
      id: props.id,
      name: props.name,
      disabled: props.disabled,
      disableHitPolicy: props.disableHitPolicy,
      inputsSchema: props.inputsSchema,
      outputsSchema: props.outputsSchema,
      colWidth: props.colWidth || 200,
      minColWidth: props.minColWidth || 150,
      permission: props.permission,
      mode: props.mode,
      dictionaries: resolvedDictionaries.value,
    });
  },
  { immediate: true },
);

watch(
  () => props.cellRenderer,
  (cellRenderer) => {
    listenerStore.setState({
      cellRenderer,
      onChange: innerChange,
    });
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  (value) => {
    if (mounted && value !== undefined && !equal(value, decisionTable.value)) {
      tableActions.setDecisionTable(parseDecisionTable(value));
    }
  },
);

onMounted(() => {
  tableActions.setDecisionTable(
    parseDecisionTable(props.modelValue === undefined ? props.defaultValue : props.modelValue),
  );
  mounted = true;
});

onBeforeUnmount(() => {
  const { derivedVariableTypes } = stateStore.getState();

  Object.values(derivedVariableTypes).forEach((vt) => {
    vt.free();
  });
});

watch(
  () => props.debug,
  (debug) => {
    if (!debug) {
      stateStore.setState({ debug: undefined });
      return;
    }

    stateStore.setState({
      debug: {
        trace: debug.trace,
        snapshot: debug.snapshot,
        inputData: debug.inputData,
      },
    });
  },
  { immediate: true },
);

watch(
  () => props.inputVariableType,
  (inputVariableType) => {
    stateStore.setState({ inputVariableType });
  },
  { immediate: true },
);

const isLoop = (store: DecisionTableStoreType['state']) => {
  return store.debug?.snapshot.executionMode === 'loop';
};

const applyDebug = (state: DecisionTableStoreType['state']) => {
  const inputData = state.debug?.inputData;
  if (!inputData) {
    return;
  }

  const varInputData = new Variable(inputData.data);
  if (isLoop(state)) {
    const newInputData = varInputData.get(state.debugIndex).cloneWith('$nodes', inputData.$nodes);
    stateStore.setState({
      calculatedInputData: newInputData,
      inputVariableType: VariableType.fromVariable(newInputData),
    });
  } else {
    const newInputData = varInputData.cloneWith('$nodes', inputData.$nodes);
    stateStore.setState({
      calculatedInputData: newInputData,
      inputVariableType: VariableType.fromVariable(newInputData),
    });
  }
};

const wasmReady = useWasmReady();

// upstream: one effect guarded by isWasmAvailable() + a store subscribe.
// PORTING: wasm readiness is also watched (the wasm module may load after
// mount) — same adaptation as expression.vue's SimulateDataSync.
watch(
  wasmReady,
  (ready) => {
    if (!ready || !isWasmAvailable()) {
      return;
    }

    applyDebug(stateStore.getState());
  },
  { immediate: true },
);

const unsubscribe = stateStore.subscribe((state, prevState) => {
  if (state.debugIndex === prevState.debugIndex && state.debug === prevState.debug) {
    return;
  }
  if (!isWasmAvailable()) {
    return;
  }

  applyDebug(state);
});
onBeforeUnmount(unsubscribe);
</script>
