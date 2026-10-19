// Ported from components/decision-graph/nodes/specifications/specification-types.ts.
// PORTING(types-only phase A): only the shared type surface + the NodeKind
// enum land now — dg-store.context.ts needs both (NodeKind at runtime in
// addNodes/duplicateNodes); the specification components (specifications and
// the *.specification files) are phase B and import from here unchanged.
// React.ReactNode → VNode, React.FC → Component per docs/PORTING.md.
import { type VariableType } from '@gorules/zen-engine-wasm';
import type { NodeProps } from '@vue-flow/core';
import type { Component, VNode } from 'vue';

import type { DecisionNode } from '../../dg-types';

export enum NodeKind {
  Input = 'inputNode',
  Output = 'outputNode',
  DecisionTable = 'decisionTableNode',
  Function = 'functionNode',
  Expression = 'expressionNode',
  Switch = 'switchNode',
}

// PORTING: reactflow NodeProps → @vue-flow/core NodeProps (same picked keys;
// vue-flow's is a superset).
export type MinimalNodeProps = Pick<NodeProps, 'id' | 'data' | 'selected'>;
export type MinimalNodeSpecification = Pick<
  NodeSpecification,
  'color' | 'icon' | 'displayName' | 'documentationUrl' | 'helper' | 'renderSettings'
>;

type GenerateNodeParams = {
  index: number;
};

export type InferTypeData<T> = {
  input: VariableType;
  content: T;
};

export type NodeSpecification<T = any> = {
  // PORTING: React.ReactNode → VNode | Component (icons arrive either as
  // rendered vnodes or as lucide-vue-next components).
  icon?: VNode | Component;
  type: string;
  // PORTING: upstream types this DecisionNodeProps['color']; decision-node
  // is phase B — its color union is inlined here (swap on port if it widens).
  color?: 'primary' | 'secondary' | string;
  group?: string;
  displayName: string | VNode;
  documentationUrl?: string;
  shortDescription?: string;
  helper?: string | VNode;
  // PORTING: react-dnd is dropped (docs/PORTING.md dependency map) —
  // renderTab receives only the node id (upstream also took `manager`).
  renderTab?: (props: { id: string }) => VNode | null;
  getDiffContent?: (current: T, previous: T) => T;
  generateNode: (params: GenerateNodeParams) => Omit<DecisionNode<T>, 'position' | 'id' | 'type'>;
  // PORTING: React.FC → Component.
  renderNode: Component<MinimalNodeProps & { specification: MinimalNodeSpecification }>;
  renderSettings?: Component<{ id: string }>;
  inferTypes?: {
    needsUpdate: (content: T, prevContent: T) => boolean;
    determineOutputType: (state: InferTypeData<T>) => VariableType;
  };

  onNodeAdd?: (node: DecisionNode<T>) => Promise<DecisionNode<T>>;
};
