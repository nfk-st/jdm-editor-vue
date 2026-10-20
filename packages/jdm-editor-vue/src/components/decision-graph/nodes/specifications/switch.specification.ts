// Ported from components/decision-graph/nodes/specifications/switch.specification.tsx.
// PORTING: the three in-file React components (SwitchNode, SwitchHandle,
// SwitchHandleCompact) become defineComponent render functions, kept in this
// module like upstream. antd Button/Dropdown/Popconfirm/Typography → ui/Button
// + reka-ui DropdownMenu + controlled ui/Popover popconfirm;
// react-intersection-observer's useInView({delay: 1_000}) → @vueuse/core
// useIntersectionObserver with a manual 1s settle timer.
import type { VariableType } from '@gorules/zen-engine-wasm';
import { Position, Handle as VueFlowHandle } from '@vue-flow/core';
import { useIntersectionObserver } from '@vueuse/core';
import clsx from 'clsx';
import { produce } from 'immer';
import _ from 'lodash';
import { ArrowRight, ChevronDown, Split, Trash2 } from 'lucide-vue-next';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import { P, match } from 'ts-pattern';
import { type PropType, computed, defineComponent, h, onUnmounted, ref, watch } from 'vue';

import { useNodeType } from '../../../../helpers/node-type';
import { DiffCodeEditor } from '../../../shared';
import Button from '../../../ui/Button.vue';
import Popover from '../../../ui/Popover.vue';
import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import type { Diff, DiffMetadata } from '../../dg-types';
import { compareAndUnifyLists } from '../../diff/comparison';
import type { SimulationTrace, SimulationTraceDataSwitch } from '../../simulator/simulation.types';
import GraphNode from '../graph-node.vue';
import { NodeColor } from './colors';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

export type SwitchStatement = {
  id: string;
  condition?: string;
  isDefault?: boolean;
} & Diff;

export type NodeSwitchData = {
  hitPolicy?: 'first' | 'collect';
  statements?: (SwitchStatement & Diff)[];
} & Diff;

export const switchSpecification: NodeSpecification<NodeSwitchData> = {
  type: NodeKind.Switch,
  icon: () => h(Split, { style: { width: '1em', height: '1em' } }),
  displayName: 'Switch',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/switch',
  shortDescription: 'Conditional branching',
  color: NodeColor.Purple,
  getDiffContent: (current, previous) => {
    return produce(current, (draft) => {
      const fields: DiffMetadata['fields'] = {};
      if ((current.hitPolicy ?? '') !== (previous.hitPolicy ?? '')) {
        _.set(fields, 'hitPolicy', {
          status: 'modified',
          previousValue: current.hitPolicy,
        });
      }

      const statements = compareAndUnifyLists(current?.statements || [], previous?.statements || [], {
        compareFields: (current, previous) => {
          const hasConditionChange = (current.condition ?? '') !== previous.condition;
          // const hasIsDefaultChange = (current.isDefault ?? false) !== (previous.isDefault ?? false);

          return {
            hasChanges: hasConditionChange,
            fields: {
              ...(hasConditionChange && {
                condition: {
                  status: 'modified',
                  previousValue: previous.condition,
                },
              }),
              // ...(hasIsDefaultChange && {
              //   isDefault: {
              //     status: 'modified',
              //     previousValue: previous.isDefault,
              //   },
              // }),
            },
          };
        },
      });

      draft.statements = statements;
      if (
        statements.find(
          (statement) =>
            statement?._diff?.status === 'modified' ||
            statement?._diff?.status === 'added' ||
            statement?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'statements', {
          status: 'modified',
        });
      }

      if (Object.keys(fields).length > 0) {
        draft._diff = {
          status: 'modified',
          fields,
        };
      }
      return draft;
    });
  },
  inferTypes: {
    needsUpdate: () => false,
    determineOutputType: (state) => state.input,
  },
  generateNode: ({ index }) => ({
    name: `switch${index}`,
    content: {
      hitPolicy: 'first',
      statements: [{ id: crypto.randomUUID(), condition: '', isDefault: false }],
    },
  }),
  renderNode: defineComponent({
    name: 'SwitchNodeWrapper',
    props: {
      id: { type: String, required: true },
      data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
      selected: { type: Boolean, default: false },
      specification: {
        type: Object as PropType<Pick<NodeSpecification, 'displayName' | 'icon' | 'documentationUrl'>>,
        required: true,
      },
    },
    setup(wrapperProps) {
      // upstream: renderNode: ({ specification, ...props }) => <SwitchNode specification={specification} {...props} />
      return () => h(SwitchNode, { ...wrapperProps });
    },
  }),
};

// upstream: const SwitchNode: React.FC<MinimalNodeProps & { specification }>
const SwitchNode = defineComponent({
  name: 'SwitchNode',
  props: {
    id: { type: String, required: true },
    data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
    selected: { type: Boolean, default: false },
    specification: {
      type: Object as PropType<Pick<NodeSpecification, 'displayName' | 'icon' | 'documentationUrl'>>,
      required: true,
    },
  },
  setup(props) {
    const graphActions = useDecisionGraphActions();

    // PORTING: useInView({ delay: 1_000 }) → useIntersectionObserver + a
    // manual 1s settle timer; the observer targets GraphNode's exposed root
    // element (upstream forwards the ref onto GraphNode's wrapper div).
    const graphNodeRef = ref<{ rootElement: HTMLDivElement | null } | null>(null);
    const inView = ref(false);
    let inViewTimer: ReturnType<typeof setTimeout> | undefined;
    const { stop: stopObserver } = useIntersectionObserver(
      computed(() => graphNodeRef.value?.rootElement ?? null),
      ([entry]) => {
        if (entry?.isIntersecting) {
          inViewTimer = setTimeout(() => {
            inView.value = true;
          }, 1_000);
        } else {
          clearTimeout(inViewTimer);
          inView.value = false;
        }
      },
    );
    onUnmounted(() => {
      clearTimeout(inViewTimer);
      stopObserver();
    });

    const state = useDecisionGraphState(({ decisionGraph, disabled, simulate, compactMode, activeTab }) => ({
      nodeTrace: match(simulate)
        .with({ result: P._ }, ({ result }) => result?.trace?.[props.id] as SimulationTrace<SimulationTraceDataSwitch>)
        .otherwise(() => null),
      content: (decisionGraph?.nodes || []).find((n) => n?.id === props.id)?.content as NodeSwitchData | undefined,
      disabled,
      compactMode,
      isGraphActive: activeTab === 'graph',
    }));

    // PORTING: upstream passes a per-render `disabled: !isGraphActive || !inView`
    // into useNodeType (its selector re-captures the flag on every React
    // render); our hook captures the flag once, so the gating is applied here.
    const rawNodeType = useNodeType(props.id);
    const nodeType = computed(() => (!state.value.isGraphActive || !inView.value ? undefined : rawNodeType.value));

    const statements = computed<SwitchStatement[]>(() => state.value.content?.statements || []);
    const hitPolicy = computed(() => state.value.content?.hitPolicy || 'first');

    const changeHitPolicy = (hitPolicy: string) => {
      graphActions.updateNode(props.id, (node) => {
        node.content.hitPolicy = hitPolicy;
        return node;
      });
    };

    // upstream: const Handle = useMemo(() => (compactMode ? SwitchHandleCompact : SwitchHandle), [compactMode])
    const HandleComponent = computed(() => (state.value.compactMode ? SwitchHandleCompact : SwitchHandle));

    return () =>
      h(
        GraphNode,
        {
          ref: graphNodeRef,
          id: props.id,
          class: clsx(['switch']),
          specification: props.specification,
          name: props.data?.name,
          handleRight: false,
          helper: [h(ArrowRight, { size: 12 })],
          noBodyPadding: true,
          isSelected: props.selected,
          actions: [
            h(
              Button,
              {
                key: 'add condition',
                type: 'text',
                disabled: state.value.disabled,
                onClick: () => {
                  if (hitPolicy.value === 'first' && statements.value?.length > 0) {
                    graphActions.updateNode(props.id, (draft) => {
                      draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map(
                        (statement) => {
                          if (statement.isDefault) {
                            statement.isDefault = false;
                          }
                          return statement;
                        },
                      );
                      draft.content.statements.push({ id: crypto.randomUUID(), condition: '', isDefault: true });
                      return draft;
                    });
                  } else {
                    graphActions.updateNode(props.id, (draft) => {
                      draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map(
                        (statement) => {
                          if (statement.isDefault) {
                            statement.isDefault = false;
                          }
                          return statement;
                        },
                      );
                      draft.content.statements.push({ id: crypto.randomUUID(), condition: '', isDefault: false });
                      return draft;
                    });
                  }
                },
              },
              () => 'Add Condition',
            ),
            // upstream: antd Dropdown (trigger click, placement bottomRight)
            h(
              DropdownMenuRoot,
              {},
              {
                default: () => [
                  h(
                    DropdownMenuTrigger,
                    { asChild: true },
                    {
                      default: () =>
                        h(
                          Button,
                          {
                            key: 'hitPolicy',
                            type: 'text',
                            style: { textTransform: 'capitalize', marginLeft: 'auto' },
                          },
                          { default: () => [hitPolicy.value, ' ', h(ChevronDown, { size: 12 })] },
                        ),
                    },
                  ),
                  h(
                    DropdownMenuPortal,
                    {},
                    {
                      default: () =>
                        h(
                          DropdownMenuContent,
                          { class: 'grl-context-menu', align: 'end', sideOffset: 4 },
                          {
                            default: () => [
                              h(
                                DropdownMenuItem,
                                {
                                  class: 'grl-context-menu__item',
                                  disabled: state.value.disabled,
                                  onSelect: () => changeHitPolicy('first'),
                                },
                                { default: () => 'First' },
                              ),
                              h(
                                DropdownMenuItem,
                                {
                                  class: 'grl-context-menu__item',
                                  disabled: state.value.disabled,
                                  onSelect: () => {
                                    graphActions.updateNode(props.id, (draft) => {
                                      draft.content.statements = (
                                        (draft.content.statements || []) as SwitchStatement[]
                                      ).map((statement) => {
                                        if (statement.isDefault) {
                                          statement.isDefault = false;
                                        }
                                        return statement;
                                      });
                                      return draft;
                                    });
                                    changeHitPolicy('collect');
                                  },
                                },
                                { default: () => 'Collect' },
                              ),
                            ],
                          },
                        ),
                    },
                  ),
                ],
              },
            ),
          ],
        },
        {
          default: () =>
            h('div', { class: 'switchNode' }, [
              h('div', { class: 'switchNode__body edit nodrag' }, [
                !(statements.value?.length > 0) &&
                  h('span', { class: 'grl-typography grl-typography--secondary no-conditions' }, 'No conditions'),
                ...statements.value.map((statement, index) =>
                  h(HandleComponent.value, {
                    key: statement.id,
                    index,
                    value: statement.condition,
                    diff: statement?._diff,
                    id: statement.id,
                    isDefault: statement.isDefault,
                    totalStatements: statements.value.length,
                    disabled: state.value.disabled,
                    hitPolicy: hitPolicy.value,
                    variableType: nodeType.value,
                    onSetIsDefault: (val: boolean) => {
                      graphActions.updateNode(props.id, (draft) => {
                        const draftStatement = draft.content.statements.find((s: SwitchStatement) => {
                          return s.id === statement.id;
                        });
                        if (val) {
                          draftStatement.condition = '';
                        }
                        draftStatement.isDefault = val;
                        return draft;
                      });
                    },
                    isActive: match(state.value.nodeTrace?.traceData)
                      .with({ statements: P.array(P._) }, ({ statements }) =>
                        statements.some((s) => typeof s === 'object' && s && 'id' in s && s.id === statement?.id),
                      )
                      .otherwise(() => false),
                    onDelete: () => {
                      graphActions.updateNode(props.id, (draft) => {
                        draft.content.statements = draft.content.statements.filter(
                          (s: SwitchStatement) => s?.id !== statement?.id,
                        );

                        if ((draft.content.statements || []).length === 1) {
                          draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map(
                            (statement) => {
                              if (statement.isDefault) {
                                statement.isDefault = false;
                              }
                              return statement;
                            },
                          );
                        }

                        return draft;
                      });
                      graphActions.removeEdgeByHandleId(statement?.id as string);
                    },
                    onChange: (condition: string) => {
                      graphActions.updateNode(props.id, (draft) => {
                        const draftStatement = draft.content.statements.find((s: SwitchStatement) => {
                          return s.id === statement.id;
                        });

                        draftStatement.condition = condition;
                        return draft;
                      });
                    },
                  }),
                ),
              ]),
            ]),
        },
      );
  },
});

// upstream: antd Popconfirm ('Remove condition?' / Remove) → controlled
// ui/Popover with Cancel/Remove buttons.
const Popconfirm = defineComponent({
  name: 'SwitchPopconfirm',
  emits: ['confirm'],
  setup(_, { emit, slots }) {
    const open = ref(false);
    return () =>
      h(
        Popover,
        { 'open': open.value, 'onUpdate:open': (v: boolean) => (open.value = v) },
        {
          trigger: () => slots.trigger?.()[0],
          default: () =>
            h('div', { class: 'grl-popconfirm' }, [
              h('div', { class: 'grl-popconfirm__message grl-typography' }, 'Remove condition?'),
              h('div', { class: 'grl-popconfirm__actions' }, [
                h(Button, { size: 'small', onClick: () => (open.value = false) }, () => 'Cancel'),
                h(
                  Button,
                  {
                    size: 'small',
                    type: 'primary',
                    danger: true,
                    onClick: () => {
                      open.value = false;
                      emit('confirm');
                    },
                  },
                  () => 'Remove',
                ),
              ]),
            ]),
        },
      );
  },
});

// upstream declares the handle props inline on each React.FC; the shared
// object below carries the same surface for both variants.
const switchHandleProps = {
  id: { type: String, default: undefined },
  value: { type: String as PropType<string | undefined>, default: undefined },
  isDefault: { type: Boolean, default: false },
  diff: { type: Object as PropType<DiffMetadata | undefined>, default: undefined },
  onChange: { type: Function as PropType<(value: string) => void>, default: undefined },
  onSetIsDefault: { type: Function as PropType<(isDefault: boolean) => void>, default: undefined },
  onDelete: { type: Function as PropType<() => void>, default: undefined },
  disabled: { type: Boolean, default: undefined },
  isActive: { type: Boolean, default: undefined },
  configurable: { type: Boolean, default: true },
  hitPolicy: { type: String as PropType<'first' | 'collect'>, required: true as const },
  totalStatements: { type: Number, required: true as const },
  index: { type: Number, default: 0 },
  variableType: { type: Object as PropType<VariableType | undefined>, default: undefined },
};

// upstream: const SwitchHandle: React.FC<SwitchHandleProps>
const SwitchHandle = defineComponent({
  name: 'SwitchHandle',
  props: switchHandleProps,
  setup(props) {
    const inner = ref(props.value);
    // upstream useLayoutEffect syncs inner with value — the pre-flush watch
    // runs before the next paint.
    watch(
      () => props.value,
      (value) => {
        if (inner.value !== value) {
          inner.value = value;
        }
      },
    );

    const handleChange = (val: string) => {
      inner.value = val;
      props.onChange?.(val);
    };

    return () => {
      const isLastIndex = props.index === props.totalStatements - 1;

      const isElse =
        props.isDefault &&
        props.hitPolicy === 'first' &&
        isLastIndex &&
        props.index > 0 &&
        (props.value || '')?.trim?.()?.length === 0;

      return h(
        'div',
        {
          class: clsx(
            'switchNode__statement',
            props.isActive && 'active',
            props.diff?.status && `diff-${props.diff?.status}`,
          ),
        },
        [
          h(
            'div',
            {
              class: clsx('switchNode__statement__heading', isElse && 'switchNode__statement__heading--without-input'),
            },
            [
              (props.index === 0 || props.hitPolicy === 'collect') &&
                h(
                  Button,
                  {
                    disabled: props.disabled,
                    class: clsx(['switchNode__statement__heading__action']),
                    size: 'small',
                    type: 'text',
                  },
                  () => 'If',
                ),
              props.hitPolicy !== 'collect' &&
                props.index > 0 &&
                h(
                  Button,
                  {
                    class: clsx('switchNode__statement__heading__action', isElse && 'inactive'),
                    size: 'small',
                    type: 'text',
                    disabled: props.disabled,
                    onClick: () => {
                      if (isLastIndex && props.hitPolicy === 'first') {
                        props.onSetIsDefault?.(false);
                      }
                    },
                  },
                  () => 'Else If',
                ),
              props.hitPolicy !== 'collect' &&
                props.index > 0 &&
                isLastIndex &&
                h(
                  Button,
                  {
                    class: clsx('switchNode__statement__heading__action', !isElse && 'inactive'),
                    size: 'small',
                    type: 'text',
                    disabled: props.disabled,
                    onClick: () => {
                      if (isLastIndex && props.hitPolicy === 'first') {
                        props.onSetIsDefault?.(true);
                      }
                    },
                  },
                  () => 'Else',
                ),
              h('div', {
                style: {
                  flexGrow: 1,
                },
              }),
              !props.disabled &&
                props.configurable &&
                h(
                  Popconfirm,
                  { onConfirm: () => props.onDelete?.() },
                  {
                    trigger: () =>
                      h(
                        Button,
                        { class: 'switchNode__statement__delete', size: 'small', type: 'text' },
                        { icon: () => h(Trash2, { size: 12 }) },
                      ),
                  },
                ),
              h(VueFlowHandle, {
                id: props.id,
                type: 'source',
                position: Position.Right,
                class: clsx(props.isActive && 'switchNode__activeHandle'),
              }),
            ],
          ),
          !isElse &&
            h('div', { class: 'switchNode__statement__inputArea' }, [
              h(DiffCodeEditor, {
                'style': {
                  fontSize: 12,
                  lineHeight: '20px',
                  width: '100%',
                },
                'displayDiff': props.diff?.fields?.condition?.status === 'modified',
                'previousValue': props.diff?.fields?.condition?.previousValue,
                'modelValue': inner.value,
                'maxRows': 4,
                'disabled': props.disabled,
                'onUpdate:modelValue': handleChange,
                'variableType': props.variableType,
              }),
            ]),
        ],
      );
    };
  },
});

// upstream: const SwitchHandleCompact: React.FC<SwitchHandleProps>
const SwitchHandleCompact = defineComponent({
  name: 'SwitchHandleCompact',
  props: switchHandleProps,
  setup(props) {
    const inner = ref(props.value);
    watch(
      () => props.value,
      (value) => {
        if (inner.value !== value) {
          inner.value = value;
        }
      },
    );

    const handleChange = (val: string) => {
      inner.value = val;
      props.onChange?.(val);
    };

    return () =>
      h(
        'div',
        {
          class: clsx(
            'switchNode__statement',
            'compact',
            props.isActive && 'active',
            props.diff?.status && `diff-${props.diff?.status}`,
          ),
        },
        [
          h('div', { class: clsx(['switchNode__statement__inputArea']) }, [
            h(DiffCodeEditor, {
              'style': {
                fontSize: 12,
                lineHeight: '20px',
                width: '100%',
              },
              'displayDiff': props.diff?.fields?.condition?.status === 'modified',
              'previousValue': props.diff?.fields?.condition?.previousValue,
              'modelValue': inner.value,
              'maxRows': 4,
              'disabled': props.disabled,
              'onUpdate:modelValue': handleChange,
              'variableType': props.variableType,
            }),
          ]),
          !props.disabled &&
            props.configurable &&
            h('div', { class: 'switchNode__statement__button' }, [
              h(
                Popconfirm,
                { onConfirm: () => props.onDelete?.() },
                {
                  trigger: () =>
                    h(
                      Button,
                      { class: 'switchNode__statement__delete', size: 'small', type: 'text' },
                      { icon: () => h(Trash2, { size: 12 }) },
                    ),
                },
              ),
            ]),
          h(VueFlowHandle, {
            id: props.id,
            type: 'source',
            position: Position.Right,
            class: clsx(props.isActive && 'switchNode__activeHandle'),
          }),
        ],
      );
  },
});
