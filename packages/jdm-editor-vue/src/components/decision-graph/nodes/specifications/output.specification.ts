// Ported from components/decision-graph/nodes/specifications/output.specification.tsx.
// PORTING: JSX renderNode body → defineComponent render function (h());
// antd Button → ui/Button. renderTab renders the TabJsonSchema tab in its
// 'output' flavour (upstream's <TabJsonSchema id={id} manager={manager}
// type={'output'} /> — see the PORTING(DnD) note on the import).
import { produce } from 'immer';
import _ from 'lodash';
import { ArrowRightFromLine } from 'lucide-vue-next';
import { type PropType, defineComponent, h } from 'vue';
import type { z } from 'zod';

import { type outputNodeSchema } from '../../../../helpers/schema';
import Button from '../../../ui/Button.vue';
import { useDecisionGraphActions } from '../../context/dg-store.context';
import type { Diff, DiffMetadata } from '../../dg-types';
// PORTING(DnD): upstream's renderTab also passed react-dnd's `manager`
// (<TabJsonSchema id={id} manager={manager} type={'output'} />) — dropped with
// react-dnd (docs/PORTING.md dependency map); the tab component takes the id
// and the type only.
import TabJsonSchema from '../../graph/tab-json-schema.vue';
import GraphNode from '../graph-node.vue';
import { NodeColor } from './colors';
import type { MinimalNodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';
import type { NodeSpecification } from './specification-types';

type InferredContent = z.infer<typeof outputNodeSchema>['content'];

export type NodeOutputData = InferredContent & Diff;

export const outputSpecification: NodeSpecification<NodeOutputData> = {
  type: NodeKind.Output,
  icon: () => h(ArrowRightFromLine, { style: { width: '1em', height: '1em' } }),
  color: NodeColor.Green,
  displayName: 'Response',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions',
  shortDescription: 'Outputs the context',
  generateNode: () => ({ name: 'response', content: { schema: '' } }),
  renderTab: ({ id }) => h(TabJsonSchema, { id, type: 'output' }),
  renderNode: defineComponent({
    name: 'OutputNode',
    inheritAttrs: false,
    props: {
      id: { type: String, required: true },
      data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
      selected: { type: Boolean, default: false },
      specification: { type: Object as PropType<MinimalNodeSpecification>, required: true },
    },
    setup(props) {
      const graphActions = useDecisionGraphActions();
      return () =>
        h(GraphNode, {
          id: props.id,
          specification: props.specification,
          name: props.data?.name,
          isSelected: props.selected,
          handleRight: false,
          actions: [
            h(
              Button,
              { key: 'edit-table', type: 'text', onClick: () => graphActions.openTab(props.id) },
              () => 'Configure',
            ),
          ],
        });
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
