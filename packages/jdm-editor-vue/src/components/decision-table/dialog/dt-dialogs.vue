<script setup lang="ts">
// Ported from components/decision-table/dialog/dt-dialogs.tsx.
import { useDecisionTableDialog } from '../context/dt-dialog.context';
import { useDecisionTableActions, useDecisionTableState } from '../context/dt-store.context';
import FieldsReorder from './fields-reorder-dialog.vue';

const { dialog, setDialog, isDialogActive, getContainer } = useDecisionTableDialog();

const tableActions = useDecisionTableActions();
// upstream: useDecisionTableState(({ decisionTable }) => ({ decisionTableFields:
//   dialog?.columnType ? decisionTable[dialog.columnType] : undefined })) —
// ours returns a ComputedRef over the same slice.
const decisionTableFields = useDecisionTableState(({ decisionTable }) =>
  dialog.value?.columnType ? decisionTable[dialog.value.columnType] : undefined,
);
</script>

<template>
  <FieldsReorder
    :is-open="isDialogActive('reorder')"
    :fields="decisionTableFields"
    :on-dismiss="() => setDialog(undefined)"
    :on-success="
      (data) => {
        if (!dialog) return;
        tableActions.reorderColumns(dialog.columnType, data);
        setDialog(undefined);
      }
    "
    :get-container="getContainer"
  />
</template>
