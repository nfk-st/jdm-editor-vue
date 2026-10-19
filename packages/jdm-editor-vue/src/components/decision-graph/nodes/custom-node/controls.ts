// Ported from components/decision-graph/nodes/custom-node/controls.ts
// (types-only, no React surface — verbatim).
export type TextControl = {
  control: 'text';
  default?: string;
};

export type CheckboxControl = {
  control: 'checkbox';
  default?: boolean;
};

export type JdmControl = TextControl | CheckboxControl;
