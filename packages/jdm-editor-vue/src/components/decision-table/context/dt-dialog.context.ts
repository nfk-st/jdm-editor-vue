// Ported from components/decision-table/context/dt-dialog.context.tsx.
// PORTING: React context + useState → provide/inject with a ref; setDialog
// keeps the Dispatch<SetStateAction> shape (value or updater).
import { type InjectionKey, type Ref, inject, provide, ref } from 'vue';

import type { ColumnType, TableSchemaItem } from './dt-store.context';

export type TableDialogType = 'reorder';
export type TableDialogState = {
  type: TableDialogType;
  item: TableSchemaItem | null;
  columnType: ColumnType;
};

export type TableDialogContextState = {
  setDialog: (
    value: TableDialogState | undefined | ((prev: TableDialogState | undefined) => TableDialogState | undefined),
  ) => void;
  dialog: Ref<TableDialogState | undefined>;
  isDialogActive: (type: TableDialogType) => boolean;
  getContainer?: () => HTMLElement;
};

const TableDialogKey: InjectionKey<TableDialogContextState> = Symbol('table-dialog');

export const DecisionTableDialogProvider = (getContainer?: () => HTMLElement): TableDialogContextState => {
  const dialog = ref<TableDialogState | undefined>(undefined);

  const setDialog: TableDialogContextState['setDialog'] = (value) => {
    dialog.value = typeof value === 'function' ? value(dialog.value) : value;
  };

  const state: TableDialogContextState = {
    dialog,
    setDialog,
    isDialogActive: (type: TableDialogType) => {
      return dialog.value?.type === type;
    },
    getContainer,
  };

  provide(TableDialogKey, state);
  return state;
};

// PORTING(P5): upstream `{} as any` default crashes on use; ours returns a
// detached working context — deliberate friendlier mode (same as the stores).
export const useDecisionTableDialog = (): TableDialogContextState =>
  inject(TableDialogKey, () => DecisionTableDialogProvider(), true);
