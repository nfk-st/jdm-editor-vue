// Ported from components/function/index.ts.
//
// upstream's barrel is `export * from './function'`, and upstream's
// function.tsx exports only FunctionPermission, FunctionProps and Function.
// The names below are ADDITIVE — upstream does not export them.
export { default as Function } from './function.vue';
export type { FunctionPermission, FunctionProps } from './function.vue';

// PORTING(additive): upstream does not export these. The debugger
// components are what the Function editor renders, and the libraries /
// type helper are what a host needs to offer the same globals to its own
// functions.
export { default as FunctionDebugger } from './function-debugger.vue';
export { default as FunctionDebuggerLog } from './function-debugger-log.vue';
export type { FunctionDebuggerLogData, FunctionDebuggerTrace } from './types';
export { functionDefinitions, functionLibraries } from './helpers/libs';
export { variableTypeToTypescript } from './helpers/determine-type';
