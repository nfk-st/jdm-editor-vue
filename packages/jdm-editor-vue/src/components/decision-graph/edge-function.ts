// Ported from custom-edge.tsx's edgeFunction export (sibling module — an SFC
// cannot self-import for the factory).
// upstream: export const edgeFunction = (outer) => (props) => <CustomEdge {...props} {...outer} />
// PORTING: vue-flow edge types take a component directly; the factory is kept
// for specification parity.
import { h } from 'vue';

import CustomEdge, { type CustomEdgeProps } from './custom-edge.vue';

export const edgeFunction =
  (outer: Record<string, unknown> = {}) =>
  (edgeProps: CustomEdgeProps) =>
    // PORTING: upstream's `outer` bag is untyped (react-flow's outer props) and
    // is spread over the edge props; the cast keeps that shape while the
    // component's own props stay typed.
    h(CustomEdge, { ...edgeProps, ...outer } as unknown as CustomEdgeProps);
