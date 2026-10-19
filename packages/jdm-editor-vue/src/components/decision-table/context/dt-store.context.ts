// Ported from components/decision-table/context/dt-store.context.tsx.
// PORTING: zustand ×2 (state + listeners) + plain actions → two MiniStores +
// plain actions on the pattern certified in expression-store.context.ts
// (helpers/mini-store.ts is the extracted machinery).
import type { Variable, VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import { P, match } from 'ts-pattern';
import { type ComputedRef, type InjectionKey, type VNode, computed, inject, provide, toRaw } from 'vue';

import type { SchemaSelectProps } from '../../../helpers/components';
import { type MiniStore, createMiniStore } from '../../../helpers/mini-store';
import { type GetNodeDataResult } from '../../../helpers/node-data';
import type { ColumnFieldType, OutputFieldType } from '../../../helpers/schema';
import type { DictionaryMap } from '../../../theme';

// PORTING: stand-ins for decision-graph types — swap when decision-graph lands.
// Shape mirrors upstream's DiffMetadata (dg-types.ts): previousValue/indexes
// are read by the table cells' diff display.
type DiffMetadata = {
  status?: 'added' | 'removed' | 'modified' | 'unchanged' | 'moved';
  previousValue?: any;
  previousIndex?: number;
  currentIndex?: number;
  fields?: Record<string, { status: string; previousValue: string }>;
};
type Diff = { _diff?: DiffMetadata };
type SimulationTraceDataTable = {
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  matched?: boolean;
};
type SimulationTrace<T> = { traceData: T };

// PORTING: TableCellProps's upstream home is ../table/table-default-cell;
// it lives here (and is re-exported from table-default-cell.vue) until
// decision-graph lands — upgraded to upstream's exact shape when the table
// module ported (the context listeners + dt-empty's cellRenderer share it).
export type TableCellProps = {
  column?: { colType: string } & TableSchemaItem;
  value: string;
  diff?: DiffMetadata;
  onChange: (value: string) => void;
  disabled?: boolean;
  index: number;
};

export type TableExportOptions = {
  name: string;
};

export type TableCursor = {
  x: string;
  y: number;
};

export type { ColumnFieldType, OutputFieldType };

export type TableSchemaItem = {
  id: string;
  name: string;
  field?: string;
  defaultValue?: string;
  fieldType?: ColumnFieldType;
  outputFieldType?: OutputFieldType;
  _diff?: DiffMetadata;
};

export type HitPolicy = 'first' | 'collect';
export type ColumnType = 'inputs' | 'outputs';

export type DecisionTableType = {
  hitPolicy: HitPolicy | string;
  passThrough?: boolean;
  inputField?: string;
  outputPath?: string;
  executionMode?: 'single' | 'loop';
  inputs: TableSchemaItem[];
  outputs: TableSchemaItem[];
  rules: Record<string, string>[];
} & Diff;

const outputTypeDefault = (schemaItem: TableSchemaItem): string => {
  const type = schemaItem.outputFieldType?.type;
  if (!type) return '';
  return match(type)
    .with('string', () => '""')
    .with('string-array', () => '[]')
    .with('boolean', () => 'false')
    .with('number', () => '0')
    .with('date', () => `d('${new Date().toISOString().slice(0, 10)}')`)
    .otherwise(() => '');
};

const cleanupTableRule = (
  decisionTable: DecisionTableType,
  rule: Record<string, string>,
  defaultId?: string,
): Record<string, string> => {
  const outputIds = new Set(decisionTable.outputs.map((o) => o.id));
  const schemaItems = [...decisionTable.inputs, ...decisionTable.outputs];
  const newRule: Record<string, string> = {
    _id: rule._id || crypto.randomUUID(),
    _description: rule._description,
  };
  schemaItems.forEach((schemaItem) => {
    if (defaultId && newRule._id === defaultId) {
      const fallback = outputIds.has(schemaItem.id) ? outputTypeDefault(schemaItem) : '';
      return (newRule[schemaItem.id] = rule?.[schemaItem.id] || schemaItem?.defaultValue || fallback);
    }
    newRule[schemaItem.id] = rule?.[schemaItem.id] || '';
  });
  return newRule;
};

const cleanupTableRules = (decisionTable: DecisionTableType, defaultId?: string): Record<string, string>[] => {
  const rules = decisionTable?.rules || [];
  return rules.map((rule) => cleanupTableRule(decisionTable, rule, defaultId));
};

export const parseDecisionTable = (decisionTable?: DecisionTableType) => {
  const dt: DecisionTableType = {
    hitPolicy: decisionTable?.hitPolicy || 'first',
    inputs: decisionTable?.inputs || [],
    outputs: decisionTable?.outputs || [],
    rules: decisionTable?.rules || [],
    passThrough: decisionTable?.passThrough ?? false,
    inputField: decisionTable?.inputField,
    outputPath: decisionTable?.outputPath,
    executionMode: decisionTable?.executionMode ?? 'single',
  };

  if (decisionTable?._diff) {
    dt._diff = decisionTable._diff;
  }

  if (dt.inputs?.length === 0) {
    dt.inputs = [
      {
        id: crypto.randomUUID(),
        name: 'Input',
      },
    ];
  }

  if (dt.outputs?.length === 0) {
    dt.outputs = [
      {
        id: crypto.randomUUID(),
        field: 'output',
        name: 'Output',
      },
    ];
  }

  dt.rules = dt.rules.map((r) =>
    match(r)
      .with({ _id: P.string.minLength(1) }, () => r)
      .otherwise((r) => ({ ...r, _id: crypto.randomUUID() })),
  );

  return dt;
};

export type DecisionTablePermission = 'edit:full' | 'edit:rules' | 'edit:values';
export type JdmUiMode = 'dev' | 'business';
/** @deprecated Use JdmUiMode instead */
export type DecisionTableMode = JdmUiMode;

export type DecisionTableStoreType = {
  state: {
    id?: string;
    name?: string;
    decisionTable: DecisionTableType;
    cursor: TableCursor | null;

    disabled: boolean;
    disableHitPolicy: boolean;

    minColWidth: number;
    colWidth: number;

    permission?: DecisionTablePermission;
    mode: JdmUiMode;
    dictionaries?: DictionaryMap;

    inputVariableType?: VariableType;
    derivedVariableTypes: Record<string, VariableType>;

    inputsSchema?: SchemaSelectProps[];
    outputsSchema?: SchemaSelectProps[];

    debugIndex: number;
    calculatedInputData?: Variable;

    debug?: {
      snapshot: DecisionTableType;
      trace: SimulationTrace<SimulationTraceDataTable>;
      inputData?: GetNodeDataResult;
    };
  };

  actions: {
    setDecisionTable: (val: DecisionTableType) => void;
    setCursor: (cursor: TableCursor | null) => void;
    commitData: (data: string, cursor: TableCursor) => void;
    swapRows: (source: number, target: number) => void;
    addRowAbove: (target?: number) => void;
    addRowBelow: (target?: number) => void;
    removeRow: (target?: number) => void;
    addColumn: (type: ColumnType, column: TableSchemaItem) => void;
    updateColumn: (type: ColumnType, id: string, column: TableSchemaItem) => void;
    removeColumn: (type: ColumnType, id: string) => void;
    reorderColumns: (type: ColumnType, columns: TableSchemaItem[]) => void;
    updateHitPolicy: (hitPolicy: HitPolicy) => void;
  };

  listeners: {
    onChange?: (val: DecisionTableType) => void;
    // PORTING: upstream types this React.ReactNode; Vue VNode slot equivalent.
    cellRenderer?: (props: TableCellProps) => VNode | null | undefined;
    onColumnResize?: () => void;
  };
};

export type DecisionTableStoreBundle = {
  stateStore: MiniStore<DecisionTableStoreType['state']>;
  listenerStore: MiniStore<DecisionTableStoreType['listeners']>;
  actions: DecisionTableStoreType['actions'];
};

// PORTING(P5): upstream defaults to `{} as any` (crashes on use without a
// provider); we create a detached real bundle — deliberate friendlier mode.
const DecisionTableStoreKey: InjectionKey<DecisionTableStoreBundle> = Symbol('decision-table-store');

export type DecisionTableContextProps = {
  //
};

export const createDecisionTableStoreBundle = (): DecisionTableStoreBundle => {
  const stateStore = createMiniStore<DecisionTableStoreType['state']>(() => ({
    id: undefined,
    name: undefined,
    decisionTable: parseDecisionTable(),
    cursor: null,

    disabled: false,
    disableHitPolicy: false,

    colWidth: 200,
    minColWidth: 150,

    inputsSchema: undefined,
    outputsSchema: undefined,

    mode: 'dev',
    derivedVariableTypes: {},
    inputVariableType: undefined,
    debugIndex: 0,
    debug: undefined,
  }));

  const listenerStore = createMiniStore<DecisionTableStoreType['listeners']>(() => ({
    onChange: undefined,
    cellRenderer: undefined,
  }));

  // PORTING(fix): immer's auto-freeze walks the produced tree; when the base
  // is a Vue-reactive proxy, freeze() violates the proxy invariant on frozen
  // array targets (any recipe that iterates a nested array — e.g.
  // cleanupTableRules reading inputs/outputs — triggers it). Produce over the
  // raw tree instead: reactive() re-wraps on read, so consumers are
  // unaffected. (The certified expression store never iterates unmodified
  // arrays in its recipes, which is why it never tripped this.)
  const getRawDecisionTable = () => toRaw(stateStore.getState().decisionTable);

  const actions: DecisionTableStoreType['actions'] = {
    setDecisionTable: (decisionTable) => stateStore.setState({ decisionTable }),
    setCursor: (cursor: TableCursor | null) => stateStore.setState({ cursor }),
    commitData: (value: string, cursor: TableCursor) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        const { x, y } = cursor;
        draft.rules[y][x] = value;
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    swapRows: (source: number, target: number) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        const input = draft?.rules?.[source];
        draft.rules.splice(source, 1);
        draft.rules.splice(target, 0, input);
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable, cursor: null });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    addRowAbove: (target?: number) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        if (target === undefined) {
          target = 0;
        }

        const _id = crypto.randomUUID();
        draft.rules.splice(target, 0, cleanupTableRule(draft, { _id }, _id));

        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);

      const { cursor } = stateStore.getState();
      if (cursor && cursor?.y === target) {
        stateStore.setState({ cursor: { x: cursor.x, y: cursor.y + 1 } });
      }
    },
    addRowBelow: (target?: number) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        if (target === undefined) {
          target = draft?.rules?.length;
        } else {
          target += 1;
        }

        const _id = crypto.randomUUID();
        draft.rules.splice(target, 0, cleanupTableRule(draft, { _id }, _id));
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);

      const { cursor } = stateStore.getState();
      if (cursor && cursor?.y === target) {
        stateStore.setState({ cursor: { x: cursor.x, y: cursor.y - 1 } });
      }
    },
    removeRow: (target?: number) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        if (target === undefined) {
          target = draft?.rules?.length || 0;
        }

        draft.rules.splice(target, 1);
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    addColumn: (type: ColumnType, column: TableSchemaItem) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        draft[type].push(column);
        draft.rules = cleanupTableRules(draft);
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    updateColumn: (type: ColumnType, id: string, data: TableSchemaItem) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        draft[type] = draft[type].map((item) => {
          if (item.id === id) {
            return {
              ...item,
              name: data?.name,
              field: data?.field,
              defaultValue: data?.defaultValue,
              fieldType: data?.fieldType,
              outputFieldType: data?.outputFieldType,
            };
          }
          return item;
        });

        draft.rules = cleanupTableRules(draft);
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    removeColumn: (type: ColumnType, id: string) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = parseDecisionTable(
        produce(decisionTable, (draft) => {
          draft[type] = (draft?.[type] || []).filter((item) => item?.id !== id);
          draft.rules = cleanupTableRules(draft);
          return draft;
        }),
      );

      stateStore.setState({ decisionTable: updatedDecisionTable, cursor: null });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    reorderColumns: (type: ColumnType, columns: TableSchemaItem[]) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        draft[type] = columns;
        draft.rules = cleanupTableRules(draft);
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
    updateHitPolicy: (hitPolicy: HitPolicy) => {
      const decisionTable = getRawDecisionTable();

      const updatedDecisionTable = produce(decisionTable, (draft) => {
        draft.hitPolicy = hitPolicy;
        return draft;
      });

      stateStore.setState({ decisionTable: updatedDecisionTable });
      listenerStore.getState().onChange?.(updatedDecisionTable);
    },
  };

  return { stateStore, listenerStore, actions };
};

export const DecisionTableProvider = (): DecisionTableStoreBundle => {
  const bundle = createDecisionTableStoreBundle();
  provide(DecisionTableStoreKey, bundle);
  return bundle;
};

// PORTING: upstream hooks return slices; ours return ComputedRefs.
// PORTING(fix): the raw bundle is injected ONCE here (call sites are always
// component setup) instead of inside the computed getter — Vue 3.5's
// inject() returns undefined (even with a fallback) when a computed is
// re-evaluated outside setup/render, e.g. from vue-virtual's scheduler-queued
// option watch or a Sortable event callback. Selecting from the captured
// store keeps those lazy re-evaluations working.
export const useDecisionTableRaw = (): DecisionTableStoreBundle =>
  inject(DecisionTableStoreKey, createDecisionTableStoreBundle, true);

export const useDecisionTableState = <T>(selector: (state: DecisionTableStoreType['state']) => T): ComputedRef<T> => {
  const { stateStore } = useDecisionTableRaw();
  return computed(() => selector(stateStore));
};

export const useDecisionTableListeners = <T>(
  selector: (state: DecisionTableStoreType['listeners']) => T,
): ComputedRef<T> => {
  const { listenerStore } = useDecisionTableRaw();
  return computed(() => selector(listenerStore));
};

export const useDecisionTableActions = (): DecisionTableStoreType['actions'] => useDecisionTableRaw().actions;

export { equal as decisionTableEqual };
