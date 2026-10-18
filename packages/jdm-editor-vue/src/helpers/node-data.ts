// PORTING: upstream imports these types from ../components —
// DecisionGraphType/DecisionNode ← components/decision-graph/dg-types,
// SimulationTrace ← components/decision-graph/simulator/simulation.types.
// Neither module is ported yet; minimal local stand-ins below — swap to the
// real imports when decision-graph lands.
type DecisionNode = {
  id: string;
  name: string;
  type?: string;
};

type DecisionGraphType = {
  nodes: DecisionNode[];
  edges: unknown[];
};

type SimulationTrace = {
  input: unknown | null;
  output: unknown | null;
  name: string;
  id: string;
};

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
