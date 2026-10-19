// Ported from components/decision-graph/hooks/use-graph-clipboard.ts.
// PORTING: React hook → composable (same name/exports; useCallback/useMemo
// dropped — a composable body runs once per setup). reactflow's
// ReactFlowInstance → @vue-flow/core's VueFlowStore (the useVueFlow/onInit
// instance): refs read via `.value` and the getNodes()/getEdges() instance
// methods become the `.getNodes.value`/`.getEdges.value` ComputedRef getters.
// `project` exists on the VueFlowStore directly (deprecated alias of
// screenToFlowCoordinate) — kept for body parity. antd message → console
// stand-in (dt-command-bar precedent).
import type { Node, VueFlowStore, XYPosition } from '@vue-flow/core';
import type { Ref } from 'vue';

import { copyToClipboard, pasteFromClipboard } from '../../../helpers/utility';
import { useDecisionGraphActions, useDecisionGraphRaw } from '../context/dg-store.context';
import { type DecisionEdge, type DecisionNode } from '../dg-types';

// PORTING: antd message.success/error → console (no toast primitive in ui/
// yet; swap when one lands — docs/PORTING.md known temp debt).
const message = {
  success: (m: string) => console.info(m),
  error: (m: string) => console.error(m),
};

type ClipboardData = {
  nodes: DecisionNode[];
  edges?: DecisionEdge[];
};

const isClipboardData = (data: any): data is ClipboardData => {
  if (typeof data !== 'object') return false;
  return Array.isArray(data?.nodes);
};

export const useGraphClipboard = (reactFlow: Ref<VueFlowStore | null>, wrapper: Ref<HTMLDivElement | null>) => {
  const raw = useDecisionGraphRaw();
  const graphActions = useDecisionGraphActions();

  const copyNodes = async (nodes: Node[]) => {
    try {
      if (!reactFlow.value) {
        return;
      }

      const copyNodes = (raw.stateStore.getState()?.decisionGraph?.nodes || []).filter((n) =>
        nodes.some((node) => node.id === n.id),
      );

      const copyNodeIds = copyNodes.map((n) => n.id);
      const copyEdges: DecisionEdge[] = [];

      if (copyNodes.length > 0) {
        const edges = reactFlow.value.getEdges.value;
        edges.forEach((edge) => {
          if (copyNodeIds.includes(edge.source) && copyNodeIds.includes(edge.target)) {
            copyEdges.push({
              id: edge.id,
              type: edge.type,
              sourceId: edge.source,
              targetId: edge.target,
              sourceHandle: edge.sourceHandle ?? undefined,
              targetHandle: edge.targetHandle ?? undefined,
            });
          }
        });
      }

      const clipboardData: ClipboardData = {
        nodes: copyNodes,
        edges: copyEdges,
      };

      await copyToClipboard(JSON.stringify(clipboardData));
      message.success('Copied to clipboard!');
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const pasteNodes = async () => {
    try {
      if (!reactFlow?.value) {
        return;
      }

      const clipboardText = await pasteFromClipboard();
      if (!clipboardText) {
        return;
      }
      const clipboardData = JSON.parse(clipboardText);

      if (!isClipboardData(clipboardData)) {
        throw new Error('invalid clipboard');
      }

      const nodeIds: Record<string, string> = clipboardData.nodes.reduce(
        (acc, curr) => ({
          ...acc,
          [curr.id]: crypto.randomUUID(),
        }),
        {},
      );

      const copyNodeIds = Object.keys(nodeIds);
      const anchor = reactFlow.value.getNodes.value.find((n) => copyNodeIds.includes(n.id));
      const copyAnchor = clipboardData.nodes.find((n) => n.id === anchor?.id);
      const gravityCenter = {
        x: clipboardData.nodes.reduce((acc, n) => acc + n.position.x, 0) / clipboardData.nodes.length,
        y: clipboardData.nodes.reduce((acc, n) => acc + n.position.y, 0) / clipboardData.nodes.length,
      } as XYPosition;

      const nodes = clipboardData.nodes.map((n: DecisionNode) => {
        const position: XYPosition = {
          x: n?.position?.x || 0,
          y: n?.position?.y || 0,
        };

        if (anchor && copyAnchor) {
          const isAnchor = n.id === anchor.id;

          if (isAnchor) {
            position.x = anchor.position.x;
            position.y = anchor.position.y - 20;
          } else {
            position.x = anchor.position.x - copyAnchor.position.x + n.position.x;
            position.y = anchor.position.y - copyAnchor.position.y + n.position.y - 20;
          }
        } else if (wrapper.value) {
          const rect = wrapper.value.getBoundingClientRect();
          const rectCenter = {
            x: rect.width / 2,
            y: rect.height / 2,
          };

          const projection = reactFlow.value!.project(rectCenter);

          position.x = n.position.x + projection.x - gravityCenter.x / 2;
          position.y = n.position.y + projection.y - gravityCenter.y / 2;
        }

        return {
          ...n,
          position,
          id: nodeIds[n.id],
        };
      });

      const edges = (clipboardData.edges || []).map<DecisionEdge>((e) => ({
        id: crypto.randomUUID(),
        type: e.type,
        sourceId: nodeIds[e.sourceId],
        targetId: nodeIds[e.targetId],
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      }));

      graphActions.addNodes(nodes);
      graphActions.addEdges(edges);
      message.success('Pasted from clipboard!');

      if (anchor) {
        try {
          await copyToClipboard(JSON.stringify({ nodes }));
        } catch {
          //
        }
      }
    } catch {
      message.error('Failed to paste from clipboard');
    }
  };

  return {
    copyNodes,
    pasteNodes,
  };
};
