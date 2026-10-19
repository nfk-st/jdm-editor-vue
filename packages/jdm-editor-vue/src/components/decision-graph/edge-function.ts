// Ported from custom-edge.tsx's edgeFunction export (sibling module — an SFC
// cannot self-import for the factory).
// upstream: export const edgeFunction = (outer) => (props) => <CustomEdge {...props} {...outer} />
// PORTING: vue-flow edge types take a component directly; the factory is kept
// for specification parity.
import { h } from 'vue';

import CustomEdge from './custom-edge.vue';

export const edgeFunction =
  (outer: Record<string, unknown> = {}) =>
  (edgeProps: Record<string, unknown>) =>
    h(CustomEdge, { ...edgeProps, ...outer });
