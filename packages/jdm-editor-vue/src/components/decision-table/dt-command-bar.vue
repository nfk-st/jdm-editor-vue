<script setup lang="ts">
// Ported from components/decision-table/dt-command-bar.tsx.
// PORTING: antd Button/Divider/Popconfirm/Select/Tooltip → ui/Button +
// token-styled divider + ConfirmAction + ui/Select + ui/Tooltip; antd
// message (toasts) → console stand-in (no toast primitive in ui/ yet);
// lucide replaces @ant-design/icons.
import { ArrowDown, ArrowUp, Download, Trash2, Upload, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import type { ParsedExcelData } from '../../helpers/excel';
import { exportDecisionTable, getExcelData } from '../../helpers/excel';
import ConfirmAction from '../confirm-action.vue';
import Stack from '../stack.vue';
import Button from '../ui/Button.vue';
import Select from '../ui/Select.vue';
import Tooltip from '../ui/Tooltip.vue';
import DtExcelDialog from './components/dt-excel-dialog.vue';
import type { MappedExcelData } from './components/dt-excel-dialog.vue';
import {
  parseDecisionTable,
  useDecisionTableActions,
  useDecisionTableRaw,
  useDecisionTableState,
} from './context/dt-store.context';

// PORTING: antd message.success/error → console (no toast primitive in ui/
// yet; swap when one lands).
const message = {
  success: (m: string) => console.info(m),
  error: (m: string) => console.error(m),
};

const excelData = ref<ParsedExcelData[] | null>();

const tableActions = useDecisionTableActions();
const disabled = useDecisionTableState(({ disabled }) => disabled);
const cursor = useDecisionTableState(({ cursor }) => cursor);
const debugIndex = useDecisionTableState(({ debugIndex }) => debugIndex);
const { listenerStore, stateStore } = useDecisionTableRaw();

// PORTING: upstream used ts-pattern's P.array() here; its narrowing fights
// the port's trace typing — plain Array.isArray keeps identical semantics.
const traceData = useDecisionTableState(({ debug }) => debug?.trace?.traceData);
const traceCount = computed(() => (Array.isArray(traceData.value) ? traceData.value.length : null));

// upstream reads stateStore.getState().decisionTable fresh at render time
const table = computed(() => stateStore.getState().decisionTable);

const fileInput = ref<HTMLInputElement | null>(null);

const handleDataMapping = (mappedExcelData: MappedExcelData) => {
  const items = mappedExcelData.items;
  const rules = mappedExcelData.rules;

  const existingInputs = table.value.inputs;
  const existingOutputs = table.value.outputs;

  const idRemap: Record<string, string> = {};

  const inputs = items
    .filter((item) => item.type === 'input')
    .map((item) => {
      const existing = existingInputs.find((c) => c.name?.toLowerCase() === item.label?.toLowerCase());
      const newId = existing?.id ?? item.id;
      if (newId !== item.id) {
        idRemap[item.id] = newId;
      }
      return {
        id: newId,
        name: item.label,
        field: item.value
          ?.replace(/[^a-zA-Z0-9\s._]/g, '')
          .trim()
          .replace(/\s+/g, '.')
          .toLowerCase(),
        fieldType: existing?.fieldType,
        defaultValue: existing?.defaultValue,
      };
    });

  const outputs = items
    .filter((item) => item.type === 'output')
    .map((item) => {
      const existing = existingOutputs.find((c) => c.name?.toLowerCase() === item.label?.toLowerCase());
      const newId = existing?.id ?? item.id;
      if (newId !== item.id) {
        idRemap[item.id] = newId;
      }
      return {
        id: newId,
        name: item.label,
        field: item.value
          ?.replace(/[^a-zA-Z0-9\s._]/g, '')
          .trim()
          .split(/\s+/)
          .map((word, index) =>
            index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(''),
        outputFieldType: existing?.outputFieldType,
        defaultValue: existing?.defaultValue,
      };
    });

  const existingRules = table.value.rules ?? [];
  const reducedRules = rules.map((rule, index) =>
    rule.reduce(
      (acc: Record<string, any> & { _id: string }, item) => {
        const mappedId = idRemap[item.headerId] ?? item.headerId;
        acc[mappedId] = item.value;
        return acc;
      },
      {
        _id: existingRules[index]?._id ?? crypto.randomUUID(),
      },
    ),
  );

  const newTable = parseDecisionTable({
    executionMode: 'single',
    hitPolicy: 'first',
    inputs,
    outputs,
    rules: reducedRules,
    passThrough: false,
  });

  tableActions.setDecisionTable(newTable);
  listenerStore.getState().onChange?.(newTable);

  excelData.value = null;
};

const handleCancel = () => {
  excelData.value = null;
};

const exportExcel = async () => {
  try {
    const { decisionTable, name } = stateStore.getState();
    await exportDecisionTable(name ?? 'table', [{ ...decisionTable, name: 'decision table', id: crypto.randomUUID() }]);
    message.success('Excel file has been downloaded successfully!');
  } catch (e) {
    console.error('Failed to download Excel file!', e);
    message.error('Failed to download Excel file!');
  }
};

const importExcel = () => {
  fileInput.value?.click?.();
};

const readExcelFile = async (event: any) => {
  const file = event?.target?.files[0];
  const reader = new FileReader();

  try {
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
      const buffer = reader.result as ArrayBuffer;

      if (!buffer) return;

      const excelData = await getExcelData(buffer, table.value);

      if (excelData.length === 1) {
        setExcelData(excelData);
        message.success('Excel file has been uploaded successfully!');
      } else {
        message.error('Only excel file with a single data sheet can be handled in a table view.');
      }
    };
  } catch {
    message.error('Failed to upload Excel!');
  }
};

const setExcelData = (data: ParsedExcelData[] | null) => {
  excelData.value = data;
};

const resetFileInput = (event: MouseEvent) => {
  (event.target as any).value = null;
};

// PORTING: antd Select takes number option values; ui/Select is string-typed
// — stringify at the boundary, parse back on change (expression-command-bar
// pattern).
const traceIndexOptions = computed(() => {
  if (!traceCount.value) {
    return null;
  }

  return Array.from({ length: traceCount.value }).map((_, i) => ({
    label: String(i),
    value: String(i),
  }));
});

const selectedIndex = computed(() =>
  traceIndexOptions.value?.some((t) => t.value === String(debugIndex.value)) ? String(debugIndex.value) : '0',
);

const onSelect = (value: string) => {
  stateStore.setState({ debugIndex: Number(value) });
};
</script>

<template>
  <Stack horizontal horizontal-align="space-between" vertical-align="center" class="grl-dt__command-bar">
    <Stack :gap="8" horizontal class="full-width">
      <Button type="text" size="small" @click="exportExcel">
        <template #icon><Download :size="14" /></template>
        Export Excel
      </Button>
      <Button type="text" size="small" :disabled="disabled" @click="importExcel">
        <template #icon><Upload :size="14" /></template>
        Import Excel
      </Button>
      <template v-if="cursor && !disabled">
        <span class="grl-command-bar__divider" :style="{ height: '24px' }" />
        <Tooltip content="Add row below">
          <Button type="text" size="small" @click="() => tableActions.addRowBelow(cursor?.y)">
            <template #icon><ArrowDown :size="14" /></template>
          </Button>
        </Tooltip>
        <Tooltip content="Add row above">
          <Button type="text" size="small" @click="() => tableActions.addRowAbove(cursor?.y)">
            <template #icon><ArrowUp :size="14" /></template>
          </Button>
        </Tooltip>
        <!-- PORTING: upstream wrapped this in a title-less antd Tooltip
             (renders nothing); ours would show an empty bubble — omitted. -->
        <ConfirmAction
          icon-only
          text="Remove"
          confirm-text="Remove row?"
          @confirm="() => tableActions.removeRow(cursor?.y)"
        >
          <template #icon><Trash2 :size="14" /></template>
        </ConfirmAction>
        <Button type="text" size="small" @click="() => tableActions.setCursor(null)">
          <template #icon><X :size="14" /></template>
          Deselect
        </Button>
      </template>
    </Stack>
    <Stack v-if="traceIndexOptions" horizontal vertical-align="center" horizontal-align="end">
      <span class="grl-typography" :style="{ fontSize: '12px' }">Simulation index:</span>
      <Select
        size="small"
        :style="{ fontSize: '12px', minWidth: '60px' }"
        :options="traceIndexOptions"
        :model-value="selectedIndex"
        @update:model-value="onSelect"
      />
      <span class="grl-command-bar__divider" />
    </Stack>
  </Stack>
  <input ref="fileInput" multiple hidden accept=".xlsx" type="file" @change="readExcelFile" @click="resetFileInput" />
  <DtExcelDialog :excel-data="excelData" :handle-success="handleDataMapping" :handle-cancel="handleCancel" />
</template>

<style lang="scss">
// PORTING(additive): antd Divider type='vertical' → token-styled span
// (no ui/Divider in the port yet).
.grl-command-bar__divider {
  display: inline-block;
  align-self: center;
  width: 1px;
  min-width: 1px;
  height: 0.9em;
  margin: 0 8px;
  background-color: var(--grl-color-border);
}
</style>
