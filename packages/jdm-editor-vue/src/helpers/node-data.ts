// PORTING: upstream imports these types from ../components —
// DecisionGraphType/DecisionNode ← components/decision-graph/dg-types,
// SimulationTrace ← components/decision-graph/simulator/simulation.types.
// Those modules have landed (step 8), so the local stand-ins below were
// swapped for the real imports.
import type { DecisionGraphType, DecisionNode } from '../components/decision-graph/dg-types';
import type { SimulationTrace } from '../components/decision-graph/simulator/simulation.types';

type NodeDataParams = {
  trace: Record<string, SimulationTrace>;
  decisionGraph: DecisionGraphType;
};

export type GetNodeDataResult = { data: unknown; $nodes: unknown; $?: unknown };

export const getNodeData = (nodeId: string, { trace, decisionGraph }: NodeDataParams): GetNodeDataResult => {
  const data = Object.values(trace).find((t) => t.id === nodeId)?.input;
  const $nodes = Object.fromEntries(
    Object.values(trace)
      .map((t) => {
        const node = decisionGraph.nodes.find((n) => n.id === t.id);
        if (!node || node.type === 'outputNode') {
          return null;
        }

        return [t.name, t.output];
      })
      .filter((s) => !!s),
  );

  return { data, $nodes };
};
