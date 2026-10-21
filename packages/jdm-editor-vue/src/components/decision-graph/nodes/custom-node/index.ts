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

// PORTING(antd): rc-field-form (antd's form store) resolves a field name
// like 'a.b' into a PATH: the value is stored NESTED under
// config.a.b, and `getFieldsValue()` returns the nested shape for the
// REGISTERED fields only. Upstream's <Form.Item name='hello.nested.something'>
// therefore ends up in the node's config as a nested object, and the other
// config keys are dropped.
//
// The port read the flat key instead and wrote with lodash's `_.set`, which
// nests a name that is not already a key — and then wrote INTO the frozen
// (immer) object on the next edit, so the edit was silently lost. These two
// helpers port the form store's shape and make the write immutable.
export const setFormValue = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  const [head, ...rest] = path.split('.');

  if (!rest.length) {
    return { ...target, [head]: value };
  }

  const child =
    typeof target[head] === 'object' && target[head] !== null ? (target[head] as Record<string, unknown>) : {};

  return { ...target, [head]: setFormValue(child, rest.join('.'), value) };
};

// PORTING(antd): the form's initial values are the node's config, read
// through the field's name path, and only the registered fields are kept.
export const collectInputValues = (
  config: Record<string, unknown> | undefined,
  names: string[],
): Record<string, unknown> => {
  const values: Record<string, unknown> = {};

  for (const name of names) {
    const value = _.get(config ?? {}, name);
    if (value !== undefined) {
      Object.assign(values, setFormValue(values, name, value));
    }
  }

  return values;
};

export const createJdmNode = <
  ComponentKind extends string,
  InputName extends string,
  Inputs extends InputSchema<InputName>[],
>(
  n: BaseNode<ComponentKind, InputName, Inputs>,
): CustomNodeSpecification<any, ComponentKind> => {
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
            const inputNames = (n?.inputs ?? []).map((input) => input.name);

            const setFieldValue = (name: string, value: unknown) => {
              const next = setFormValue(formValues.value, name, value);
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
                                formValues.value = collectInputValues(nodeData.value, inputNames);
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
                              // PORTING(react): React appends 'px' to numeric style values; Vue does not.
                              'style': { fontSize: '12px', lineHeight: '20px', width: '100%' },
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
                              {
                                default: () =>
                                  h('span', { class: 'grl-typography', style: { fontSize: '12px' } }, label),
                              },
                            ),
                          )
                          .exhaustive();

                        const outerLabel = match({ control })
                          .with({ control: 'bool' }, () => null)
                          .otherwise(() => h('span', { class: 'grl-typography', style: { fontSize: '12px' } }, label));

                        return h('div', { key: name, class: 'grl-form-item', style: { marginBottom: '4px' } }, [
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
