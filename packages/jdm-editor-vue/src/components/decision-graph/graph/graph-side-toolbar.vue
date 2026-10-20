<script lang="ts">
// Ported from components/decision-graph/graph/graph-side-toolbar.tsx.
// The excel→node mapping derivations are extracted as pure functions for
// vitest coverage (PORTING.md testing rule).
import { NodeKind } from '../../../helpers/schema';
import { parseDecisionTable } from '../../decision-table/context/dt-store.context';
import type { DecisionEdge, DecisionNode } from '../dg-types';
// PORTING: upstream imports the type from './graph-excel-dialog' (a .tsx
// module); our SFC counterpart is graph-excel-dialog.vue, so the import
// carries the .vue extension (dt-command-bar.vue precedent).
import type { MergedDataItem } from './graph-excel-dialog.vue';

const DecisionContentType = 'application/vnd.gorules.decision';

export type GraphSideToolbarProps = {
  //
};

// upstream: handleDataMapping's nodesFromExcel mapping (99-158)
export const mapExcelDataToNodes = (mappedExcelData: MergedDataItem[]): DecisionNode[] => {
  return mappedExcelData.map((excelData) => {
    const inputs = excelData.items
      .filter((item) => item.type === 'input')
      .map((item) => ({
        id: item.id,
        name: item.label,
        field: item.value
          ?.replace(/[^a-zA-Z0-9\s._]/g, '')
          .trim()
          .replace(/\s+/g, '.')
          .toLowerCase(),
      }));

    const outputs = excelData.items
      .filter((item) => item.type === 'output')
      .map((item) => ({
        id: item.id,
        name: item.label,
        field: item.value
          ?.replace(/[^a-zA-Z0-9\s._]/g, '')
          .trim()
          .split(/\s+/)
          .map((word, index) =>
            index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(''),
      }));

    const reducedRules = excelData.rules.map((rule) =>
      rule.reduce(
        (acc: Record<string, any> & { _id: string }, item) => {
          acc[item.headerId] = item.value;
          return acc;
        },
        {
          _id: crypto.randomUUID(),
        },
      ),
    );

    return {
      id: excelData.id,
      name: excelData.name,
      type: NodeKind.DecisionTable,
      content: {
        ...parseDecisionTable({
          inputs,
          outputs,
          rules: reducedRules,
          executionMode: excelData.executionMode || 'single',
          hitPolicy: excelData.hitPolicy || 'first',
          passThrough: excelData.passThrough,
        }),
        inputField: excelData.inputField,
        outputPath: excelData.outputPath,
      },
      position: excelData.position,
    };
  });
};

// upstream: the updated/new node split + findAvailablePosition cascade
// (160-193). New nodes land on the first free row, cascading right.
export const mergeExcelNodes = (
  existingNodes: DecisionNode[],
  nodesFromExcel: DecisionNode[],
): { updatedNodes: DecisionNode[]; newNodes: DecisionNode[] } => {
  const updatedNodes = existingNodes.map((node) => {
    let _node = node;
    // updating existing nodes
    nodesFromExcel.forEach((excelNode) => {
      if (excelNode.id === node.id) _node = { ...node, content: excelNode.content };
    });

    return _node;
  });

  // filtering new nodes and setting them proper position
  const newNodes = nodesFromExcel
    .filter((node) => !updatedNodes.some((existingNode) => existingNode.id === node.id))
    .map((newNode, index) => ({
      ...newNode,
      type: NodeKind.DecisionTable,
      position: (() => {
        const findAvailablePosition = (x: number, y: number): { x: number; y: number } => {
          const position = { x, y };

          if (existingNodes.some((node) => node.position.x === position.x && node.position.y === position.y)) {
            return findAvailablePosition(x + 250, y);
          }

          return position;
        };

        const availablePosition = findAvailablePosition(0, 0);

        return { x: availablePosition.x + index * 250, y: 0 };
      })(),
    }));

  return { updatedNodes, newNodes };
};

export { DecisionContentType };
</script>

<script setup lang="ts">
// PORTING: antd Dropdown → reka-ui DropdownMenu (switch.specification
// precedent); antd message → console stand-in (use-graph-clipboard
// precedent); panel icons (VNode | Component) render through IconView.
import { CloudDownload, CloudUpload } from 'lucide-vue-next';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import { type Component, type PropType, type VNode, computed, defineComponent, h, isVNode, ref } from 'vue';

import type { ParsedExcelData } from '../../../helpers/excel';
import { exportDecisionTable, getExcelData } from '../../../helpers/excel';
import { decisionModelSchema } from '../../../helpers/schema';
import Button from '../../ui/Button.vue';
import Tooltip from '../../ui/Tooltip.vue';
import { useDecisionGraphActions, useDecisionGraphRaw, useDecisionGraphState } from '../context/dg-store.context';
import GraphExcelDialog from './graph-excel-dialog.vue';

// PORTING: antd message.success/error → console (no toast primitive in ui/
// yet; swap when one lands — docs/PORTING.md known temp debt).
const message = {
  success: (m: string) => console.info(m),
  error: (m: string) => console.error(m),
};

// renders the VNode | Component panel icons (decision-node.vue's VNodeView)
const IconView = defineComponent({
  name: 'IconView',
  props: { node: { type: [Object, Function] as PropType<VNode | Component | null>, default: null } },
  setup: (props) => () => (isVNode(props.node) ? props.node : props.node ? h(props.node as Component) : null),
});

const decisionGraphRaw = useDecisionGraphRaw();
const fileInput = ref<HTMLInputElement | null>(null);
const excelFileInput = ref<HTMLInputElement | null>(null);
const excelGraphData = ref<ParsedExcelData[] | null | undefined>(undefined);

const { setDecisionGraph, setActivePanel } = useDecisionGraphActions();
const state = useDecisionGraphState(({ disabled, panels, activePanel, viewConfig }) => ({
  disabled,
  panels,
  activePanel,
  viewConfig,
}));

const handleUploadInput = async (event: Event) => {
  const fileList = (event?.target as HTMLInputElement)?.files as FileList;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed: any = JSON.parse(e?.target?.result as string);
      if (parsed?.contentType !== DecisionContentType) {
        throw new Error('Invalid content type');
      }

      const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const nodeIds = nodes.map((node: DecisionNode) => node.id);

      const edges = (parsed.edges as DecisionEdge[]).filter(
        (edge) => nodeIds.includes(edge?.targetId) && nodeIds.includes(edge?.sourceId),
      );

      const modelParsed = decisionModelSchema.safeParse({
        nodes,
        edges,
        settings: parsed?.settings,
      });

      if (!modelParsed.success) {
        console.log(modelParsed.error?.message);
        message.error(modelParsed.error?.message);
        return;
      }

      setDecisionGraph(modelParsed.data as never);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  reader.readAsText(Array.from(fileList)?.[0], 'UTF-8');
};

const uploadJDMExcel = (event: Event) => {
  const file = (event?.target as HTMLInputElement)?.files?.[0];
  const fileReader = new FileReader();

  try {
    // PORTING: upstream reads `event?.target?.files[0]` (untyped `any`);
    // our DOM-typed read yields `File | undefined`, so the value is narrowed
    // to `File` here — the runtime value passed to readAsArrayBuffer is
    // unchanged.
    fileReader.readAsArrayBuffer(file as File);
    fileReader.onload = async () => {
      const buffer = fileReader.result as ArrayBuffer;

      if (!buffer) return;
      const { decisionGraph } = decisionGraphRaw.stateStore.getState();

      const excelData = await getExcelData(buffer, decisionGraph as never);

      excelGraphData.value = excelData;

      message.success('Excel file has been uploaded successfully!');
    };
  } catch {
    message.error('Failed to upload Excel!');
  }
};

const handleDataMapping = (mappedExcelData: MergedDataItem[]) => {
  const nodesFromExcel = mapExcelDataToNodes(mappedExcelData);

  const { decisionGraph } = decisionGraphRaw.stateStore.getState();

  const { updatedNodes, newNodes } = mergeExcelNodes(decisionGraph.nodes, nodesFromExcel);

  const modelParsed = decisionModelSchema.safeParse({
    nodes: [...updatedNodes, ...newNodes],
    edges: decisionGraph.edges,
  });

  if (!modelParsed.success) {
    console.log(modelParsed.error?.message);
    message.error(modelParsed.error?.message);
    return;
  }

  setDecisionGraph(modelParsed.data as never);
  excelGraphData.value = null;
};

const downloadJDM = async () => {
  try {
    const { name, decisionGraph } = decisionGraphRaw.stateStore.getState();
    // create file in browser
    const fileName = `${name.replaceAll('.json', '')}.json`;
    const json = JSON.stringify(
      {
        contentType: DecisionContentType,
        nodes: decisionGraph.nodes,
        edges: decisionGraph.edges,
      },
      null,
      2,
    );
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);

    // create "a" HTLM element with href to file
    const link = window.document.createElement('a');
    link.href = href;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();

    // clean up "a" element & remove ObjectURL
    window.document.body.removeChild(link);
    URL.revokeObjectURL(href);
  } catch (e: any) {
    message.error(e.message);
  }
};

const downloadJDMExcel = async () => {
  try {
    const { name, decisionGraph, viewConfig } = decisionGraphRaw.stateStore.getState();
    const fileName = name.replaceAll('.json', '');

    const decisionTableNodes = decisionGraph.nodes
      .filter((node) => node.type === NodeKind.DecisionTable)
      .filter((node) => (viewConfig?.enabled ? !!viewConfig?.permissions?.[node.id] : true))
      .map((decisionTable) => ({
        ...decisionTable.content,
        id: decisionTable.id,
        name: decisionTable.name,
      }));

    await exportDecisionTable(fileName, decisionTableNodes);
    message.success('Excel file has been downloaded successfully!');
  } catch {
    message.error('Failed to download Excel file!');
  }
};

type MenuItem = { key: string; label: string; onClick: () => void };

const uploadItems = computed<MenuItem[]>(
  () =>
    [
      !state.value.viewConfig?.enabled && {
        key: 'upload-json',
        label: 'Upload JSON',
        onClick: () => fileInput.value?.click?.(),
      },
      {
        key: 'upload-excel',
        label: 'Upload Excel',
        onClick: () => excelFileInput.value?.click?.(),
      },
    ].filter((item) => !!item) as MenuItem[],
);

const downloadItems = computed<MenuItem[]>(
  () =>
    [
      !state.value.viewConfig?.enabled && {
        key: 'download-json',
        label: 'Download JSON',
        onClick: () => void downloadJDM(),
      },
      {
        key: 'download-excel',
        label: 'Download Excel',
        onClick: () => void downloadJDMExcel(),
      },
    ].filter((item) => !!item) as MenuItem[],
);
</script>

<template>
  <div class="grl-dg__aside">
    <input
      hidden
      accept="application/json"
      type="file"
      ref="fileInput"
      @change="handleUploadInput"
      @click="(event) => ((event.target as HTMLInputElement).value = null as never)"
    />
    <input
      hidden
      accept=".xlsx"
      type="file"
      ref="excelFileInput"
      @change="uploadJDMExcel"
      @click="(event) => ((event.target as HTMLInputElement).value = null as never)"
    />
    <div class="grl-dg__aside__side-bar">
      <div class="grl-dg__aside__side-bar__top">
        <DropdownMenuRoot v-if="!state.disabled">
          <DropdownMenuTrigger as-child>
            <Button type="text" :disabled="state.disabled">
              <template #icon><CloudUpload :size="14" /></template>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent class="grl-context-menu" align="end" :side-offset="4">
              <DropdownMenuItem
                v-for="item in uploadItems"
                :key="item.key"
                class="grl-context-menu__item"
                @select="item.onClick"
              >
                {{ item.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
        <DropdownMenuRoot>
          <DropdownMenuTrigger as-child>
            <Button type="text">
              <template #icon><CloudDownload :size="14" /></template>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent class="grl-context-menu" align="end" :side-offset="4">
              <DropdownMenuItem
                v-for="item in downloadItems"
                :key="item.key"
                class="grl-context-menu__item"
                @select="item.onClick"
              >
                {{ item.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
      <div class="grl-dg__aside__side-bar__bottom">
        <Tooltip
          v-for="panel in state.panels || []"
          :key="panel.id"
          :content="`${state.activePanel === panel.id ? 'Close' : 'Open'} ${panel.title.toLowerCase()} panel`"
        >
          <Button
            type="text"
            :style="{ background: state.activePanel === panel.id ? 'rgba(0, 0, 0, 0.1)' : undefined }"
            @click="
              () => {
                if (panel?.onClick) return panel.onClick();
                if (panel?.renderPanel) setActivePanel(state.activePanel === panel.id ? undefined : panel.id);
              }
            "
          >
            <template #icon><IconView :node="panel.icon" /></template>
          </Button>
        </Tooltip>
      </div>
    </div>

    <GraphExcelDialog
      :excel-data="excelGraphData"
      :handle-success="handleDataMapping"
      :handle-cancel="() => (excelGraphData = null)"
    />
  </div>
</template>
