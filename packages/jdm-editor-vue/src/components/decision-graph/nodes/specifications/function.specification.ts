// Ported from components/decision-graph/nodes/specifications/function.specification.tsx.
// PORTING: JSX bodies → defineComponent render functions; antd
// Button/Tooltip/Typography → ui/Button + ui/Tooltip + .grl-typography;
// @ant-design/icons WarningFilled → lucide CircleAlert. renderTab's
// TabFunction is phase C (see input.specification.ts note).
import _ from 'lodash';
import { CircleAlert } from 'lucide-vue-next';
import { P, match } from 'ts-pattern';
import { type PropType, type VNode, defineComponent, h } from 'vue';

import { defaultFunctionValue } from '../../../function/helpers/libs';
import Button from '../../../ui/Button.vue';
import Tooltip from '../../../ui/Tooltip.vue';
import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import type { DiffMetadata } from '../../dg-types';
// PORTING(P-C): import { TabFunction } from '../../graph/tab-function'
import GraphNode from '../graph-node.vue';
import { NodeColor } from './colors';
import type { MinimalNodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';
import type { NodeSpecification } from './specification-types';

export type NodeFunctionData =
  | string
  | {
      source: string;
    };

export const functionSpecification: NodeSpecification<NodeFunctionData> = {
  type: NodeKind.Function,
  icon: () => h('span', { class: 'grl-typography', style: { color: 'white', fontSize: 'inherit' } }, 'JS'),
  displayName: 'Function',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/functions',
  shortDescription: 'Javascript lambda',
  color: NodeColor.Orange,
  renderTab: () => null,
  getDiffContent: (current, previous): any => {
    const fields: DiffMetadata['fields'] = {};
    const kind = match(current)
      .with(P.string, () => FunctionKind.Deprecated)
      .otherwise(() => FunctionKind.Stable);

    match([current, previous])
      .with([P.string, P.string], ([current, previous]) => {
        if (current !== previous) {
          _.set(fields, 'source', {
            previousValue: previous,
            status: 'modified',
          });
        }
      })
      .with([{ source: P.string }, { source: P.string }], ([current, previous]) => {
        if (current?.source !== previous?.source) {
          _.set(fields, 'source', {
            previousValue: previous.source,
            status: 'modified',
          });
        }
      })
      .otherwise(() => {
        // do nothing
      });

    const hasModifications = Object.keys(fields).length > 0;
    return {
      ...(kind === FunctionKind.Deprecated ? { source: current } : (current as { source: string })),
      ...(hasModifications && {
        _diff: {
          status: 'modified',
          fields,
        },
      }),
    };
  },
  generateNode: ({ index }) => ({
    name: `function${index}`,
    content: {
      source: defaultFunctionValue,
    },
  }),
  renderNode: defineComponent({
    name: 'FunctionNode',
    inheritAttrs: false,
    props: {
      id: { type: String, required: true },
      data: { type: Object as PropType<{ name?: string; kind?: string }>, default: () => ({}) },
      selected: { type: Boolean, default: false },
      specification: { type: Object as PropType<MinimalNodeSpecification>, required: true },
    },
    setup(props) {
      const graphActions = useDecisionGraphActions();
      const kind = useFunctionKind(props.id);
      return () =>
        h(GraphNode, {
          specification: {
            ...props.specification,
            displayName:
              kind.value === FunctionKind.Stable
                ? 'Function'
                : h('span', {}, ['Function v1 ', h(DeprecatedFunctionWarning, { size: 16 })]),
          },
          id: props.id,
          name: props.data?.name,
          isSelected: props.selected,
          helper: [kind.value === FunctionKind.Deprecated && h(DeprecatedFunctionWarning, { size: 16 })],
          actions: [
            h(
              Button,
              { key: 'edit-function', type: 'text', onClick: () => graphActions.openTab(props.id) },
              () => 'Edit Function',
            ),
          ],
        });
    },
  }),
};

export enum FunctionKind {
  Deprecated,
  Stable,
}

export const useFunctionKind = (id: string) => {
  // PORTING: returns a ComputedRef (upstream returns the plain selected value).
  const kind = useDecisionGraphState((s) =>
    match(s.decisionGraph.nodes.find((n) => n.id === id)?.content)
      .with(P.string, () => FunctionKind.Deprecated)
      .otherwise(() => FunctionKind.Stable),
  );

  return kind;
};

// upstream: const DeprecatedFunctionWarning: React.FC<{ size?: number }>
const DeprecatedFunctionWarning = ({ size }: { size?: number }): VNode =>
  h(
    Tooltip,
    {
      content:
        'Function v1 will be deprecated in one of the upcoming releases. To use a new Function, drag and drop a new Function Node and copy your logic. For more information click "Documentation". ',
    },
    { default: () => h(CircleAlert, { size, style: { color: 'var(--grl-color-warning-text)', fontSize: size } }) },
  );
