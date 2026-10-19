// Ported from components/expression/context/expression-store.context.tsx.
// PORTING: zustand `create()` → reactive store + provide/inject; `set(produce(...))`
// → `set()` helper applying immer results back onto the reactive object, so
// upstream action bodies stay literal. A small subscribe(prevState) mechanism
// replaces zustand's store.subscribe for the controller's onChange bridge.
import type { Variable, VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import { type ComputedRef, type InjectionKey, computed, inject, provide, reactive } from 'vue';

import type { GetNodeDataResult } from '../../../helpers/node-data';

// PORTING: stand-ins for decision-graph types — swap when decision-graph lands.
type DiffMetadata = {
  status?: 'added' | 'removed' | 'modified' | 'unchanged' | 'moved';
  fields?: Record<string, { status: string; previousValue: string }>;
};
type SimulationTraceDataExpression = Record<string, unknown>;
type SimulationTrace<T> = { traceData: T };
type ExpressionSnapshot = { executionMode?: string; expressions?: { id: string; key?: string; value: string }[] };

export type ExpressionEntry = {
  id: string;
  key: string;
  value: string;
  _diff?: DiffMetadata;
};

export type ExpressionPermission = 'edit:full' | 'edit:values' | 'view';

export type ExpressionStore = {
  disabled: boolean;

  permission?: ExpressionPermission;

  addRowAbove: (index?: number, data?: Partial<ExpressionEntry>) => void;
  addRowBelow: (index?: number, data?: Partial<ExpressionEntry>) => void;

  expressions: ExpressionEntry[];
  setExpressions: (expressions: ExpressionEntry[]) => void;

  swapRows: (sourceIndex: number, targetIndex: number) => void;
  updateRow: (index: number, update: Partial<Omit<ExpressionEntry, 'id'>>) => void;
  removeRow: (index: number) => void;

  inputVariableType?: VariableType;

  debugIndex: number;
  calculatedInputData?: Variable;
  debug?: {
    snapshot: ExpressionSnapshot;
    trace: SimulationTrace<SimulationTraceDataExpression>;
    inputData?: GetNodeDataResult;
  };
};

// zustand-shaped extras the raw store carries (setState/getState/subscribe).
export type ExpressionStoreInternal = ExpressionStore & {
  setState: (partial: Partial<ExpressionStore>) => void;
  getState: () => ExpressionStore;
  subscribe: (listener: (state: ExpressionStore, prevState: ExpressionStore) => void) => () => void;
};

const ExpressionStoreKey: InjectionKey<ExpressionStoreInternal> = Symbol('expression-store');

type Listener = (state: ExpressionStore, prevState: ExpressionStore) => void;
type SetArg = Partial<ExpressionStore> | ((state: ExpressionStore) => Partial<ExpressionStore> | ExpressionStore);

export const createExpression = (data: Partial<ExpressionEntry> = {}): ExpressionEntry => ({
  id: crypto.randomUUID(),
  key: '',
  value: '',
  ...data,
});

export const createExpressionStore = (): ExpressionStoreInternal => {
  const listeners = new Set<Listener>();
  const store = reactive({}) as ExpressionStoreInternal;

  // zustand's set(): accepts a partial object or an updater (immer's curried
  // produce is an updater); shallow prev snapshot preserves array refs for the
  // subscribe listeners' equality checks.
  const set = (partialOrUpdater: SetArg) => {
    const prev: ExpressionStore = { ...store };
    const partial = typeof partialOrUpdater === 'function' ? partialOrUpdater(store) : partialOrUpdater;
    Object.assign(store, partial);
    listeners.forEach((listener) => listener(store, prev));
  };

  Object.assign(store, {
    disabled: false,
    debugIndex: 0,
    addRowAbove: (index = 0, data?: Partial<ExpressionEntry>) => {
      set(
        produce<ExpressionStore>((draft) => {
          draft.expressions.splice(index, 0, createExpression(data));
          return draft;
        }),
      );
    },
    addRowBelow: (index?: number, data?: Partial<ExpressionEntry>) => {
      set(
        produce<ExpressionStore>((draft) => {
          index = index ?? draft.expressions.length - 1;
          draft.expressions.splice(index + 1, 0, createExpression(data));
          return draft;
        }),
      );
    },
    expressions: [] as ExpressionEntry[],
    setExpressions: (expressions: ExpressionEntry[]) => {
      set({ expressions });
    },
    swapRows: (sourceIndex: number, targetIndex: number) => {
      set(
        produce<ExpressionStore>((draft) => {
          const [input] = draft.expressions.splice(sourceIndex, 1);
          draft.expressions.splice(targetIndex, 0, input);
          return draft;
        }),
      );
    },
    removeRow: (index: number) => {
      set(
        produce<ExpressionStore>((draft) => {
          draft.expressions.splice(index, 1);
          return draft;
        }),
      );
    },
    updateRow: (index: number, update: Partial<Omit<ExpressionEntry, 'id'>>) => {
      set(
        produce<ExpressionStore>((draft) => {
          draft.expressions[index] = {
            ...draft.expressions[index],
            ...update,
          };
          return draft;
        }),
      );
    },
    setState: (partial: Partial<ExpressionStore>) => set(partial),
    getState: (): ExpressionStore => store,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  return store;
};

export const provideExpressionStore = (): ExpressionStoreInternal => {
  const store = createExpressionStore();
  provide(ExpressionStoreKey, store);
  return store;
};

export const useExpressionStoreRaw = (): ExpressionStoreInternal =>
  inject(ExpressionStoreKey, () => createExpressionStore(), true);

// PORTING: upstream's useExpressionStore(selector) re-renders on slice change;
// here it returns a ComputedRef of the selected slice.
export const useExpressionStore = <T>(selector: (state: ExpressionStore) => T): ComputedRef<T> =>
  computed(() => selector(useExpressionStoreRaw()));

export { equal as expressionEqual };
