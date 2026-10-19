<script lang="ts">
// Ported from components/decision-table/table/table-head-cell.tsx.
// Upstream exports four peer components from this one module; the SFC keeps
// them as module-scope defineComponents (the in-file subcomponent pattern
// from expression/expression-item.vue). No default component — import the
// named exports.
import { ArrowUpDown, Plus } from 'lucide-vue-next';
import { type PropType, defineComponent, h } from 'vue';

import DiffIcon from '../../diff-icon.vue';
import Stack from '../../stack.vue';
import TextEdit from '../../text-edit.vue';
import Button from '../../ui/Button.vue';
import Tooltip from '../../ui/Tooltip.vue';
import type { ColumnType, DecisionTablePermission, TableSchemaItem } from '../context/dt-store.context';
import { useDecisionTableActions, useDecisionTableState } from '../context/dt-store.context';
import { getReferenceMap } from '../util';

export type TableHeadCellProps = {
  permission?: DecisionTablePermission;
  disabled?: boolean;
};

export type TableHeadCellFieldProps = {
  permission?: DecisionTablePermission;
  disabled?: boolean;
  schema: TableSchemaItem;
};

// PORTING: context/dt-dialog.context is a later phase — no-op stand-in keeps
// the reorder-button call sites upstream-shaped. Swap to the real composable
// (../context/dt-dialog.context) when the dialog phase lands.
type TableDialogState = { type: 'reorder'; columnType: ColumnType; item: TableSchemaItem | null };
const useDecisionTableDialog = (): { setDialog: (dialog: TableDialogState | undefined) => void } => ({
  setDialog: () => {},
});

// PORTING: stand-ins for components/input-field-edit.tsx +
// output-field-edit.tsx (chrome phase). They accept upstream's full prop
// surface (callbacks declared as props so nothing falls through) so the call
// sites below stay 1:1; they render the trigger slot in create mode and a
// static field pill in edit mode — the edit popover itself lands with the
// real components. The names collide deliberately: importing the real ones
// forces deleting these.
const fieldEditStandInProps = {
  disabled: { type: Boolean, default: undefined },
  value: { type: String as PropType<string | undefined>, default: undefined },
  variableType: { type: null, default: undefined },
  inputData: { type: null, default: undefined },
  referenceData: { type: null, default: undefined },
  fieldType: { type: null, default: undefined },
  mode: { type: String as PropType<'edit' | 'create'>, default: 'edit' as const },
  onCreate: {
    type: Function as PropType<(name: string, field: string, fieldType?: never) => void>,
    default: undefined,
  },
  onChange: { type: Function as PropType<(value: string, fieldType?: never) => void>, default: undefined },
  onRemove: { type: Function as PropType<() => void>, default: undefined },
};
const InputFieldEdit = defineComponent({
  name: 'InputFieldEdit',
  props: fieldEditStandInProps,
  setup(props, { slots }) {
    return () => (props.mode === 'create' ? slots.default?.() : h('div', { class: 'grl-dt-field' }, props.value));
  },
});
const OutputFieldEdit = defineComponent({
  name: 'OutputFieldEdit',
  props: fieldEditStandInProps,
  setup(props, { slots }) {
    return () =>
      props.mode === 'create'
        ? slots.default?.()
        : h('div', { class: ['grl-dt-field', 'grl-dt-field--output'] }, props.value);
  },
});

export const TableHeadCellInput = defineComponent({
  name: 'TableHeadCellInput',
  props: {
    permission: { type: String as PropType<DecisionTablePermission>, default: undefined },
    disabled: { type: Boolean, default: undefined },
  },
  setup(props) {
    const inputs = useDecisionTableState((store) => store.decisionTable?.inputs);
    const tableActions = useDecisionTableActions();
    const { setDialog } = useDecisionTableDialog();
    const inputData = useDecisionTableState(({ calculatedInputData }) => calculatedInputData);
    const inputVariableType = useDecisionTableState(({ inputVariableType }) => inputVariableType);

    return () =>
      h('div', { class: 'head-cell' }, [
        h(Stack, { horizontal: true, horizontalAlign: 'space-between', verticalAlign: 'center' }, () => [
          h(Stack, { gap: 0, class: 'text-wrapper', verticalAlign: 'center' }, () => [
            h('span', { class: 'grl-typography span-overflow grl-dt-text-primary' }, 'Inputs'),
          ]),
          (props.permission === 'edit:full' || props.permission === 'edit:rules') &&
            h('div', { class: 'cta-wrapper' }, [
              inputs.value &&
                inputs.value.length > 1 &&
                h(
                  Tooltip,
                  { content: 'Reorder fields' },
                  {
                    default: () =>
                      h(
                        Button,
                        {
                          class: 'grl-dt-text-secondary',
                          size: 'small',
                          type: 'text',
                          disabled: props.disabled,
                          onClick: () => {
                            setDialog({
                              type: 'reorder',
                              columnType: 'inputs',
                              item: null,
                            });
                          },
                        },
                        { icon: () => h(ArrowUpDown, { size: 14 }) },
                      ),
                  },
                ),
              h(
                InputFieldEdit,
                {
                  mode: 'create',
                  disabled: props.disabled,
                  variableType: inputVariableType.value,
                  inputData: inputData.value,
                  onCreate: (name: string, field: string, fieldType: TableSchemaItem['fieldType']) => {
                    tableActions.addColumn('inputs', {
                      id: crypto.randomUUID(),
                      name,
                      field: field || undefined,
                      fieldType,
                    });
                  },
                },
                {
                  default: () =>
                    h(
                      Button,
                      {
                        class: 'grl-dt-text-secondary',
                        size: 'small',
                        type: 'text',
                        disabled: props.disabled,
                      },
                      { icon: () => h(Plus, { size: 14 }) },
                    ),
                },
              ),
            ]),
        ]),
      ]);
  },
});

export const TableHeadCellOutput = defineComponent({
  name: 'TableHeadCellOutput',
  props: {
    permission: { type: String as PropType<DecisionTablePermission>, default: undefined },
    disabled: { type: Boolean, default: undefined },
  },
  setup(props) {
    const outputs = useDecisionTableState((store) => store.decisionTable?.outputs);
    const tableActions = useDecisionTableActions();
    const { setDialog } = useDecisionTableDialog();

    return () =>
      h('div', { class: 'head-cell' }, [
        h(Stack, { horizontal: true, horizontalAlign: 'space-between', verticalAlign: 'center' }, () => [
          h(Stack, { gap: 0, class: 'text-wrapper', verticalAlign: 'center' }, () => [
            h('span', { class: 'grl-typography span-overflow grl-dt-text-primary' }, 'Outputs'),
          ]),
          props.permission === 'edit:full' &&
            h('div', { class: 'cta-wrapper' }, [
              outputs.value &&
                outputs.value.length > 1 &&
                h(
                  Tooltip,
                  { content: 'Reorder fields' },
                  {
                    default: () =>
                      h(
                        Button,
                        {
                          class: 'grl-dt-text-secondary',
                          size: 'small',
                          type: 'text',
                          disabled: props.disabled,
                          onClick: () => {
                            setDialog({
                              type: 'reorder',
                              columnType: 'outputs',
                              item: null,
                            });
                          },
                        },
                        { icon: () => h(ArrowUpDown, { size: 14 }) },
                      ),
                  },
                ),
              h(
                OutputFieldEdit,
                {
                  mode: 'create',
                  disabled: props.disabled,
                  onCreate: (name: string, field: string, outputFieldType: TableSchemaItem['outputFieldType']) => {
                    tableActions.addColumn('outputs', {
                      id: crypto.randomUUID(),
                      name,
                      field: field || 'output',
                      outputFieldType,
                    });
                  },
                },
                {
                  default: () =>
                    h(
                      Button,
                      {
                        class: 'grl-dt-text-secondary',
                        size: 'small',
                        type: 'text',
                        disabled: props.disabled,
                      },
                      { icon: () => h(Plus, { size: 14 }) },
                    ),
                },
              ),
            ]),
        ]),
      ]);
  },
});

export const TableHeadCellInputField = defineComponent({
  name: 'TableHeadCellInputField',
  props: {
    permission: { type: String as PropType<DecisionTablePermission>, default: undefined },
    disabled: { type: Boolean, default: undefined },
    schema: { type: Object as PropType<TableSchemaItem>, required: true },
  },
  setup(props) {
    const tableActions = useDecisionTableActions();
    const inputData = useDecisionTableState(({ calculatedInputData }) => calculatedInputData);
    const inputVariableType = useDecisionTableState(({ inputVariableType }) => inputVariableType);

    const referenceData = useDecisionTableState(({ debug, debugIndex }) => {
      if (!debug) {
        return undefined;
      }

      const { trace, snapshot } = debug;
      const snapshotField = snapshot.inputs.find((i) => i.id === props.schema.id);
      if (!snapshotField?.field) {
        return undefined;
      }

      const referenceMap = getReferenceMap(trace, debugIndex);
      return {
        field: snapshotField.field,
        value: referenceMap?.[snapshotField.field],
      };
    });

    return () => {
      const { schema } = props;

      return h('div', { class: 'head-cell' }, [
        h(Stack, { horizontal: true, horizontalAlign: 'space-between', verticalAlign: 'center' }, () => [
          h(Stack, { gap: 0, class: 'text-wrapper' }, () => [
            schema?._diff?.fields?.name?.status === 'modified' &&
              h(
                'span',
                { class: 'grl-typography span-overflow grl-dt-text-primary text-removed' },
                schema?._diff?.fields?.name?.previousValue,
              ),
            h(TextEdit, {
              class: 'span-overflow grl-dt-text-primary',
              value: schema.name,
              onChange: (name: string) => {
                tableActions.updateColumn('inputs', schema.id, { ...schema, name });
              },
            }),
            schema?._diff?.fields?.field?.status &&
              h(
                'span',
                {
                  class: 'grl-typography span-overflow grl-dt-text-secondary text-removed',
                  style: { fontSize: '12px' },
                },
                schema?._diff?.fields?.field?.previousValue,
              ),
            h(InputFieldEdit, {
              value: schema.field,
              variableType: inputVariableType.value,
              inputData: inputData.value,
              referenceData: referenceData.value,
              fieldType: schema.fieldType,
              disabled: props.disabled || (props.permission !== 'edit:full' && props.permission !== 'edit:rules'),
              onRemove: () => {
                tableActions.removeColumn('inputs', schema.id);
              },
              onChange: (field: string, fieldType: TableSchemaItem['fieldType']) => {
                tableActions.updateColumn('inputs', schema.id, { ...schema, field, fieldType });
              },
            }),
          ]),
          h(Stack, { horizontal: true, gap: 2, verticalAlign: 'center', style: { width: 'auto' } }, () => [
            h(DiffIcon, { status: schema?._diff?.status, style: { fontSize: '16px' } }),
          ]),
        ]),
      ]);
    };
  },
});

export const TableHeadCellOutputField = defineComponent({
  name: 'TableHeadCellOutputField',
  props: {
    permission: { type: String as PropType<DecisionTablePermission>, default: undefined },
    disabled: { type: Boolean, default: undefined },
    schema: { type: Object as PropType<TableSchemaItem>, required: true },
  },
  setup(props) {
    const tableActions = useDecisionTableActions();

    return () => {
      const { schema } = props;

      return h('div', { class: 'head-cell' }, [
        h(Stack, { horizontal: true, horizontalAlign: 'space-between', verticalAlign: 'center' }, () => [
          h(Stack, { gap: 0, class: 'text-wrapper', verticalAlign: 'center' }, () => [
            schema?._diff?.fields?.name?.status === 'modified' &&
              h(
                'span',
                { class: 'grl-typography span-overflow grl-dt-text-primary text-removed' },
                schema?._diff?.fields?.name?.previousValue,
              ),
            h(TextEdit, {
              class: 'span-overflow grl-dt-text-primary',
              value: schema.name,
              onChange: (name: string) => {
                tableActions.updateColumn('outputs', schema.id, { ...schema, name });
              },
            }),
            schema?._diff?.fields?.field?.status === 'modified' &&
              h(
                'span',
                {
                  class: 'grl-typography span-overflow grl-dt-text-secondary text-removed',
                  style: { fontSize: '12px' },
                },
                schema?._diff?.fields?.field?.previousValue,
              ),
            h(OutputFieldEdit, {
              value: schema.field,
              fieldType: schema.outputFieldType,
              disabled: props.disabled || props.permission !== 'edit:full',
              onRemove: () => {
                tableActions.removeColumn('outputs', schema.id);
              },
              onChange: (field: string, outputFieldType: TableSchemaItem['outputFieldType']) => {
                tableActions.updateColumn('outputs', schema.id, { ...schema, field, outputFieldType });
              },
            }),
          ]),
          h(Stack, { horizontal: true, gap: 2, verticalAlign: 'center', style: { width: 'auto' } }, () => [
            h(DiffIcon, {
              status: schema?._diff?.status,
              style: {
                fontSize: '16px',
              },
            }),
          ]),
        ]),
      ]);
    };
  },
});
</script>
