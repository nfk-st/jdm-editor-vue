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

// PORTING: SimulationTrace/SimulationTraceDataFunction live upstream in
// components/decision-graph/simulator/simulation.types (module #8, not ported
// yet) — one minimal shared stand-in beside the debugger types (instead of
// per-file copies, per PORTING.md known temp debt); swap at step 8.
export type SimulationTraceDataFunction = {
  log?: FunctionDebuggerLogData[];
};

export type SimulationTrace<Trace = SimulationTraceDataFunction> = {
  traceData: Trace | null;
};
