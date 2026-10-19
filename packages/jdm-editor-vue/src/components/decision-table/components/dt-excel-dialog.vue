<script lang="ts">
// Ported from components/decision-table/components/dt-excel-dialog.tsx.
// PORTING(DnD): react-dnd's per-row useDrag/useDrop (hover-math moveCard) →
// vue-draggable-plus on each section's row container (PORTING.md's DnD map,
// expression-list.vue's list pattern): the binding's setter replays
// upstream's "reorder section, then [...inputs, ...outputs]" merge.
// buildImportColumns/buildMappedExcelData are upstream's useEffect([excelData])
// and onOk bodies extracted as pure functions for vitest coverage
// (standard-expression-builder.vue precedent).
import type { ParsedExcelData, RuleData } from '../../../helpers/excel';
import type { ColumnFieldType, OutputFieldType } from '../../../helpers/schema';

type ItemValue = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
  field?: string;
  name?: string;
  wrapInQuotes?: boolean;
};

export type MappedExcelData = {
  items: ItemValue[];
  rules: RuleData[][];
};

export type DtExcelDialogProps = {
  excelData?: ParsedExcelData[] | null;
  handleSuccess: (mappedExcelData: MappedExcelData) => void;
  handleCancel: () => void;
};

export type ImportColumn = {
  id: string;
  name: string;
  field?: string;
  type: 'input' | 'output';
  excelHeaderId?: string;
  defaultValue?: string;
  fieldType?: ColumnFieldType;
  outputFieldType?: OutputFieldType;
};

type TableHeader = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
};

export const isHeaderMatch = (header1: TableHeader, header2: TableHeader) => {
  return (
    header1.id === header2.id ||
    header1.value?.toLowerCase() === header2.value?.toLowerCase() ||
    header1.label?.toLowerCase() === header2.label?.toLowerCase()
  );
};

// upstream: the excelData effect's derivation
export const buildImportColumns = (spreadSheetData: ParsedExcelData) => {
  const existingTableHeaders: TableHeader[] = spreadSheetData.existingTableData.headers
    .filter((h) => h.type !== undefined)
    .map((h) => ({
      id: h.id,
      label: h.name as string,
      value: h.field,
      type: h.type,
    }));

  const excelHeaders: TableHeader[] = (spreadSheetData.headers || [])
    .filter((h) => h.id !== '_description' && h.id !== '_id')
    .map((h) => ({
      id: h.id || crypto.randomUUID(),
      label: h.name as string,
      value: h.value,
      type: h._type as 'input' | 'output' | undefined,
    }));

  const existingSchemaItems = spreadSheetData.existingTableData.headers;

  const columns: ImportColumn[] = existingTableHeaders
    .filter((h) => h.type === 'input' || h.type === 'output')
    .map((tableHeader) => {
      const matchedExcel = excelHeaders.find((eh) => isHeaderMatch(eh, tableHeader));
      const schemaItem = existingSchemaItems.find((s) => s.id === tableHeader.id);
      return {
        id: tableHeader.id,
        name: tableHeader.label,
        field: tableHeader.value,
        type: tableHeader.type as 'input' | 'output',
        excelHeaderId: matchedExcel?.id,
        defaultValue: schemaItem?.defaultValue,
        fieldType: schemaItem?.fieldType,
        outputFieldType: schemaItem?.outputFieldType,
      };
    });

  // If no outputs exist, make the last input an output
  if (!columns.some((c) => c.type === 'output')) {
    const lastInput = [...columns].reverse().find((c) => c.type === 'input');
    if (lastInput) {
      lastInput.type = 'output';
    }
  }

  // Auto-match _description
  const descHeader = spreadSheetData.headers.find((h) => h.id === '_description');

  return {
    columns,
    descriptionExcelId: descHeader?.id,
    descriptionEnabled: !!descHeader,
  };
};

// upstream: the onOk mapping math
export const buildMappedExcelData = ({
  spreadSheetData,
  columns,
  disabledColumns,
  wrapStates,
  descriptionEnabled,
  descriptionExcelId,
}: {
  spreadSheetData: ParsedExcelData;
  columns: ImportColumn[];
  disabledColumns: Record<string, boolean>;
  wrapStates: Record<string, boolean>;
  descriptionEnabled: boolean;
  descriptionExcelId?: string;
}): MappedExcelData => {
  const enabled = columns.filter((c) => !disabledColumns[c.id]);
  const inputItems = enabled
    .filter((c) => c.type === 'input')
    .map((c) => ({
      id: c.id,
      label: c.name,
      value: c.field || c.name,
      type: 'input' as const,
      wrapInQuotes: wrapStates[c.id] || false,
    }));
  const outputItems = enabled
    .filter((c) => c.type === 'output')
    .map((c) => ({
      id: c.id,
      label: c.name,
      value: c.field || c.name,
      type: 'output' as const,
      wrapInQuotes: wrapStates[c.id] || false,
    }));
  const items: ItemValue[] = [...inputItems, ...outputItems];

  if (descriptionEnabled && descriptionExcelId) {
    items.push({ id: '_description', label: 'Description', value: 'description' });
  }

  const wrapLookup = items.reduce(
    (acc, item) => {
      acc[item.id] = item.wrapInQuotes || false;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const rules = spreadSheetData.rules.map((ruleRow) => {
    const ruleData: RuleData[] = [];
    for (const col of enabled) {
      const excelRule = col.excelHeaderId ? ruleRow.find((r) => r.headerId === col.excelHeaderId) : undefined;
      const rawValue = excelRule?.value ?? col.defaultValue ?? '';
      const value =
        wrapLookup[col.id] && rawValue
          ? rawValue
              .split(',')
              .map((s) => `"${s.trim()}"`)
              .join(', ')
          : rawValue;
      ruleData.push({ headerId: col.id, value });
    }
    // Add _id
    const idRule = ruleRow.find((r) => r.headerId === '_id');
    if (idRule) ruleData.push(idRule);
    // Add description
    if (descriptionEnabled && descriptionExcelId) {
      const descRule = ruleRow.find((r) => r.headerId === descriptionExcelId);
      ruleData.push({ headerId: '_description', value: descRule?.value ?? '' });
    }
    return ruleData;
  });

  return { items, rules };
};
</script>

<script setup lang="ts">
import { ArrowLeft, GripVertical, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { type PropType, computed, defineComponent, h, ref, watch } from 'vue';
import { type UseDraggableOptions, useDraggable } from 'vue-draggable-plus';

import { useDecisionTableDialog } from '../context/dt-dialog.context';
import { useDecisionTableState } from '../context/dt-store.context';
import ConfirmAction from '../../confirm-action.vue';
import Button from '../../ui/Button.vue';
import Checkbox from '../../ui/Checkbox.vue';
import Modal from '../../ui/Modal.vue';
import Select from '../../ui/Select.vue';
import Switch from '../../ui/Switch.vue';
import Tooltip from '../../ui/Tooltip.vue';
import InputFieldEdit from './input-field-edit.vue';
import OutputFieldEdit from './output-field-edit.vue';

const props = defineProps<DtExcelDialogProps>();

const { getContainer } = useDecisionTableDialog();
const inputVariableType = useDecisionTableState(({ inputVariableType }) => inputVariableType);

const spreadSheetData = computed(() => props.excelData?.[0]);

const columns = ref<ImportColumn[]>([]);
const disabledColumns = ref<Record<string, boolean>>({});
const wrapStates = ref<Record<string, boolean>>({});
const descriptionExcelId = ref<string | undefined>();
const descriptionEnabled = ref(true);

watch(
  spreadSheetData,
  (data) => {
    if (!data) {
      columns.value = [];
      disabledColumns.value = {};
      wrapStates.value = {};
      descriptionExcelId.value = undefined;
      descriptionEnabled.value = true;
      return;
    }

    const built = buildImportColumns(data);
    columns.value = built.columns;
    descriptionExcelId.value = built.descriptionExcelId;
    descriptionEnabled.value = built.descriptionEnabled;
  },
  { immediate: true },
);

const excelHeaders = computed(() => {
  if (!spreadSheetData.value) return [];
  return spreadSheetData.value.headers.filter((h) => h.id !== '_description' && h.id !== '_id');
});

const inputColumns = computed(() => columns.value.filter((c) => c.type === 'input'));
const outputColumns = computed(() => columns.value.filter((c) => c.type === 'output'));

// --- Column drag & drop -------------------------------------------------------

const inputRowsRef = ref<HTMLElement | null>(null);
const outputRowsRef = ref<HTMLElement | null>(null);
const draggingId = ref<string | null>(null);

// upstream moveInputCard/moveOutputCard: splice within the section, then
// recombine as [...inputs, ...outputs] — the binding's setter replays it.
const makeSectionBinding = (type: 'input' | 'output') =>
  computed({
    get: () => columns.value.filter((c) => c.type === type),
    set: (list: ImportColumn[]) => {
      const others = columns.value.filter((c) => c.type !== type);
      columns.value = type === 'input' ? [...list, ...others] : [...others, ...list];
    },
  });

const inputBinding = makeSectionBinding('input');
const outputBinding = makeSectionBinding('output');

const dragOptions = computed<UseDraggableOptions<ImportColumn>>(() => ({
  handle: '.grl-dt-excel-row__handle',
  animation: 0,
  // the row containers live inside the modal body (unmounted while closed) —
  // Sortable starts when the ref resolves instead of at component mount
  immediate: false,
  onStart: (evt) => {
    draggingId.value = (evt.item as HTMLElement).getAttribute('data-col-id');
  },
  onEnd: () => {
    draggingId.value = null;
  },
}));

const inputDrag = useDraggable(inputRowsRef, inputBinding, dragOptions);
const outputDrag = useDraggable(outputRowsRef, outputBinding, dragOptions);

// PORTING: vue-draggable-plus defaults to initializing Sortable onMounted
// (immediate: true), which throws for the null refs while the modal body is
// unmounted — start() is driven by the refs resolving instead.
watch(inputRowsRef, (el) => el && inputDrag.start(), { flush: 'post' });
watch(outputRowsRef, (el) => el && outputDrag.start(), { flush: 'post' });

// --- Row component (upstream: in-file ImportColumnRow) ------------------------

const ImportColumnRow = defineComponent({
  name: 'ImportColumnRow',
  props: {
    col: { type: Object as PropType<ImportColumn>, required: true },
    section: { type: String as PropType<'input' | 'output'>, required: true },
    excelHeaders: { type: Array as PropType<{ id: string; name?: string; value?: string }[]>, required: true },
    disabled: { type: Boolean, default: false },
    wrapChecked: { type: Boolean, default: false },
    dragging: { type: Boolean, default: false },
  },
  emits: ['toggle', 'excelHeaderChange', 'wrapChange', 'fieldChange', 'remove'],
  setup(props, { emit }) {
    return () => {
      const excelOptions = props.excelHeaders.map((h) => ({
        label: h.name || h.value || h.id,
        value: h.id,
      }));

      // PORTING: antd Popconfirm('Remove this column?') → ConfirmAction's
      // click-to-confirm (same recipe as dt-command-bar's row remove).
      const editTrigger = h(Tooltip, { content: 'Edit column' }, () =>
        h(Button, { type: 'text', size: 'small', style: { padding: 0 } }, { icon: () => h(Pencil, { size: 14 }) }),
      );

      return h(
        'div',
        {
          class: 'grl-dt-excel-row',
          'data-col-id': props.col.id,
          style: {
            display: 'grid',
            gridTemplateColumns: '24px 36px 1fr 12px 1fr 28px 28px 28px',
            gap: '8px',
            alignItems: 'center',
            padding: '6px 0',
            opacity: props.dragging ? 0.3 : props.disabled ? 0.4 : 1,
          },
        },
        [
          h(
            'div',
            {
              class: 'grl-dt-excel-row__handle',
              style: { cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' },
            },
            () => h(GripVertical, { size: 14, style: { color: 'var(--grl-color-text-tertiary)' } }),
          ),
          h(Switch, {
            size: 'small',
            modelValue: !props.disabled,
            'onUpdate:modelValue': (value: boolean) => emit('toggle', value),
          }),
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                padding: '4px 10px',
                backgroundColor: 'var(--grl-color-bg-layout)',
                borderRadius: '6px',
                border: '1px solid var(--grl-color-border)',
                minHeight: '36px',
                justifyContent: 'center',
              },
            },
            [
              h('span', { class: 'grl-typography', style: { fontSize: '13px', lineHeight: '18px' } }, props.col.name),
              props.col.field &&
                h(
                  'span',
                  {
                    class: 'grl-typography grl-typography--secondary',
                    style: { fontSize: '11px', lineHeight: '14px' },
                  },
                  props.col.field,
                ),
            ],
          ),
          h(ArrowLeft, { size: 12, style: { color: 'var(--grl-color-primary)' } }),
          h(Select, {
            allowClear: true,
            style: { width: '100%' },
            placeholder: 'Select Excel column',
            modelValue: props.col.excelHeaderId,
            disabled: props.disabled,
            'onUpdate:modelValue': (value: string) => emit('excelHeaderChange', value || undefined),
            options: excelOptions,
          }),
          h('div', { style: { display: 'flex', justifyContent: 'center' } }, () =>
            h(
              Tooltip,
              { content: 'Wrap values in quotes' },
              () =>
                h(Checkbox, {
                  disabled: props.disabled,
                  modelValue: props.wrapChecked,
                  'onUpdate:modelValue': (value: boolean) => emit('wrapChange', value),
                }),
            ),
          ),
          props.section === 'input'
            ? h(
                InputFieldEdit,
                {
                  mode: 'edit',
                  value: props.col.field,
                  fieldType: props.col.fieldType,
                  onChange: (field: string, fieldType?: ColumnFieldType) => emit('fieldChange', field, fieldType),
                  onRemove: () => emit('remove'),
                },
                { default: () => editTrigger },
              )
            : h(
                OutputFieldEdit,
                {
                  mode: 'edit',
                  value: props.col.field,
                  fieldType: props.col.outputFieldType,
                  onChange: (field: string, outputFieldType?: OutputFieldType) =>
                    emit('fieldChange', field, undefined, outputFieldType),
                  onRemove: () => emit('remove'),
                },
                { default: () => editTrigger },
              ),
          h(
            ConfirmAction,
            {
              iconOnly: true,
              text: 'Remove column',
              confirmText: 'Remove this column?',
              onConfirm: () => emit('remove'),
            },
            { icon: () => h(Trash2, { size: 14 }) },
          ),
        ],
      );
    };
  },
});

// --- Mapping state ------------------------------------------------------------

const enabledColumns = computed(() => columns.value.filter((c) => !disabledColumns.value[c.id]));
const hasEnabledOutput = computed(() => enabledColumns.value.some((c) => c.type === 'output'));
const isOkDisabled = computed(() => enabledColumns.value.length === 0 || !hasEnabledOutput.value);

const handleFieldChange = (
  colId: string,
  field: string,
  fieldType?: ColumnFieldType,
  outputFieldType?: OutputFieldType,
) => {
  columns.value = columns.value.map((c) => {
    if (c.id !== colId) return c;
    return {
      ...c,
      field: field || c.field,
      ...(fieldType !== undefined ? { fieldType } : {}),
      ...(outputFieldType !== undefined ? { outputFieldType } : {}),
    };
  });
};

const handleRemoveColumn = (colId: string) => {
  columns.value = columns.value.filter((c) => c.id !== colId);
  disabledColumns.value = (() => {
    const updated = { ...disabledColumns.value };
    delete updated[colId];
    return updated;
  })();
  wrapStates.value = (() => {
    const updated = { ...wrapStates.value };
    delete updated[colId];
    return updated;
  })();
};

// Auto-match an unmatched Excel header by label/field (upstream: inline)
const findUnmatchedExcel = (name: string, field: string) => {
  const usedExcelIds = new Set(columns.value.map((c) => c.excelHeaderId).filter(Boolean));
  return excelHeaders.value.find((eh) => {
    if (usedExcelIds.has(eh.id)) return false;
    const ehLabel = (eh.name || eh.value || '').toLowerCase();
    return ehLabel === name.toLowerCase() || ehLabel === field.toLowerCase();
  });
};

const handleAddInput = (name: string, field: string, fieldType?: ColumnFieldType) => {
  const newCol: ImportColumn = {
    id: crypto.randomUUID(),
    name,
    field,
    type: 'input',
    fieldType,
  };
  const unmatchedExcel = findUnmatchedExcel(name, field);
  if (unmatchedExcel) {
    newCol.excelHeaderId = unmatchedExcel.id;
  }
  columns.value = [...columns.value, newCol];
};

const handleAddOutput = (name: string, field: string, outputFieldType?: OutputFieldType) => {
  const newCol: ImportColumn = {
    id: crypto.randomUUID(),
    name,
    field,
    type: 'output',
    outputFieldType,
  };
  const unmatchedExcel = findUnmatchedExcel(name, field);
  if (unmatchedExcel) {
    newCol.excelHeaderId = unmatchedExcel.id;
  }
  columns.value = [...columns.value, newCol];
};

const onToggle = (colId: string, enabled: boolean) => {
  disabledColumns.value = (() => {
    const updated = { ...disabledColumns.value };
    if (enabled) {
      delete updated[colId];
    } else {
      updated[colId] = true;
    }
    return updated;
  })();
};

const onExcelHeaderChange = (colId: string, excelHeaderId: string | undefined) => {
  columns.value = columns.value.map((c) => (c.id === colId ? { ...c, excelHeaderId } : c));
};

const onWrapChange = (colId: string, checked: boolean) => {
  wrapStates.value = { ...wrapStates.value, [colId]: checked };
};

const onOk = () => {
  if (!spreadSheetData.value) return;

  props.handleSuccess(
    buildMappedExcelData({
      spreadSheetData: spreadSheetData.value,
      columns: columns.value,
      disabledColumns: disabledColumns.value,
      wrapStates: wrapStates.value,
      descriptionEnabled: descriptionEnabled.value,
      descriptionExcelId: descriptionExcelId.value,
    }),
  );
};
</script>

<template>
  <Modal
    :open="!!spreadSheetData"
    title="Map Excel data"
    :width="900"
    centered
    :get-container="getContainer"
    @update:open="(o) => !o && props.handleCancel()"
  >
    <div :style="{ padding: '8px 0' }">
      <!-- Inputs Section -->
      <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }">
        <span class="grl-typography" :style="{ fontSize: '13px', fontWeight: 600 }">Inputs</span>
        <InputFieldEdit mode="create" :variable-type="inputVariableType" @create="handleAddInput">
          <Button type="text" size="small">
            <template #icon><Plus :size="14" /></template>
            Add Input
          </Button>
        </InputFieldEdit>
      </div>
      <div
        :style="{
          border: '1px solid var(--grl-color-border)',
          borderRadius: '8px',
          padding: '4px 12px',
          marginBottom: '16px',
          minHeight: '40px',
        }"
      >
        <!-- Column headers -->
        <div
          :style="{
            display: 'grid',
            gridTemplateColumns: '24px 36px 1fr 12px 1fr 28px 28px 28px',
            gap: '8px',
            padding: '6px 0 2px',
          }"
        >
          <div />
          <div />
          <span class="grl-typography grl-typography--secondary" :style="{ fontSize: '12px', fontWeight: 600 }">
            Table column
          </span>
          <div />
          <span class="grl-typography grl-typography--secondary" :style="{ fontSize: '12px', fontWeight: 600 }">
            Excel column
          </span>
          <div />
          <div />
          <div />
        </div>
        <span
          v-if="inputColumns.length === 0"
          class="grl-typography grl-typography--secondary"
          :style="{ fontSize: '12px', padding: '8px 0', display: 'block' }"
        >
          No input columns
        </span>
        <div ref="inputRowsRef">
          <ImportColumnRow
            v-for="col in inputColumns"
            :key="col.id"
            :col="col"
            section="input"
            :excel-headers="excelHeaders"
            :disabled="!!disabledColumns[col.id]"
            :wrap-checked="wrapStates[col.id] || false"
            :dragging="draggingId === col.id"
            @toggle="(enabled) => onToggle(col.id, enabled)"
            @excel-header-change="(excelHeaderId) => onExcelHeaderChange(col.id, excelHeaderId)"
            @wrap-change="(checked) => onWrapChange(col.id, checked)"
            @field-change="
              (field, fieldType, outputFieldType) => handleFieldChange(col.id, field, fieldType, outputFieldType)
            "
            @remove="handleRemoveColumn(col.id)"
          />
        </div>
      </div>

      <!-- Outputs Section -->
      <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }">
        <span class="grl-typography" :style="{ fontSize: '13px', fontWeight: 600 }">Outputs</span>
        <OutputFieldEdit mode="create" @create="handleAddOutput">
          <Button type="text" size="small">
            <template #icon><Plus :size="14" /></template>
            Add Output
          </Button>
        </OutputFieldEdit>
      </div>
      <div
        :style="{
          border: '1px solid var(--grl-color-border)',
          borderRadius: '8px',
          padding: '4px 12px',
          marginBottom: '16px',
          minHeight: '40px',
        }"
      >
        <span
          v-if="outputColumns.length === 0"
          class="grl-typography grl-typography--secondary"
          :style="{ fontSize: '12px', padding: '8px 0', display: 'block' }"
        >
          No output columns
        </span>
        <div ref="outputRowsRef">
          <ImportColumnRow
            v-for="col in outputColumns"
            :key="col.id"
            :col="col"
            section="output"
            :excel-headers="excelHeaders"
            :disabled="!!disabledColumns[col.id]"
            :wrap-checked="wrapStates[col.id] || false"
            :dragging="draggingId === col.id"
            @toggle="(enabled) => onToggle(col.id, enabled)"
            @excel-header-change="(excelHeaderId) => onExcelHeaderChange(col.id, excelHeaderId)"
            @wrap-change="(checked) => onWrapChange(col.id, checked)"
            @field-change="
              (field, fieldType, outputFieldType) => handleFieldChange(col.id, field, fieldType, outputFieldType)
            "
            @remove="handleRemoveColumn(col.id)"
          />
        </div>
      </div>

      <!-- Description Section -->
      <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }">
        <span class="grl-typography" :style="{ fontSize: '13px', fontWeight: 600 }">Description</span>
      </div>
      <div :style="{ border: '1px solid var(--grl-color-border)', borderRadius: '8px', padding: '8px 12px' }">
        <div
          :style="{
            display: 'grid',
            gridTemplateColumns: '36px 24px 1fr',
            gap: '8px',
            alignItems: 'center',
          }"
        >
          <Switch
            size="small"
            :model-value="descriptionEnabled"
            :style="{ minWidth: '28px' }"
            @update:model-value="(v) => (descriptionEnabled = v)"
          />
          <ArrowLeft :size="12" :style="{ color: 'var(--grl-color-primary)' }" />
          <Select
            allow-clear
            :style="{ width: '100%' }"
            placeholder="Select Excel column for description"
            :model-value="descriptionExcelId"
            :disabled="!descriptionEnabled"
            :options="
              excelHeaders.map((h) => ({
                label: h.name || h.value || h.id,
                value: h.id,
              }))
            "
            @update:model-value="(val) => (descriptionExcelId = val || undefined)"
          />
        </div>
      </div>
    </div>
    <template #footer>
      <!-- PORTING: antd Modal's default footer (Cancel/OK with
           okButtonProps.disabled) rebuilt over ui/Button. -->
      <Button @click="props.handleCancel">Cancel</Button>
      <Button type="primary" :disabled="isOkDisabled" @click="onOk">OK</Button>
    </template>
  </Modal>
</template>
