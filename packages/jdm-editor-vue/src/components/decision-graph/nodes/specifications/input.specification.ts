// Ported from components/decision-graph/nodes/specifications/input.specification.tsx.
// PORTING: JSX renderNode body → defineComponent render function (h());
// antd Button/Typography/App.useApp().modal.confirm → ui/Button,
// .grl-typography, in-tree ui/Modal confirm. Icons are stored as functional
// components (a Vue vnode must not be re-mounted across node instances).
import { produce } from 'immer';
import _ from 'lodash';
import { ArrowRightToLine, BookOpen, Trash2 } from 'lucide-vue-next';
import { type PropType, defineComponent, h, ref } from 'vue';
import type { z } from 'zod';

import { platform } from '../../../../helpers/platform';
import { type inputNodeSchema } from '../../../../helpers/schema';
import SpacedText from '../../../spaced-text.vue';
import Button from '../../../ui/Button.vue';
import Modal from '../../../ui/Modal.vue';
import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import type { Diff, DiffMetadata } from '../../dg-types';
// PORTING(P-C): upstream imports TabJsonSchema from '../../graph/tab-json-schema'
// and renders <TabJsonSchema id={id} manager={manager} type={'input'} /> — the
// graph tabs are phase C; restore
// `renderTab: ({ id }) => h(TabJsonSchema, { id, type: 'input' })` when they land.
import type { DecisionNodeMenuItem } from '../decision-node.vue';
import GraphNode from '../graph-node.vue';
import { NodeColor } from './colors';
import type { MinimalNodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';
import type { NodeSpecification } from './specification-types';

type InferredContent = z.infer<typeof inputNodeSchema>['content'];

export type NodeInputData = InferredContent & Diff;

export const inputSpecification: NodeSpecification<NodeInputData> = {
  type: NodeKind.Input,
  icon: () => h(ArrowRightToLine, { style: { width: '1em', height: '1em' } }),
  displayName: 'Request',
  color: NodeColor.Green,
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions',
  shortDescription: 'Provides input context',
  generateNode: () => ({
    name: 'request',
    content: {
      schema: '',
    },
  }),
  renderTab: () => null,
  renderNode: defineComponent({
    name: 'InputNode',
    inheritAttrs: false,
    props: {
      id: { type: String, required: true },
      data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
      selected: { type: Boolean, default: false },
      specification: { type: Object as PropType<MinimalNodeSpecification>, required: true },
    },
    setup(props) {
      const graphActions = useDecisionGraphActions();
      const disabled = useDecisionGraphState(({ disabled }) => disabled);
      // PORTING: antd modal.confirm → local Modal open state.
      const deleteModalOpen = ref(false);

      return () => [
        h(GraphNode, {
          id: props.id,
          specification: props.specification,
          name: props.data?.name,
          isSelected: props.selected,
          handleLeft: false,
          actions: [
            h(
              Button,
              { key: 'edit-table', type: 'text', onClick: () => graphActions.openTab(props.id) },
              () => 'Configure',
            ),
          ],
          menuItems: [
            {
              key: 'documentation',
              icon: h(BookOpen, { size: 12 }),
              label: 'Documentation',
              onClick: () => window.open(props.specification?.documentationUrl, '_href'),
            },
            {
              key: 'delete',
              icon: h(Trash2, { size: 12 }),
              danger: true,
              // PORTING: upstream spreads SpacedText into antd's menu label;
              // ours keeps label a plain vnode.
              label: h(SpacedText, {}, { default: () => 'Delete', right: () => platform.shortcut('Backspace') }),
              disabled: disabled.value,
              onClick: () => (deleteModalOpen.value = true),
            },
          ] as DecisionNodeMenuItem[],
        }),
        h(
          Modal,
          {
            'open': deleteModalOpen.value,
            'title': 'Delete node',
            'width': 416,
            'onUpdate:open': (o: boolean) => (deleteModalOpen.value = o),
          },
          {
            default: () =>
              h('span', { class: 'grl-typography' }, [
                'Are you sure you want to delete ',
                h('span', { class: 'grl-typography', style: { fontWeight: 600 } }, props.data?.name),
                ' node.',
              ]),
            footer: () => [
              h(Button, { onClick: () => (deleteModalOpen.value = false) }, () => 'Cancel'),
              h(
                Button,
                {
                  type: 'primary',
                  danger: true,
                  onClick: () => {
                    deleteModalOpen.value = false;
                    graphActions.removeNodes([props.id]);
                  },
                },
                () => 'OK',
              ),
            ],
          },
        ),
      ];
    },
  }),
  getDiffContent: (current, previous): any => {
    const fields: DiffMetadata['fields'] = {};
    return produce(current || {}, (draft) => {
      if ((current?.schema || '')?.trim?.() !== (previous?.schema || '')?.trim?.()) {
        _.set(fields, 'schema', {
          previousValue: previous?.schema || '',
          status: 'modified',
        });
      }

      const hasModifications = Object.keys(fields).length > 0;

      if (hasModifications) {
        draft._diff = {
          status: 'modified',
          fields,
        };
      }
      return draft;
    });
  },
};
