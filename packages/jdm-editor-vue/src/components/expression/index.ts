// Ported from components/expression/index.ts.
//
// upstream's barrel is `export * from './expression'`, and upstream's
// expression.tsx exports only ExpressionProps and Expression. The names
// below are ADDITIVE — upstream does not export them.
export { default as Expression } from './expression.vue';
export type { ExpressionProps } from './expression.vue';

// PORTING(additive): upstream does not export these. ExpressionEntry is the
// type of <Expression>'s modelValue, so a consumer cannot type its own
// state without it; the store hooks let a host read the expression list.
export type { ExpressionControllerProps } from './expression-controller.vue';
export type { ExpressionEntry, ExpressionPermission, ExpressionStore } from './context/expression-store.context';
export {
  createExpression,
  useExpressionStore,
  useExpressionStoreRaw,
  provideExpressionStore,
} from './context/expression-store.context';
