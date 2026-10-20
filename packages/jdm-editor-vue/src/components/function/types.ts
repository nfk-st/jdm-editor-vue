export type FunctionDebuggerLogData = {
  lines: string[];
  msSinceRun: number;
};

export type FunctionDebuggerTrace = {
  performance: string;
  traceData: {
    log: FunctionDebuggerLogData[];
  };
};

// PORTING(sweep): SimulationTrace stand-ins retired — canonical types
// re-exported from decision-graph's simulator (upstream imports from there).
export type { SimulationTrace, SimulationTraceDataFunction } from '../decision-graph/simulator/simulation.types';
