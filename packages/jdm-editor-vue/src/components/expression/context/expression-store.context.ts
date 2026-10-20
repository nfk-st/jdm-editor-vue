// Ported from components/expression/context/expression-store.context.tsx.
// PORTING: zustand `create()` → MiniStore (helpers/mini-store.ts — the
// machinery extracted from this file after review round 3); upstream action
// bodies stay literal (immer produce flows through setState).
import type { Variable, VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import { type ComputedRef, type InjectionKey, computed, inject, provide } from 'vue';
import type { z } from 'zod';

import { type MiniStore, createMiniStore } from '../../../helpers/mini-store';
import type { GetNodeDataResult } from '../../../helpers/node-data';
import type { expressionNodeSchema } from '../../../helpers/schema';
// PORTING(sweep): stand-ins retired — canonical decision-graph types.
import type { DiffMetadata } from '../../decision-graph/dg-types';
import type { SimulationTrace, SimulationTraceDataExpression } from '../../decision-graph/simulator/simulation.types';

type ExpressionSnapshot = z.infer<typeof expressionNodeSchema>['content'];

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

export type ExpressionStoreInternal = MiniStore<ExpressionStore>;

const ExpressionStoreKey: InjectionKey<ExpressionStoreInternal> = Symbol('expression-store');

export const createExpression = (data: Partial<ExpressionEntry> = {}): ExpressionEntry => ({
  id: crypto.randomUUID(),
  key: '',
  value: '',
  ...data,
});

export const createExpressionStore = (): ExpressionStoreInternal => {
  const store = createMiniStore<ExpressionStore>(() => ({
    disabled: false,
    debugIndex: 0,
    expressions: [] as ExpressionEntry[],
    addRowAbove: (index = 0, data?: Partial<ExpressionEntry>) => {
      // PORTING(P3): upstream's body ignores its own `data` param
      // (createExpression() with no args); we honor it — typed superset,
      // kept because dt-store/dg-store follow this file as template.
      store.setState(
        produce<ExpressionStore>((draft) => {
          draft.expressions.splice(index, 0, createExpression(data));
          return draft;
        }),
      );
    },
    addRowBelow: (index?: number, data?: Partial<ExpressionEntry>) => {
      // PORTING(P3): as above — upstream ignores `data`; we honor it.
      store.setState(
        produce<ExpressionStore>((draft) => {
          index = index ?? draft.expressions.length - 1;
          draft.expressions.splice(index + 1, 0, createExpression(data));
          return draft;
        }),
      );
    },
    setExpressions: (expressions: ExpressionEntry[]) => {
      store.setState({ expressions });
    },
    swapRows: (sourceIndex: number, targetIndex: number) => {
      store.setState(
        produce<ExpressionStore>((draft) => {
          const [input] = draft.expressions.splice(sourceIndex, 1);
          draft.expressions.splice(targetIndex, 0, input);
          return draft;
        }),
      );
    },
    removeRow: (index: number) => {
      store.setState(
        produce<ExpressionStore>((draft) => {
          draft.expressions.splice(index, 1);
          return draft;
        }),
      );
    },
    updateRow: (index: number, update: Partial<Omit<ExpressionEntry, 'id'>>) => {
      store.setState(
        produce<ExpressionStore>((draft) => {
          draft.expressions[index] = {
            ...draft.expressions[index],
            ...update,
          };
          return draft;
        }),
      );
    },
  }));

  return store;
};

export const provideExpressionStore = (): ExpressionStoreInternal => {
  const store = createExpressionStore();
  provide(ExpressionStoreKey, store);
  return store;
};

// PORTING(P5): upstream defaults the context to `{} as any` — every selector
// call crashes without a provider. We create a real detached store instead:
// a silent no-op rather than a crash. Deliberate, friendlier failure mode.
export const useExpressionStoreRaw = (): ExpressionStoreInternal =>
  inject(ExpressionStoreKey, () => createExpressionStore(), true);

// PORTING: upstream's useExpressionStore(selector) re-renders on slice change;
// here it returns a ComputedRef of the selected slice. Upstream's optional
// `equals` param is dropped (Vue reactivity tracks structurally).
export const useExpressionStore = <T>(selector: (state: ExpressionStore) => T): ComputedRef<T> =>
  computed(() => selector(useExpressionStoreRaw()));

export { equal as expressionEqual };
