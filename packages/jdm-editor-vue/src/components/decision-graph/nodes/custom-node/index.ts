// Ported from components/decision-graph/nodes/custom-node/index.tsx.
// PORTING(types-only phase A): the registry types the store and the
// specifications share (upstream exports them from this module). The
// component half — `createJdmNode` with its default renderNode — lands in
// phase B in this file, alongside the re-exports below.
export type { BaseNode, CustomNodeSpecification } from './types';
export type { CheckboxControl, JdmControl, TextControl } from './controls';
