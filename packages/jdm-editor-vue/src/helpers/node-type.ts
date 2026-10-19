// Ported from helpers/node-type.ts — now consuming dg-store like upstream
// (the pre-decision-graph stand-in — local enum + InjectionKey, "wiring lands
// with decision-graph" — is retired; the store's detached-bundle fallback
// makes provider-less use return the default empty type instead of crashing).
import { VariableType } from '@gorules/zen-engine-wasm';
import { type ComputedRef, computed } from 'vue';

import {
  type DecisionGraphStoreType,
  NodeTypeKind,
  useDecisionGraphState,
} from '../components/decision-graph/context/dg-store.context';
import { isWasmAvailable } from './wasm';

type NodeTypeParams = {
  attachGlobals?: boolean;
  disabled?: boolean;
};

const getNodeType = (nodeTypes: DecisionGraphStoreType['state']['nodeTypes'], id: string) =>
  nodeTypes[id]?.[NodeTypeKind.Input] ??
  nodeTypes[id]?.[NodeTypeKind.InferredInput] ??
  VariableType.fromJson({ Object: {} });

export const useNodeType = (
  id: string,
  { attachGlobals = true, disabled = false }: NodeTypeParams = {},
): ComputedRef<VariableType | undefined> => {
  const typeInfo = useDecisionGraphState(({ nodeTypes, globalType }) => {
    if (!isWasmAvailable() || disabled) {
      return undefined;
    }

    return { nodeTypes, globalType };
  });

  // PORTING: upstream's useMemo over [typeInfo?.globalType,
  // typeInfo?.nodeTypes, attachGlobals] → computed (reactivity tracks the
  // selected slices).
  return computed(() => {
    if (!typeInfo.value?.nodeTypes) {
      return undefined;
    }

    const nodeType = getNodeType(typeInfo.value.nodeTypes, id);
    if (!attachGlobals) {
      return nodeType;
    }

    Object.entries(typeInfo.value?.globalType ?? {}).forEach(([k, v]) => nodeType.set(k, v));
    return nodeType;
  });
};
