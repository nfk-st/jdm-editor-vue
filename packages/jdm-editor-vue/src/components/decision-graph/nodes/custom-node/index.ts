// Ported from components/decision-graph/nodes/custom-node/index.tsx.
// PORTING: phase B fills in the factory half — `createJdmNode` with its
// default renderNode — alongside the phase A type re-exports. The default
// renderNode's antd Form/Form.Item (initialValues/onValuesChange,
// valuePropName) → a path-aware local values object (dotted names resolve
// nested, matching the CreateDynamicType shape); antd theme token fontSizeSM
// → 12px (the token's value).
import _ from 'lodash';
import { ChevronDown } from 'lucide-vue-next';
import { match } from 'ts-pattern';
import { type PropType, computed, defineComponent, h, ref } from 'vue';

import { CodeEditor } from '../../../code-editor';
import Button from '../../../ui/Button.vue';
import Checkbox from '../../../ui/Checkbox.vue';
import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import GraphNode from '../graph-node.vue';
import type { MinimalNodeSpecification } from '../specifications/specification-types';
import type { BaseNode, CustomNodeSpecification, InputSchema } from './types';

export type { BaseNode, CustomNodeSpecification } from './types';
export type { CheckboxControl, JdmControl, TextControl } from './controls';

export const createJdmNode = <
  Component extends string,
  InputName extends string,
  Inputs extends InputSchema<InputName>[],
>(
  n: BaseNode<Component, InputName, Inputs>,
): CustomNodeSpecification<any, Component> => {
  return {
    kind: n.kind,
    icon: n.icon,
    color: n.color,
    displayName: n.displayName,
    group: n.group,
    shortDescription: n.shortDescription,
    generateNode:
      n.generateNode ||
      (({ index }) => ({
        name: `${n.kind || n.displayName}${index}`,
      })),
    onNodeAdd: n.onNodeAdd,
    renderNode: n.renderNode
      ? n.renderNode
      : defineComponent({
          name: 'JdmCustomNode',
          inheritAttrs: false,
          props: {
            id: { type: String, required: true },
            data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
            selected: { type: Boolean, default: false },
            specification: { type: Object as PropType<MinimalNodeSpecification>, required: true },
          },
          setup(props) {
            const open = ref(false);
            const { updateNode } = useDecisionGraphActions();
            const node = useDecisionGraphState((state) =>
              (state.decisionGraph?.nodes || []).find((x) => x.id === props.id),
            );
            const nodeData = computed(() => node.value?.content?.config);

            // PORTING: antd Form initialValues={nodeData} snapshot taken when
            // the form area opens (upstream mounts <Form> on open).
            const formValues = ref<Record<string, unknown>>({});

            const setFieldValue = (name: string, value: unknown) => {
              const next = { ...formValues.value };
              _.set(next, name, value);
              formValues.value = next;
              updateNode(props.id, (draft) => {
                draft.content.config = next;
                return draft;
              });
            };

            return () =>
              h(
                GraphNode,
                {
                  id: props.id,
                  specification: props.specification,
                  name: props.data?.name,
                  isSelected: props.selected,
                  noBodyPadding: true,
                  handleLeft: n.handleLeft,
                  handleRight: n.handleRight,
                  actions: n?.inputs
                    ? [
                        h(
                          Button,
                          {
                            key: 'edit-table',
                            type: 'text',
                            style: { marginLeft: 'auto', transform: open.value ? 'rotate(180deg)' : undefined },
                            onClick: () => {
                              open.value = !open.value;
                              if (open.value) {
                                formValues.value = { ...(nodeData.value ?? {}) };
                              }
                            },
                          },
                          { default: () => h(ChevronDown, { size: 12 }) },
                        ),
                      ]
                    : undefined,
                },
                {
                  default: () =>
                    open.value &&
                    n?.inputs &&
                    h(
                      'form',
                      { class: 'grl-dn__cn__form', onSubmit: (e: Event) => e.preventDefault() },
                      (n?.inputs || []).map(({ name, control, label }) => {
                        const value = _.get(formValues.value, name);

                        const formItem = match({ control })
                          .with({ control: 'text' }, () =>
                            h(CodeEditor, {
                              'type': 'template',
                              'modelValue': (value as string) ?? '',
                              'onUpdate:modelValue': (val: string) => setFieldValue(name, val),
                              'style': { fontSize: 12, lineHeight: '20px', width: '100%' },
                            }),
                          )
                          .with({ control: 'bool' }, () =>
                            // upstream Form.Item valuePropName='checked'
                            h(
                              Checkbox,
                              {
                                'modelValue': !!value,
                                'onUpdate:modelValue': (val: boolean) => setFieldValue(name, val),
                              },
                              { default: () => h('span', { class: 'grl-typography', style: { fontSize: 12 } }, label) },
                            ),
                          )
                          .exhaustive();

                        const outerLabel = match({ control })
                          .with({ control: 'bool' }, () => null)
                          .otherwise(() => h('span', { class: 'grl-typography', style: { fontSize: 12 } }, label));

                        return h('div', { key: name, class: 'grl-form-item', style: { marginBottom: 4 } }, [
                          outerLabel,
                          formItem,
                        ]);
                      }),
                    ),
                },
              );
          },
        }),
  };
};
