// Ported from components/decision-graph/nodes/specifications/decision-table.specification.tsx.
// PORTING: JSX renderNode/renderSettings bodies → defineComponent render
// functions (h()); antd Form.Item/Space → .grl-form-item markup;
// DiffInput/DiffRadio emit values directly (upstream read e.target.value).
// renderTab renders the TabDecisionTable tab (upstream's <TabDecisionTable
// id={id} manager={manager} /> — see the PORTING(DnD) note on the import).
import { VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import _ from 'lodash';
import { ArrowRight, Grid3x3, RefreshCw } from 'lucide-vue-next';
import { type PropType, type VNode, defineComponent, h } from 'vue';
import type { z } from 'zod';

import { useNodeType } from '../../../../helpers/node-type';
import type { decisionTableSchema } from '../../../../helpers/schema';
import { DiffCodeEditor, DiffInput, DiffRadio, DiffSwitch } from '../../../shared';
import Button from '../../../ui/Button.vue';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../../context/dg-store.context';
import type { Diff, DiffMetadata } from '../../dg-types';
import { compareAndUnifyLists } from '../../diff/comparison';
// PORTING(DnD): upstream's renderTab also passed react-dnd's `manager`
// (<TabDecisionTable id={id} manager={manager} />) — dropped with react-dnd
// (docs/PORTING.md dependency map); the tab component takes the id only.
import TabDecisionTable from '../../graph/tab-decision-table.vue';
import GraphNode from '../graph-node.vue';
import type { MinimalNodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';
import type { NodeSpecification } from './specification-types';

type InferredContent = z.infer<typeof decisionTableSchema>['content'];

export type NodeDecisionTableData = Omit<InferredContent, 'inputs' | 'outputs' | 'rules'> &
  Diff & {
    rules: (InferredContent['rules'][0] & Diff)[];
    inputs: (InferredContent['inputs'][0] & Diff)[];
    outputs: (InferredContent['outputs'][0] & Diff)[];
  };

// PORTING: antd Form.Item (vertical layout) → .grl-form-item markup
// (styled in decision-node.scss).
const formItem = (label: string, control: VNode): VNode =>
  h('div', { class: 'grl-form-item' }, [h('label', { class: 'grl-form-item__label' }, label), control]);

export const decisionTableSpecification: NodeSpecification<NodeDecisionTableData> = {
  type: NodeKind.DecisionTable,
  icon: () => h(Grid3x3, { style: { width: '1em', height: '1em' } }),
  displayName: 'Decision table',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/decision-tables',
  shortDescription: 'Rules spreadsheet',
  renderTab: ({ id }) => h(TabDecisionTable, { id }),
  getDiffContent: (current, previous) => {
    return produce(current, (draft) => {
      const fields: DiffMetadata['fields'] = {};
      if ((current.executionMode ?? 'single') !== (previous.executionMode ?? 'single')) {
        _.set(fields, 'executionMode', {
          status: 'modified',
          previousValue: previous.executionMode,
        });
      }

      if ((current.hitPolicy ?? 'first') !== (previous.hitPolicy ?? 'first')) {
        _.set(fields, 'hitPolicy', {
          status: 'modified',
          previousValue: previous.hitPolicy,
        });
      }

      if ((current.inputField ?? '') !== (previous.inputField ?? '')) {
        _.set(fields, 'inputField', {
          status: 'modified',
          previousValue: previous.inputField,
        });
      }

      if ((current.outputPath ?? '') !== (previous.outputPath ?? '')) {
        _.set(fields, 'outputPath', {
          status: 'modified',
          previousValue: previous.outputPath,
        });
      }

      if ((current.passThrough ?? false) !== (previous.passThrough ?? false)) {
        _.set(fields, 'passThrough', {
          status: 'modified',
          previousValue: previous.passThrough,
        });
      }

      const inputs = compareAndUnifyLists(current?.inputs || [], previous?.inputs || [], {
        compareFields: (current, previous) => {
          const hasNameChange = (current.name ?? '') !== (previous.name ?? '');
          const hasFieldChange = (current.field ?? '') !== (previous.field ?? '');
          const hasDefaultValueChange = (current.defaultValue ?? '') !== (previous.defaultValue ?? '');

          return {
            hasChanges: hasNameChange || hasFieldChange || hasDefaultValueChange,
            fields: {
              ...(hasNameChange && {
                name: {
                  status: 'modified',
                  previousValue: previous.name,
                },
              }),
              ...(hasFieldChange && {
                field: {
                  status: 'modified',
                  previousValue: previous.field,
                },
              }),
              ...(hasDefaultValueChange && {
                defaultValue: {
                  status: 'modified',
                  previousValue: previous.defaultValue,
                },
              }),
            },
          };
        },
      });

      const outputs = compareAndUnifyLists(current?.outputs || [], previous?.outputs || [], {
        compareFields: (current, previous) => {
          const hasNameChange = (current.name ?? '') !== (previous.name ?? '');
          const hasFieldChange = (current.field ?? '') !== (previous.field ?? '');
          const hasDefaultValueChange = (current.defaultValue ?? '') !== (previous.defaultValue ?? '');

          return {
            hasChanges: hasNameChange || hasFieldChange || hasDefaultValueChange,
            fields: {
              ...(hasNameChange && {
                name: {
                  status: 'modified',
                  previousValue: previous.name,
                },
              }),
              ...(hasFieldChange && {
                field: {
                  status: 'modified',
                  previousValue: previous.field,
                },
              }),
              ...(hasDefaultValueChange && {
                defaultValue: {
                  status: 'modified',
                  previousValue: previous.defaultValue,
                },
              }),
            },
          };
        },
      });

      const rules = compareAndUnifyLists(current?.rules || [], previous?.rules || [], {
        idField: '_id',
        compareFields: (current, previous) => {
          const hasDescriptionChange = (current._description ?? '') !== (previous._description ?? '');

          const inputChanges: any = {};
          inputs.forEach((input) => {
            if (input._diff?.status === 'added') {
              inputChanges[input.id] = {
                status: 'added',
              };
            } else if (input._diff?.status === 'removed') {
              inputChanges[input.id] = {
                status: 'removed',
              };
            } else if ((current?.[input.id] ?? '') !== (previous?.[input.id] ?? '')) {
              inputChanges[input.id] = {
                status: 'modified',
                previousValue: previous?.[input.id],
              };
            }
          });

          const outputChanges: any = {};
          outputs.forEach((output) => {
            if (output?._diff?.status === 'added') {
              outputChanges[output.id] = {
                status: 'added',
              };
            } else if (output?._diff?.status === 'removed') {
              outputChanges[output.id] = {
                status: 'removed',
              };
            } else if ((current?.[output.id] ?? '') !== (previous?.[output.id] ?? '')) {
              outputChanges[output.id] = {
                status: 'modified',
                previousValue: previous?.[output.id],
              };
            }
          });

          return {
            hasChanges:
              hasDescriptionChange || Object.keys(inputChanges).length > 0 || Object.keys(outputChanges).length > 0,
            fields: {
              ...(hasDescriptionChange && {
                _description: {
                  status: 'modified',
                  previousValue: previous._description,
                },
              }),
              ...inputChanges,
              ...outputChanges,
            },
          };
        },
      });

      draft.inputs = inputs;
      draft.outputs = outputs;
      draft.rules = rules;

      if (
        inputs.find(
          (input) =>
            input?._diff?.status === 'modified' ||
            input?._diff?.status === 'added' ||
            input?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'inputs', {
          status: 'modified',
        });
      }

      if (
        outputs.find(
          (output) =>
            output?._diff?.status === 'modified' ||
            output?._diff?.status === 'added' ||
            output?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'outputs', {
          status: 'modified',
        });
      }

      if (
        rules.find(
          (rule) =>
            rule?._diff?.status === 'modified' || rule?._diff?.status === 'added' || rule?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'rules', {
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
    needsUpdate: (content, prevContent) => !equal(content, prevContent),
    determineOutputType: ({ content, input }) => {
      let nodeInput = input.clone();
      let determinedType = VariableType.fromJson({ Object: {} });
      if (content.inputField) {
        nodeInput = input.calculateType(content.inputField);
      }

      if (content.executionMode === 'loop') {
        nodeInput = nodeInput.arrayItem();
      }

      const outputs = (content?.outputs || []).filter((output) => !!output.field);
      outputs.forEach((output) => {
        for (const rule of content.rules) {
          if (!rule[output.id]) {
            continue;
          }

          const calculatedType = nodeInput.calculateType(rule[output.id]);
          const jsonType = calculatedType.toJson();
          if (jsonType !== 'Any' && jsonType !== 'Null') {
            determinedType.set(output.field, calculatedType);
            return;
          }
        }

        determinedType.setJson(output.field, 'Any');
      });

      if (content.hitPolicy === 'collect') {
        determinedType = determinedType.toArray();
      }

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
    name: `decisionTable${index}`,
    content: {
      hitPolicy: 'first',
      inputs: [
        {
          id: crypto.randomUUID(),
          name: 'Input',
        },
      ],
      outputs: [
        {
          id: crypto.randomUUID(),
          field: 'output',
          name: 'Output',
        },
      ],
      rules: [],
      inputField: null,
      outputPath: null,
      passThrough: true,
      executionMode: 'single',
    },
  }),
  renderNode: defineComponent({
    name: 'DecisionTableNode',
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
          ?.content as NodeDecisionTableData;
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
          // PORTING: lucide size is number-only (upstream antd icons inherit
          // the 10px status-icon font).
          helper: [
            state.value.executionMode === 'loop' && h(RefreshCw, { size: 12 }),
            state.value.passThrough && h(ArrowRight, { size: 12 }),
          ],
          actions: [
            h(
              Button,
              { key: 'edit-table', type: 'text', onClick: () => graphActions.openTab(props.id) },
              () => 'Edit Table',
            ),
          ],
        });
    },
  }),
  renderSettings: defineComponent({
    name: 'DecisionTableNodeSettings',
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
            hitPolicy: content?.hitPolicy || 'first',
          },
        };
      });

      const updateNode = (data: Partial<NodeDecisionTableData>) => {
        graphActions.updateNode(props.id, (draft) => {
          Object.assign(draft.content, data);
          return draft;
        });
      };

      return () =>
        h('div', { class: 'settings-form' }, [
          formItem(
            'Hit Policy',
            // upstream wraps the radio in antd Space (direction vertical,
            // size 2) — styling-only.
            h(DiffRadio, {
              'previousValue': contentDiff.value?.fields?.hitPolicy?.previousValue,
              'displayDiff': contentDiff.value?.fields?.hitPolicy?.status === 'modified',
              'disabled': state.value.disabled,
              'modelValue': state.value.fields.hitPolicy,
              'onUpdate:modelValue': (e: string) => updateNode({ hitPolicy: e as NodeDecisionTableData['hitPolicy'] }),
              'options': [
                {
                  value: 'first',
                  label: 'First',
                },
                {
                  value: 'collect',
                  label: 'Collect',
                },
              ],
            }),
          ),
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
              'onUpdate:modelValue': (val: string) => updateNode({ inputField: val?.trim() || null }),
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
                updateNode({ executionMode: e as NodeDecisionTableData['executionMode'] }),
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
