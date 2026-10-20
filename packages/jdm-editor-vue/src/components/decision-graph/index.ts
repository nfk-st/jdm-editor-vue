// Ported from components/decision-graph/index.ts — the module's public
// surface. Mirrors upstream's export list exactly (no more, no less);
// .tsx modules become their .vue counterparts.
export { default as DecisionGraph } from './dg.vue';
export type { DecisionGraphProps, DecisionGraphRef } from './dg.vue';

export type {
  NodeSpecification,
  MinimalNodeSpecification,
  MinimalNodeProps,
} from './nodes/specifications/specification-types';
export type { CustomNodeSpecification } from './nodes/custom-node/index';
export { createJdmNode } from './nodes/custom-node';
export { default as GraphNode, type GraphNodeProps } from './nodes/graph-node.vue';
export {
  default as GraphDecisionNode,
  type DecisionNodeProps as GraphDecisionNodeProps,
} from './nodes/decision-node.vue';
export { default as GraphSimulator, type GraphSimulatorProps } from './simulator/dg-simulator.vue';
export { default as SimulatorEditor } from './simulator/simulator-editor.vue';
export {
  useDecisionGraphState,
  useDecisionGraphActions,
  useDecisionGraphReferences,
  useDecisionGraphListeners,
  useDecisionGraphRaw,
  useNodeDiff,
  useEdgeDiff,
  NodeTypeKind,
} from './context/dg-store.context';
export {
  useGraphSerializer,
  useTabSerializer,
  type DecisionGraphSnapshot,
  type TabSnapshot,
  type Slice,
} from './context/serializer.context';
export { NodeColor } from './nodes/specifications/colors';

export type {
  Simulation,
  SimulationTrace,
  SimulationTraceDataTable,
  SimulationTraceDataFunction,
  SimulationTraceDataExpression,
  SimulationError,
  SimulationOk,
  SimulationTraceDataSwitch,
} from './simulator/simulation.types';

export { nodeSpecification } from './nodes/specifications/specifications';

export { addStrikethrough, buildDiffString, compareAndUnifyLists, compareStringFields } from './diff/comparison';
export { calculateDiffGraph, processEdges, processNodes, type ProcessNodesOptions } from './diff/utility';

export type {
  DecisionEdge,
  DecisionNode,
  DecisionGraphType,
  DiffMetadata,
  Diff,
  Position,
  DiffStatus,
} from './dg-types';
