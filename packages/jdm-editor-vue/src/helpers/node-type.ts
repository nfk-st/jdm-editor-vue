import { VariableType } from '@gorules/zen-engine-wasm';
import { computed, inject, type ComputedRef, type InjectionKey } from 'vue';

import { isWasmAvailable } from './wasm';

type NodeTypeParams = {
  attachGlobals?: boolean;
  disabled?: boolean;
};

// PORTING: wire to dg-store when decision-graph lands — upstream imports
// `NodeTypeKind` and `useDecisionGraphState` from
// ../components/decision-graph/context/dg-store.context, which does not exist
// yet. Local enum + InjectionKey stand in until then; the provider will
// supply a reactive `{ nodeTypes, globalType }` slice of the dg-store state.
enum NodeTypeKind {
  Input,
  Output,
  InferredInput,
  InferredOutput,
}

// PORTING: minimal slice of upstream DecisionGraphStoreType['state'].
type DecisionGraphState = {
  nodeTypes: Record<string, Partial<Record<NodeTypeKind, VariableType>>>;
  globalType: Record<string, VariableType>;
};

// PORTING: wire to dg-store when decision-graph lands.
const DecisionGraphStateKey: InjectionKey<DecisionGraphState | undefined> = Symbol('jdm-dg-state');

const getNodeType = (nodeTypes: DecisionGraphState['nodeTypes'], id: string) =>
  nodeTypes[id]?.[NodeTypeKind.Input] ??
  nodeTypes[id]?.[NodeTypeKind.InferredInput] ??
  VariableType.fromJson({ Object: {} });

export const useNodeType = (
  id: string,
  { attachGlobals = true, disabled = false }: NodeTypeParams = {},
): ComputedRef<VariableType | undefined> => {
  const typeInfo = inject(DecisionGraphStateKey, undefined);

  return computed(() => {
    if (!isWasmAvailable() || disabled) {
      return undefined;
    }

    if (!typeInfo?.nodeTypes) {
      return undefined;
    }

    const nodeType = getNodeType(typeInfo.nodeTypes, id);
    if (!attachGlobals) {
      return nodeType;
    }

    Object.entries(typeInfo.globalType ?? {}).forEach(([k, v]) => nodeType.set(k, v));
    return nodeType;
  });
};
