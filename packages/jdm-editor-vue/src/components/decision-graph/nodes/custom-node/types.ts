// Ported from components/decision-graph/nodes/custom-node/index.tsx.
// PORTING(types-only phase A): only the type surface of upstream's index.tsx
// lives here — `createJdmNode` (incl. its default renderNode) is phase B and
// lands in custom-node/index.ts, re-exporting these types. React.ReactNode →
// VNode, React.FC → Component; react-dnd's DragDropManager is dropped
// (docs/PORTING.md dependency map).
//
// PORTING(names): upstream's generic parameter is named `Component` (it names
// the node KIND, not a Vue component — CONTEXT.md's vocabulary says "kind").
// The declaration rollup resolves Vue's `Component` type back to its own
// name, and the type parameter then SHADOWS it: inside
// CustomNodeSpecification the shipped `renderNode` type collapsed to the
// string parameter (TS2315, and `any` under skipLibCheck). The parameter is
// therefore named `ComponentKind` — the same meaning, upstream's
// CONTEXT.md wording, and no shadowing.
import { type VariableType } from '@gorules/zen-engine-wasm';
import type { XYPosition } from '@vue-flow/core';
import type { VNode, Component as VueComponent } from 'vue';

import type { DecisionNode } from '../../dg-types';
import type { InferTypeData, MinimalNodeProps, MinimalNodeSpecification } from '../specifications/specification-types';

type CustomDecisionNode<T> = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  content?: T;
  // PORTING: reactflow XYPosition → @vue-flow/core XYPosition (same shape).
  position: XYPosition;
};

type GenerateNodeParams = {
  index: number;
};

export type CustomNodeSpecification<Data extends object, ComponentKind extends string> = {
  kind: ComponentKind;
  color?: string;
  icon?: VNode | VueComponent;
  displayName: string;
  group?: string;
  documentationUrl?: string;
  shortDescription?: string;
  // PORTING: react-dnd's DragDropManager dropped — renderTab receives only
  // the node id (upstream also took `manager`).
  renderTab?: (props: { id: string }) => VNode | null;
  calculateDiff?: (current: any, previous: any) => [any, any];
  generateNode: (params: GenerateNodeParams) => Omit<DecisionNode, 'position' | 'id' | 'type' | 'content'> & {
    config?: Data;
  };
  renderNode: VueComponent<MinimalNodeProps & { specification: MinimalNodeSpecification }>;

  inferTypes?: {
    needsUpdate: (state: InferTypeData<Data>, prevState: InferTypeData<Data>) => boolean;
    determineOutputType: (state: InferTypeData<Data>) => VariableType;
  };

  onNodeAdd?: (node: CustomDecisionNode<{ kind: ComponentKind; config: Data }>) => Promise<
    CustomDecisionNode<{
      kind: ComponentKind;
      config: Data;
    }>
  >;
};

type BoolInput = {
  control: 'bool';
  label?: string;
};

type TextInput = {
  control: 'text';
  label?: string;
};

type InputTypeMap = {
  bool: boolean;
  text: string;
};

// PORTING: exported for custom-node/index.ts's createJdmNode (upstream
// declares these in index.tsx itself; our split keeps them with BaseNode).
export type InputSchema<Name extends string> = {
  name: Name;
} & (BoolInput | TextInput);

type ControlToType<T> = T extends keyof InputTypeMap ? InputTypeMap[T] : never;

type SplitPath<Path extends string, Obj> = Path extends `${infer Prefix}.${infer Rest}`
  ? { [K in Prefix]: SplitPath<Rest, Obj> }
  : { [K in Path]: Obj };

type CreateDynamicType<T extends ReadonlyArray<unknown>, Result = {}> = T extends readonly [infer First, ...infer Rest]
  ? First extends { control: infer Control extends string; name: infer Name extends string }
    ? CreateDynamicType<Rest, Result & SplitPath<Name, ControlToType<Control>>>
    : Result
  : Result;

export type BaseNode<
  ComponentKind extends string,
  InputName extends string,
  Inputs extends InputSchema<InputName>[],
  NodeData extends object = CreateDynamicType<Inputs>,
> = {
  kind: ComponentKind;
  icon?: VNode | VueComponent;
  color?: string;
  displayName: string;
  shortDescription?: string;
  group?: string;
  handleLeft?: boolean;
  handleRight?: boolean;
  inputs?: [...Inputs];
  generateNode?: CustomNodeSpecification<NodeData, ComponentKind>['generateNode'];
  renderNode?: CustomNodeSpecification<NodeData, ComponentKind>['renderNode'];
  onNodeAdd?: CustomNodeSpecification<NodeData, ComponentKind>['onNodeAdd'];
};
