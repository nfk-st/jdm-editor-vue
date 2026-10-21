<script lang="ts">
// Ported from components/decision-graph/graph/graph-excel-dialog.tsx.
// The step-selection derivations and the Done mapping are extracted as pure
// functions for vitest coverage (PORTING.md testing rule; dt-excel-dialog
// precedent).
// PORTING(SSR): lodash is a CommonJS package. A named import
// (`import { isEmpty } from 'lodash'`) type-checks and bundles fine, but
// Node's ESM named-export detection cannot see it, so importing the built
// library under Node throws. The default import + destructure is the
// interop-safe form (the repo's other lodash consumers already use it).
import lodash from 'lodash';

import type { ParsedExcelData, RuleData } from '../../../helpers/excel';
import type { NodeKind } from '../../../helpers/schema';
import type { HitPolicy } from '../../decision-table/context/dt-store.context';

type ItemValue = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
  field?: string;
  name?: string;
  wrapInQuotes?: boolean;
};

type SelectedItems = {
  [stepKey: string]: {
    [headerId: string]: ItemValue;
  };
};

export type MergedDataItem = {
  items: ItemValue[];
  rules: RuleData[][];
  id: string;
  name: string;
  type: NodeKind;
  position: { x: number; y: number };
  hitPolicy: HitPolicy | string;
  inputField?: string | null;
  outputPath?: string | null;
  passThrough?: boolean;
  executionMode?: 'single' | 'loop';
};

export type GraphExcelDialogProps = {
  excelData?: ParsedExcelData[] | null;
  handleSuccess: (items: MergedDataItem[]) => void;
  handleCancel: () => void;
};

type TableHeader = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
};

const dataTypeConfig = {
  ['input']: { label: 'Input', color: '#acccec' },
  ['output']: { label: 'Output', color: '#c7e0ba' },
} as const;

export const isHeaderMatch = (header1: TableHeader, header2: TableHeader) => {
  return (
    header1.id === header2.id ||
    header1.value?.toLowerCase() === header2.value?.toLowerCase() ||
    header1.label?.toLowerCase() === header2.label?.toLowerCase()
  );
};

export const mergeHeaders = (newHeader: TableHeader, existingHeader?: TableHeader) => {
  if (existingHeader) {
    return {
      id: newHeader.id,
      label: newHeader.label || existingHeader.label,
      value: newHeader.value || existingHeader.value,
      type: newHeader.type || existingHeader.type,
    };
  }

  return {
    ...newHeader,
    value: newHeader.value || newHeader.label,
  };
};

// upstream: the excelData effect's items derivation (graph-excel-dialog.tsx
// 102-137) — merged excel/existing headers with a trailing _description.
export const buildStepItems = (excelData: ParsedExcelData[], currentStep: number): ItemValue[] => {
  const existingTableHeaders: TableHeader[] = excelData[currentStep].existingTableData.headers
    .map((tableHeader) => ({
      ...tableHeader,
      value: tableHeader.field,
      label: tableHeader.name as string,
      type: tableHeader.type,
    }))
    .filter((header) => header.value);

  const newTableHeaders = (excelData[currentStep]?.headers || []).map((header) => ({
    id: header.id || crypto.randomUUID(),
    value: header.id === '_description' ? 'description' : header.value,
    label: header.name as string,
    ...(header.id !== '_description' && { type: header._type as 'input' | 'output' | undefined }),
  }));

  const items = [
    ...newTableHeaders.map((newTableHeader) => {
      const existingHeader = existingTableHeaders.find((header) => isHeaderMatch(header, newTableHeader));

      return mergeHeaders(newTableHeader, existingHeader);
    }),
    ...existingTableHeaders.filter(
      (existingTableHeader) => !newTableHeaders.some((newHeader) => isHeaderMatch(newHeader, existingTableHeader)),
    ),
  ];

  if (!items.some((item) => item.id === '_description')) {
    items.push({
      id: '_description',
      label: 'DESCRIPTION',
      value: 'description',
    });
  }

  return items;
};

// upstream: the matchingHeaders/selectedItemsMap derivation (141-168) — the
// last (or second-to-last with description) header becomes the output.
// `matchingHeaders` are the step items whose ids exist in the excel sheet.
export const buildSelectedItemsMap = (matchingHeaders: ItemValue[]): SelectedItems[string] => {
  return matchingHeaders.reduce<SelectedItems[string]>((acc, tableHeader, index) => {
    const hasDescription = matchingHeaders.some((header) => header.value === 'description');
    const hasOutputAlready = matchingHeaders.slice(0, index).some((header) => header.type === 'output');

    let shouldBeOutput;

    if (hasDescription) {
      // If there's description, set second-to-last as output
      shouldBeOutput = index === matchingHeaders.length - 2 && !hasOutputAlready;
    } else {
      // If no description, set last as output (excluding if it IS description)
      shouldBeOutput = index === matchingHeaders.length - 1 && tableHeader.value !== 'description' && !hasOutputAlready;
    }

    return {
      ...acc,
      [tableHeader.id]: {
        id: tableHeader.id,
        label: tableHeader.label,
        value: tableHeader.value,
        type: shouldBeOutput ? 'output' : tableHeader.type,
      },
    };
  }, {});
};

// upstream: the Done button's mergedData mapping (489-541).
export const buildMergedData = ({
  excelData,
  selectedItems,
  headerWrapStates,
}: {
  excelData: ParsedExcelData[];
  selectedItems: SelectedItems;
  headerWrapStates: Record<string, Record<string, boolean>>;
}): MergedDataItem[] => {
  return Object.keys(selectedItems).map((stepKey, index) => {
    const stepItems = selectedItems[stepKey];
    const stepWrapStates = headerWrapStates[stepKey] || {};

    const items = Object.keys(stepItems).map((key) => ({
      ...stepItems[key],
      wrapInQuotes: stepWrapStates[key] || false,
      ...(stepItems[key].value !== 'description' && {
        type: stepItems[key].type ?? 'input',
      }),
    }));

    const wrap = items.reduce(
      (acc, item) => {
        acc[item.id] = item.wrapInQuotes || false;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    const selectedHeaderIds = Object.keys(stepItems);

    const rules = (excelData[index].rules || []).map((rulesData) => {
      return rulesData
        .filter((rule) => [...selectedHeaderIds, '_id'].includes(rule.headerId))
        .map((rule) => ({
          headerId: stepItems[rule.headerId]?.id ?? rule.headerId,
          value: wrap[stepItems[rule.headerId]?.id ?? rule.headerId]
            ? rule.value
              ? rule.value
                  .split(',')
                  .map((s) => `"${s.trim()}"`)
                  .join(', ')
              : ''
            : rule.value,
        }));
    });

    return {
      items,
      rules,
      id: excelData[index].id,
      name: excelData[index].name,
      type: excelData[index].type,
      position: excelData[index].position,
      hitPolicy: excelData[index].existingTableData.hitPolicy,
      inputField: excelData[index].existingTableData.inputField,
      outputPath: excelData[index].existingTableData.outputPath,
      passThrough: excelData[index].existingTableData.passThrough,
      executionMode: excelData[index].existingTableData.executionMode,
    };
  });
};

const { isEmpty } = lodash;

export { dataTypeConfig, isEmpty };
</script>

<script setup lang="ts">
// PORTING: antd Steps → local stepper; antd Select (dropdownRender /
// optionRender / optionLabelProp) → local HeaderSelect over reka-ui Select
// primitives; antd Radio.Group buttonStyle='solid' → segmented buttons;
// antd Tag/Divider/Typography/Tooltip → token markup.
import { ArrowLeftRight, ChevronRight, Info, Plus } from 'lucide-vue-next';
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';
import type { AcceptableValue } from 'reka-ui';
import { type PropType, computed, defineComponent, h, ref, watch } from 'vue';

import Button from '../../ui/Button.vue';
import Checkbox from '../../ui/Checkbox.vue';
import Input from '../../ui/Input.vue';
import Modal from '../../ui/Modal.vue';
import Tooltip from '../../ui/Tooltip.vue';

const props = defineProps<GraphExcelDialogProps>();

const currentStep = ref<number>(0);
const steps = computed(() => props.excelData?.map((item) => ({ key: item.id, title: item.name })));

const items = ref<ItemValue[]>([]);
const newItemName = ref<string>('');

const headerWrapStates = ref<Record<string, Record<string, boolean>>>({});

const selectedItems = ref<SelectedItems | null>(null);

// upstream: useEffect([excelData, currentStep]) (93-184)
watch(
  () => [props.excelData, currentStep.value] as const,
  ([excelData, step]) => {
    if (!excelData) {
      // upstream: setSelectedItems(null) — React's setter → our ref write.
      selectedItems.value = null;
      currentStep.value = 0;
      newItemName.value = '';
      headerWrapStates.value = {};

      return;
    }

    items.value = buildStepItems(excelData, step);

    // upstream seeds the map only for headers that exist in the excel sheet
    const newTableHeaderIds = new Set((excelData[step]?.headers || []).map((header) => header.id));
    const matchingHeaders = items.value.filter((item) => newTableHeaderIds.has(item.id));

    if (matchingHeaders.length) {
      const selectedItemsMap = buildSelectedItemsMap(matchingHeaders);

      const stepKey = `step${step}`;
      if (!selectedItems.value?.[stepKey]) {
        selectedItems.value = {
          ...(selectedItems.value || {}),
          [stepKey]: selectedItemsMap,
        };
      }
    }
  },
  { immediate: true },
);

// upstream: antd Select with dropdownRender (333-375) + optionRender
// (376-387) — a local component over reka-ui Select primitives. The dropdown
// footer carries upstream's field-name input + Add item button.
const HeaderSelect = defineComponent({
  name: 'HeaderSelect',
  props: {
    items: { type: Array as PropType<ItemValue[]>, required: true },
    newItemName: { type: String, default: '' },
    selected: { type: Object as PropType<ItemValue | undefined>, default: undefined },
  },
  emits: ['select', 'clear', 'newItemName', 'addItem'],
  setup(selectProps, { emit }) {
    return () => {
      const options = selectProps.items.filter((item) => item.value);

      return h(
        SelectRoot,
        {
          'modelValue': selectProps.selected?.value,
          'onUpdate:modelValue': (value: AcceptableValue) => {
            // PORTING: reka-ui's Select emits an AcceptableValue; upstream's
            // antd Select only ever emitted the option's string value, so
            // non-string values are ignored (they cannot match an option).
            const option = typeof value === 'string' ? options.find((item) => item.value === value) : undefined;
            if (option) {
              emit('select', option);
            }
          },
        },
        () => [
          h(SelectTrigger, { class: 'grl-select', style: { width: '100%' } }, () => [
            // optionLabelProp='display': only the label shows when selected
            h(
              SelectValue,
              { class: 'grl-select__value', placeholder: 'select field' },
              () => selectProps.selected?.label,
            ),
            // antd allowClear affordance
            selectProps.selected
              ? h(
                  'span',
                  {
                    'class': 'grl-select__clear',
                    'role': 'button',
                    'aria-label': 'Clear select',
                    'onClick': (event: MouseEvent) => {
                      event.preventDefault();
                      event.stopPropagation();
                      emit('clear');
                    },
                  },
                  () => '×',
                )
              : null,
            h('span', { class: 'grl-select__arrow' }, () => '▾'),
          ]),
          h(SelectPortal, () =>
            h(SelectContent, { class: 'grl-select__content', position: 'popper', sideOffset: 4 }, () => [
              h(SelectViewport, { class: 'grl-select__viewport' }, () => [
                ...options.map((item) =>
                  h(SelectItem, { key: item.id, value: item.value as string, class: 'grl-select__item' }, () => [
                    // optionRender: label + data type tag
                    h(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                        },
                      },
                      [
                        h('span', item.label),
                        item.type
                          ? h(
                              'span',
                              { class: 'grl-graph-excel__tag', style: { background: dataTypeConfig[item.type].color } },
                              dataTypeConfig[item.type].label,
                            )
                          : null,
                      ],
                    ),
                    h(SelectItemIndicator, { class: 'grl-select__indicator' }, () => '✓'),
                  ]),
                ),
                // dropdownRender footer: input + Add item (antd Divider above)
                // PORTING(reka-ui): the footer lives inside reka's
                // SelectContent, whose keydown handler implements a
                // typeahead: every single-character keypress searches the
                // options and MOVES THE FOCUS to the matching one, and Tab
                // and Space are swallowed. antd's select has no typeahead —
                // its dropdownRender footer is a plain input — so the
                // footer's keydown stops at the footer. Escape is let
                // through: reka's DismissableLayer listens for it on the
                // window, and stopping it would trap the dropdown open.
                h(
                  'div',
                  {
                    class: 'grl-graph-excel__dropdown-footer',
                    onKeydown: (event: KeyboardEvent) => {
                      if (event.key === 'Escape') return;
                      event.stopPropagation();
                    },
                  },
                  [
                    h(Input, {
                      'placeholder': 'Enter field name',
                      'modelValue': selectProps.newItemName,
                      'onUpdate:modelValue': (value: string) => emit('newItemName', value),
                    }),
                    h(
                      Button,
                      {
                        type: 'text',
                        size: 'small',
                        onClick: (event: MouseEvent) => {
                          event.preventDefault();
                          event.stopPropagation();
                          emit('addItem');
                        },
                      },
                      { icon: () => h(Plus, { size: 14 }), default: () => 'Add item' },
                    ),
                  ],
                ),
              ]),
            ]),
          ),
        ],
      );
    };
  },
});

// antd Select's allowClear affordance rides next to the trigger.
const onClear = (headerId: string) => {
  const stepKey = `step${currentStep.value}`;
  const currentStepData = { ...(selectedItems.value || {})[stepKey] };
  delete currentStepData[headerId];
  selectedItems.value = {
    ...(selectedItems.value || {}),
    [stepKey]: currentStepData,
  };

  headerWrapStates.value = {
    ...headerWrapStates.value,
    [stepKey]: (() => {
      const updated = { ...headerWrapStates.value[stepKey] };
      delete updated[headerId];
      return updated;
    })(),
  };
};

const onSelect = (headerId: string, option: ItemValue) => {
  const { id, label, value, type, wrapInQuotes } = option;

  const stepKey = `step${currentStep.value}`;
  const currentStepData = { ...(selectedItems.value || {})[stepKey] };
  const clearedHeaderIds: string[] = [];

  Object.keys(currentStepData).forEach((key) => {
    if (key !== headerId && (currentStepData[key].value === value || currentStepData[key].label === label)) {
      clearedHeaderIds.push(key);
      delete currentStepData[key];
    }
  });

  if (clearedHeaderIds.length > 0) {
    const stepData = { ...(headerWrapStates.value[stepKey] || {}) };
    clearedHeaderIds.forEach((id) => delete stepData[id]);
    headerWrapStates.value = { ...headerWrapStates.value, [stepKey]: stepData };
  }

  selectedItems.value = {
    ...(selectedItems.value || {}),
    [stepKey]: {
      ...currentStepData,
      [headerId]: { id, label, value, type, wrapInQuotes },
    },
  };
};

// upstream keeps newItemName in shared state; the Add item button commits it.
const commitNewItem = () => {
  items.value = [
    ...items.value,
    {
      value: newItemName.value,
      label: newItemName.value,
      id: crypto.randomUUID(),
    },
  ];
  newItemName.value = '';
};

const onTypeChange = (headerId: string, type: 'input' | 'output') => {
  const stepKey = `step${currentStep.value}`;
  const currentStepData = (selectedItems.value || {})[stepKey];
  selectedItems.value = {
    ...(selectedItems.value || {}),
    [stepKey]: {
      ...currentStepData,
      [headerId]: {
        ...currentStepData[headerId],
        type,
      },
    },
  };
};

const onWrapChange = (headerId: string, checked: boolean) => {
  const stepKey = `step${currentStep.value}`;
  headerWrapStates.value = {
    ...headerWrapStates.value,
    [stepKey]: {
      ...(headerWrapStates.value[stepKey] || {}),
      [headerId]: checked,
    },
  };
};

const isFooterDisabled = computed(
  () => !selectedItems.value?.[`step${currentStep.value}`] || isEmpty(selectedItems.value[`step${currentStep.value}`]),
);

const onDone = () => {
  if (selectedItems.value && props.excelData) {
    props.handleSuccess(
      buildMergedData({
        excelData: props.excelData,
        selectedItems: selectedItems.value,
        headerWrapStates: headerWrapStates.value,
      }),
    );
  }
};
</script>

<template>
  <Modal
    :open="!!excelData"
    title="Map Excel data"
    centered
    :width="1024"
    @update:open="(o) => !o && props.handleCancel()"
  >
    <!-- PORTING: antd Steps → local stepper. -->
    <div class="grl-graph-excel__steps">
      <div
        v-for="(step, index) in steps || []"
        :key="step.key"
        class="grl-graph-excel__step"
        :class="{
          'grl-graph-excel__step--active': index === currentStep,
          'grl-graph-excel__step--done': index < currentStep,
        }"
      >
        <span class="grl-graph-excel__step__index">{{ index + 1 }}</span>
        <span class="grl-typography">{{ step.title }}</span>
        <ChevronRight v-if="index < (steps || []).length - 1" :size="14" />
      </div>
    </div>
    <div
      :style="{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr auto 0.1fr',
        gap: '16px 24px',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }"
    >
      <span class="grl-typography grl-typography--secondary excel-grid-heading">Excel columns</span>
      <!-- placeholder for grid -->
      <div />
      <span class="grl-typography grl-typography--secondary excel-grid-heading">Decision table columns</span>
      <span class="grl-typography grl-typography--secondary excel-grid-heading">Data type</span>
      <div :style="{ display: 'flex', justifyContent: 'center', marginBottom: '-8px' }">
        <Tooltip content="Wrap value in quotes">
          <Info :size="14" :style="{ color: 'var(--grl-color-text-secondary)', cursor: 'pointer' }" />
        </Tooltip>
      </div>
      <template v-for="(header, index) in excelData?.[currentStep]?.headers || []" :key="index">
        <div
          :style="{
            display: 'flex',
            alignItems: 'center',
            height: '30px',
            padding: '0 12px',
            backgroundColor: 'var(--grl-color-bg-layout)',
            borderRadius: '8px',
            border: '1px solid var(--grl-color-border)',
          }"
        >
          <span class="grl-typography">{{ header.name || header.value }}</span>
        </div>

        <ArrowLeftRight :size="16" :style="{ color: 'var(--grl-color-primary)' }" />

        <HeaderSelect
          :items="items"
          :new-item-name="newItemName"
          :selected="selectedItems?.[`step${currentStep}`]?.[header.id]"
          @select="(option) => onSelect(header.id, option)"
          @clear="() => onClear(header.id)"
          @new-item-name="(name) => (newItemName = name)"
          @add-item="commitNewItem"
        />

        <template v-if="selectedItems && selectedItems?.[`step${currentStep}`]?.[header.id]?.value !== 'description'">
          <!-- PORTING: antd Radio.Group buttonStyle='solid' → segmented. -->
          <div class="grl-graph-excel__segment">
            <button
              type="button"
              class="grl-graph-excel__segment__btn"
              :class="{
                'grl-graph-excel__segment__btn--active':
                  (selectedItems[`step${currentStep}`]?.[header.id]?.type ?? 'input') === 'input',
              }"
              :disabled="!selectedItems?.[`step${currentStep}`]?.[header.id]"
              @click="() => onTypeChange(header.id, 'input')"
            >
              Input
            </button>
            <button
              type="button"
              class="grl-graph-excel__segment__btn"
              :class="{
                'grl-graph-excel__segment__btn--active':
                  selectedItems[`step${currentStep}`]?.[header.id]?.type === 'output',
              }"
              :disabled="!selectedItems?.[`step${currentStep}`]?.[header.id]"
              @click="() => onTypeChange(header.id, 'output')"
            >
              Output
            </button>
          </div>
        </template>
        <div v-else>
          <!-- placeholder for grid -->
        </div>
        <div
          v-if="selectedItems?.[`step${currentStep}`]?.[header.id]?.value !== 'description'"
          :style="{ display: 'flex', justifyContent: 'center' }"
        >
          <Checkbox
            :disabled="!selectedItems?.[`step${currentStep}`]?.[header.id]"
            :model-value="headerWrapStates[`step${currentStep}`]?.[header.id] || false"
            @update:model-value="(checked) => onWrapChange(header.id, checked)"
          />
        </div>
        <div v-else>
          <!-- placeholder for grid -->
        </div>
      </template>
    </div>
    <!-- PORTING(react): React appends 'px' to numeric style values; Vue does not. -->
    <div :style="{ marginTop: '24px', display: 'flex', alignItems: 'center' }">
      <Button
        v-if="currentStep < (excelData || []).length - 1"
        type="primary"
        :disabled="isFooterDisabled"
        @click="() => (currentStep = currentStep + 1)"
      >
        Next
      </Button>
      <Button
        v-if="currentStep === (excelData || []).length - 1"
        type="primary"
        :disabled="isFooterDisabled"
        @click="onDone"
      >
        Done
      </Button>
      <Button v-if="currentStep > 0" :style="{ margin: '0 8px' }" @click="() => (currentStep = currentStep - 1)">
        Previous
      </Button>
    </div>
    <template #footer>
      <Button @click="props.handleCancel">Cancel</Button>
    </template>
  </Modal>
</template>

<style lang="scss">
.grl-graph-excel__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 0;
}

.grl-graph-excel__step {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &__index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 12px;
    color: var(--grl-color-text-secondary);
    background-color: var(--grl-color-bg-layout);
    border: 1px solid var(--grl-color-border);
  }

  &--active &__index {
    color: white;
    background-color: var(--grl-color-primary);
    border-color: var(--grl-color-primary);
  }

  &--done &__index {
    color: var(--grl-color-primary);
    border-color: var(--grl-color-primary);
  }
}

.grl-graph-excel__tag {
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  border-radius: 3px;
  color: var(--grl-color-text);
}

.grl-graph-excel__dropdown-footer {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid var(--grl-color-border);
}

.grl-graph-excel__segment {
  display: flex;
  width: 100%;

  &__btn {
    flex: 1;
    height: 24px;
    font-size: 12px;
    color: var(--grl-color-text);
    background: var(--grl-color-bg-container);
    border: 1px solid var(--grl-color-border);
    cursor: pointer;
    text-align: center;

    &:first-child {
      border-radius: var(--grl-border-radius) 0 0 var(--grl-border-radius);
    }

    &:last-child {
      border-radius: 0 var(--grl-border-radius) var(--grl-border-radius) 0;
    }

    &--active {
      color: white;
      background: var(--grl-color-primary);
      border-color: var(--grl-color-primary);
    }

    &:disabled {
      cursor: not-allowed;
      color: var(--grl-color-text-disabled);
    }
  }
}

.excel-grid-heading {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: -8px;
}
</style>
