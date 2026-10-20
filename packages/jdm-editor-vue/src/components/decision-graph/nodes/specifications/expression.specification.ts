// Ported from components/decision-graph/nodes/specifications/expression.specification.tsx.
// PORTING: JSX renderNode/renderSettings bodies → defineComponent render
// functions (h()); antd Form.Item → .grl-form-item markup (label + control);
// DiffInput/DiffRadio emit values directly (upstream read e.target.value).
// renderTab's TabExpression is phase C (see input.specification.ts note).
import { VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import _ from 'lodash';
import { ArrowRight, Hash, RefreshCw } from 'lucide-vue-next';
import { type PropType, type VNode, defineComponent, h } from 'vue';
import type { z } from 'zod';

import { useNodeType } from '../../../../helpers/node-type';
import type { expressionNodeSchema } from '../../../../helpers/schema';
import { DiffCodeEditor, DiffInput, DiffRadio, DiffSwitch } from '../../../shared';
import Button from '../../../ui/Button.vue';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../../context/dg-store.context';
import { type Diff, type DiffMetadata } from '../../dg-types';
import { compareAndUnifyLists, compareStringFields } from '../../diff/comparison';
// PORTING(P-C): import { TabExpression } from '../../graph/tab-expression'
import GraphNode from '../graph-node.vue';
import type { NodeDecisionTableData } from './decision-table.specification';
import type { MinimalNodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';
import type { NodeSpecification } from './specification-types';

export type Expression = {
  id: string;
  key?: string;
  value?: string;
};

type InferredContent = z.infer<typeof expressionNodeSchema>['content'];

export type NodeExpressionData = Omit<InferredContent, 'expressions'> &
  Diff & {
    expressions: (InferredContent['expressions'][0] & Diff)[];
  };

// PORTING: antd Form.Item (vertical layout) → .grl-form-item markup
// (styled in decision-node.scss).
const formItem = (label: string, control: VNode): VNode =>
  h('div', { class: 'grl-form-item' }, [h('label', { class: 'grl-form-item__label' }, label), control]);

export const expressionSpecification: NodeSpecification<NodeExpressionData> = {
  type: NodeKind.Expression,
  icon: () => h(Hash, { style: { width: '1em', height: '1em' } }),
  displayName: 'Expression',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/expression',
  shortDescription: 'Mapping utility',
  renderTab: () => null,
  getDiffContent: (current, previous) => {
    const newContent = produce(current, (draft) => {
      const fields: DiffMetadata['fields'] = {};

      if ((current.executionMode || false) !== (previous.executionMode || false)) {
        _.set(fields, 'executionMode', {
          status: 'modified',
          previousValue: previous.executionMode,
        });
      }

      if (!compareStringFields(current.inputField, previous.inputField)) {
        _.set(fields, 'inputField', {
          status: 'modified',
          previousValue: previous.inputField,
        });
      }

      if (!compareStringFields(current.outputPath, previous.outputPath)) {
        _.set(fields, 'outputPath', {
          status: 'modified',
          previousValue: previous.outputPath,
        });
      }

      if ((current.passThrough || false) !== (previous.passThrough || false)) {
        _.set(fields, 'passThrough', {
          status: 'modified',
          previousValue: previous.passThrough,
        });
      }

      const expressions = compareAndUnifyLists(current?.expressions || [], previous?.expressions || [], {
        compareFields: (current, previous) => {
          const hasKeyChange = !compareStringFields(current.key, previous.key);
          const hasValueChange = !compareStringFields(current.value, previous.value);

          return {
            hasChanges: hasKeyChange || hasValueChange,
            fields: {
              ...(hasKeyChange && {
                key: {
                  status: 'modified',
                  previousValue: previous.key,
                },
              }),
              ...(hasValueChange && {
                value: {
                  status: 'modified',
                  previousValue: previous.value,
                },
              }),
            },
          };
        },
      });

      draft.expressions = expressions;

      if (
        expressions.find(
          (expr) =>
            expr?._diff?.status === 'modified' || expr?._diff?.status === 'added' || expr?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'expressions', {
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
    return newContent;
  },
  inferTypes: {
    needsUpdate: (content, prevContent) => !equal(content, prevContent),
    determineOutputType: ({ input, content }) => {
      let nodeInput = input.clone();
      let determinedType = VariableType.fromJson({ Object: {} });
      if (content.inputField) {
        nodeInput = input.calculateType(content.inputField);
      }

      if (content.executionMode === 'loop') {
        nodeInput = nodeInput.arrayItem();
      }

      (content.expressions || []).forEach((expression) => {
        if (!expression.key || !expression.value) {
          return;
        }

        const calculatedType = nodeInput.calculateType(expression.value);

        nodeInput.set(`$.${expression.key}`, calculatedType);
        determinedType.set(expression.key, calculatedType);
      });

      if (content.executionMode === 'loop') {
        determinedType = determinedType.toArray();
      }

      if (content.outputPath) {
        const newType = VariableType.fromJson({ Object: {} });
        newType.set(content.outputPath, determinedType);
        determinedType = newType;
      }

      if (content.passThrough) {
        determinedType = input.merge(determinedType);
      }

      return determinedType;
    },
  },
  generateNode: ({ index }) => ({
    name: `expression${index}`,
    content: {
      inputField: null,
      outputPath: null,
      expressions: [],
      passThrough: true,
      executionMode: 'single',
    },
  }),
  renderNode: defineComponent({
    name: 'ExpressionNode',
    inheritAttrs: false,
    props: {
      id: { type: String, required: true },
      data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
      selected: { type: Boolean, default: false },
      specification: { type: Object as PropType<MinimalNodeSpecification>, required: true },
    },
    setup(props) {
      const graphActions = useDecisionGraphActions();
      const state = useDecisionGraphState(({ decisionGraph }) => {
        const content = (decisionGraph?.nodes ?? []).find((node) => node.id === props.id)
          ?.content as NodeExpressionData;
        return {
          passThrough: content?.passThrough || false,
          executionMode: content?.executionMode,
        };
      });

      return () =>
        h(GraphNode, {
          id: props.id,
          specification: props.specification,
          name: props.data?.name,
          isSelected: props.selected,
          actions: [
            h(
              Button,
              { key: 'edit-table', type: 'text', onClick: () => graphActions.openTab(props.id) },
              () => 'Edit Expression',
            ),
          ],
          // PORTING: lucide size is number-only (upstream antd icons inherit
          // the 10px status-icon font).
          helper: [
            state.value.executionMode === 'loop' && h(RefreshCw, { size: 12 }),
            state.value.passThrough && h(ArrowRight, { size: 12 }),
          ],
        });
    },
  }),
  renderSettings: defineComponent({
    name: 'ExpressionNodeSettings',
    props: {
      id: { type: String, required: true },
    },
    setup(props) {
      const graphActions = useDecisionGraphActions();
      const inputType = useNodeType(props.id);
      const { contentDiff } = useNodeDiff(props.id);
      const state = useDecisionGraphState(({ decisionGraph, disabled }) => {
        const content = (decisionGraph?.nodes ?? []).find((node) => node.id === props.id)
          ?.content as NodeDecisionTableData;
        return {
          disabled,
          fields: {
            passThrough: content?.passThrough || false,
            inputField: content?.inputField,
            outputPath: content?.outputPath,
            executionMode: content?.executionMode || 'single',
          },
        };
      });

      const updateNode = (data: Partial<NodeExpressionData>) => {
        graphActions.updateNode(props.id, (draft) => {
          Object.assign(draft.content, data);
          return draft;
        });
      };

      return () =>
        h('div', { class: 'settings-form' }, [
          formItem(
            'Passthrough',
            h(DiffSwitch, {
              'disabled': state.value.disabled,
              'displayDiff': contentDiff.value?.fields?.passThrough?.status === 'modified',
              'modelValue': state.value.fields.passThrough,
              'previousChecked': contentDiff.value?.fields?.passThrough?.previousValue,
              'onUpdate:modelValue': (e: boolean) => updateNode({ passThrough: e }),
            }),
          ),
          formItem(
            'Input field',
            h(DiffCodeEditor, {
              'variableType': inputType.value,
              'disabled': state.value.disabled,
              'displayDiff': contentDiff.value?.fields?.inputField?.status === 'modified',
              'previousValue': contentDiff.value?.fields?.inputField?.previousValue,
              'style': { fontSize: 12, lineHeight: '20px', width: '100%' },
              'expectedVariableType': state.value.fields.executionMode === 'loop' ? { Array: 'Any' } : undefined,
              'maxRows': 4,
              'modelValue': state.value.fields.inputField ?? '',
              'onUpdate:modelValue': (val: string) => {
                updateNode({ inputField: val?.trim() || null });
              },
            }),
          ),
          formItem(
            'Output path',
            h(DiffInput, {
              'displayDiff': contentDiff.value?.fields?.outputPath?.status === 'modified',
              'previousValue': contentDiff.value?.fields?.outputPath?.previousValue,
              'modelValue': state.value.fields.outputPath ?? '',
              'readOnly': state.value.disabled,
              'onUpdate:modelValue': (e: string) => updateNode({ outputPath: e?.trim() || null }),
            }),
          ),
          formItem(
            'Execution mode',
            h(DiffRadio, {
              'disabled': state.value.disabled,
              'displayDiff': contentDiff.value?.fields?.executionMode?.status === 'modified',
              'previousValue': contentDiff.value?.fields?.executionMode?.previousValue,
              'modelValue': state.value.fields.executionMode,
              'onUpdate:modelValue': (e: string) =>
                updateNode({ executionMode: e as NodeExpressionData['executionMode'] }),
              'options': [
                {
                  value: 'single',
                  label: 'Single',
                },
                {
                  value: 'loop',
                  label: 'Loop',
                },
              ],
            }),
          ),
        ]);
    },
  }),
};
