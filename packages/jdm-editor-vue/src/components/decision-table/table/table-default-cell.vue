<script lang="ts">
// Ported from components/decision-table/table/table-default-cell.tsx.
// TableDefaultCell (default export) + TableInputCell + TableInputCellStatus
// live in this one file, following expression-item.vue's module-scope
// subcomponent pattern. Render-function components: the listener-supplied
// cell renderer returns a VNode, which composes naturally with h().
import type { CellContext } from '@tanstack/vue-table';
import { P, match } from 'ts-pattern';
import { type PropType, computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { columnIdSelector } from '../../../helpers/components';
import { isWasmAvailable, useWasmReady } from '../../../helpers/wasm';
import {
  type BuilderRef,
  ExpressionBuilder,
  StandardExpressionBuilder,
  focusBuilderRoot,
} from '../../code-editor/business';
import { DiffAutosizeTextArea, DiffCodeEditor } from '../../shared';
import { useDecisionTableActions, useDecisionTableRaw, useDecisionTableState } from '../context/dt-store.context';
import type { TableCellProps } from '../context/dt-store.context';
import { getReferenceMap } from '../util';

export type { TableCellProps };
export type TableDefaultCellProps = {
  context: CellContext<Record<string, string>, string>;
};

export const TableDefaultCell = defineComponent({
  name: 'TableDefaultCell',
  // PORTING: React.memo dropped — Vue components re-render only on dep change.
  props: {
    context: { type: Object as PropType<TableDefaultCellProps['context']>, required: true },
  },
  setup(props, { attrs }) {
    const index = computed(() => props.context.row.index);
    const id = computed(() => props.context.column.id);

    const tableActions = useDecisionTableActions();
    const value = useDecisionTableState(({ decisionTable }) => decisionTable?.rules?.[index.value]?.[id.value]);
    const diff = useDecisionTableState(
      ({ decisionTable }) => (decisionTable?.rules?.[index.value] as any)?._diff?.fields?.[id.value],
    );
    const disabled = useDecisionTableState(({ disabled }) => disabled);
    const column = useDecisionTableState((state) => columnIdSelector(id.value)(state));

    const inner = ref(value.value);
    // PORTING: upstream syncs inner←value in useLayoutEffect; a pre-flush
    // watch runs before the next render, which is the same guarantee here.
    watch(value, (v) => {
      if (inner.value !== v) {
        inner.value = v;
      }
    });

    const commit = (val: string) => {
      inner.value = val;
      tableActions.commitData(val, { x: id.value, y: index.value });
    };

    return () =>
      h(
        'div',
        {
          class: 'cell-wrapper',
          onFocus: () => tableActions.setCursor({ x: id.value, y: index.value }),
          onContextMenu: () => tableActions.setCursor({ x: id.value, y: index.value }),
          ...attrs,
        },
        [
          (props.context.table.options.meta as any)?.getCell?.({
            disabled: disabled.value,
            column: column.value,
            value: inner.value,
            diff: diff.value,
            onChange: commit,
          }) ||
            h(TableInputCell, {
              disabled: disabled.value,
              column: column.value,
              value: inner.value,
              onChange: commit,
              diff: diff.value,
              index: index.value,
            }),
        ],
      );
  },
});

enum LocalVariableKind {
  Root,
  Derived,
}

// PORTING: upstream forwards one textareaRef to either DiffAutosizeTextArea
// (→ the inner element) or DiffCodeEditor (→ its root el). The Vue ports
// expose { textArea: { el } } and { el } respectively — normalized here.
type CellEditorRef = { el?: HTMLElement | null; textArea?: { el?: HTMLElement | null } | null };

const TableInputCell = defineComponent({
  name: 'TableInputCell',
  props: {
    column: { type: Object as PropType<TableCellProps['column']>, default: undefined },
    value: { type: String, required: true },
    disabled: { type: Boolean, default: undefined },
    diff: { type: Object as PropType<TableCellProps['diff']>, default: undefined },
    index: { type: Number, required: true },
  },
  emits: ['change'],
  setup(props, { emit }) {
    // upstream: useMemo(() => crypto.randomUUID(), [])
    const id = crypto.randomUUID();
    const textareaRef = ref<CellEditorRef | null>(null);
    const containerRef = ref<HTMLDivElement | null>(null);
    const builderRef = ref<BuilderRef | null>(null);
    const raw = useDecisionTableRaw();
    const wasmReady = useWasmReady();

    const inputVariableType = useDecisionTableState(({ inputVariableType }) => inputVariableType);
    const derivedVariableTypes = useDecisionTableState(({ derivedVariableTypes }) => derivedVariableTypes);
    const rawMode = useDecisionTableState(({ mode }) => mode);

    const localVariableType = computed(() =>
      match(props.column)
        .with({ colType: 'input', field: P.string }, (c) => ({
          type: LocalVariableKind.Derived,
          value: derivedVariableTypes.value[c.field] ?? null,
        }))
        .otherwise(() => ({ type: LocalVariableKind.Root, value: inputVariableType.value })),
    );

    // Business mode requires WASM; fall back to dev mode until it's ready
    const mode = computed(() => (wasmReady.value ? rawMode.value : 'dev'));

    watch([inputVariableType, () => props.column], ([inputVariableType]) => {
      if (!inputVariableType) {
        return;
      }

      if (!props.column?.field || localVariableType.value.type !== LocalVariableKind.Derived) {
        return;
      }

      const state = raw.stateStore.getState();

      const resultingType = inputVariableType.clone();
      const calculatedType = inputVariableType.calculateType(props.column.field);
      resultingType.set('$', calculatedType);

      raw.stateStore.setState({
        derivedVariableTypes: {
          ...state.derivedVariableTypes,
          [props.column.field]: resultingType,
        },
      });
    });

    let cleanupFocus: (() => void) | undefined;

    onMounted(() => {
      const anchor = containerRef.value ?? textareaRef.value?.textArea?.el ?? textareaRef.value?.el ?? null;
      if (!anchor) return;

      const parentContainer = anchor.closest('div.cell-wrapper')! as HTMLElement;
      const eventListener = (e: Event) => {
        const target = e.target as HTMLElement;
        // PORTING: '.ant-select' → '.grl-select' (our Select component).
        if (target.closest('.cm-editor, input, textarea, select, button, .grl-select')) return;

        if (builderRef.value) {
          builderRef.value.focus();
        } else {
          focusBuilderRoot(anchor);
        }
      };

      parentContainer.style.cursor = 'text';
      parentContainer.addEventListener('click', eventListener);

      cleanupFocus = () => {
        parentContainer.style.cursor = '';
        parentContainer.removeEventListener('click', eventListener);
      };
    });
    onBeforeUnmount(() => cleanupFocus?.());

    const onChange = (value: string) => emit('change', value);

    return () => {
      const { column, value, disabled, diff, index } = props;

      if (!column) {
        return h(DiffAutosizeTextArea, {
          id,
          'ref': textareaRef,
          'class': 'grl-dt__cell__input',
          'maxRows': 3,
          'modelValue': value,
          disabled,
          'displayDiff': diff?.status === 'modified',
          'previousValue': diff?.previousValue,
          'spellCheck': false,
          'onUpdate:modelValue': onChange,
        });
      }

      const isInputColumn = column.colType === 'input' && column.field;
      const isOutputColumn = column.colType === 'output';

      if (mode.value === 'business' && isInputColumn) {
        return h('div', { ref: containerRef, class: 'grl-dt__cell__input__container' }, [
          h(TableInputCellStatus, { index, columnId: column.id }),
          h(ExpressionBuilder, {
            'ref': builderRef,
            'modelValue': value ?? '',
            'onUpdate:modelValue': onChange,
            disabled,
            'fieldType': column.fieldType,
          }),
        ]);
      }

      if (mode.value === 'business' && isOutputColumn) {
        return h('div', { ref: containerRef, class: 'grl-dt__cell__input__container' }, [
          h(StandardExpressionBuilder, {
            'ref': builderRef,
            'modelValue': value ?? '',
            'onUpdate:modelValue': onChange,
            disabled,
            'fieldType': column.outputFieldType,
          }),
        ]);
      }

      return h('div', { ref: containerRef, class: 'grl-dt__cell__input__container' }, [
        column.colType === 'input' && h(TableInputCellStatus, { index, columnId: column.id }),
        h(DiffCodeEditor, {
          'lazy': true,
          'ref': textareaRef,
          id,
          'type': match(column)
            .with({ colType: 'input', field: P.string }, () => 'unary' as const)
            .otherwise(() => 'standard' as const),
          'class': 'grl-dt__cell__input',
          'noStyle': true,
          'displayDiff': diff?.status === 'modified',
          'previousValue': diff?.previousValue,
          'variableType': localVariableType.value.value,
          'maxRows': 3,
          'modelValue': value,
          disabled,
          'onUpdate:modelValue': onChange,
        }),
      ]);
    };
  },
});

const TableInputCellStatus = defineComponent({
  name: 'TableInputCellStatus',
  props: {
    columnId: { type: String, required: true },
    index: { type: Number, required: true },
  },
  setup(props) {
    const inputData = useDecisionTableState(({ calculatedInputData }) => calculatedInputData);
    const expressionContext = useDecisionTableState(({ debug, debugIndex }) => {
      if (!isWasmAvailable() || !debug) {
        return;
      }

      const { trace, snapshot } = debug;
      const referenceMap = getReferenceMap(trace, debugIndex);
      if (!referenceMap) {
        return null;
      }

      const columnDef = snapshot.inputs.find((i) => i.id === props.columnId);
      if (!columnDef) {
        return null;
      }

      if (!(props.index in snapshot.rules)) {
        return null;
      }

      const expression = snapshot.rules[props.index]?.[props.columnId]?.trim();
      if (!columnDef.field) {
        return { type: 'standard' as const, expression };
      }

      if (!(columnDef.field in referenceMap)) {
        return { type: 'skip' as const };
      }

      return { type: 'unary' as const, expression, $: referenceMap[columnDef.field] };
    });

    const status = computed<'hit' | 'no-hit' | 'skip' | null>(() => {
      if (!inputData.value || !expressionContext.value) {
        return null;
      }

      const { type, expression, $ } = expressionContext.value;
      if (type === 'skip') {
        return 'skip';
      }

      if (!expression) {
        return 'hit';
      }

      try {
        let isOk: boolean;
        if (type === 'unary') {
          const newInputData = inputData.value.cloneWith('$', $);
          isOk = newInputData.evaluateUnaryExpression(expression);
        } else {
          isOk = inputData.value.evaluateExpression(expression) === true;
        }

        return isOk ? 'hit' : 'no-hit';
      } catch {
        return 'no-hit';
      }
    });

    return () => {
      if (!status.value) {
        return null;
      }

      switch (status.value) {
        case 'hit':
        case 'no-hit':
          // PORTING: upstream also passes color='var(--grl-color-success)' —
          // an inert DOM attribute; dt.scss keys off data-status instead.
          return h('div', { 'class': 'grl-dt__cell__input__status', 'data-status': status.value });
        case 'skip':
          return null;
      }
    };
  },
});

export default TableDefaultCell;
</script>
