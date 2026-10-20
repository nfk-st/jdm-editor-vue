<script lang="ts">
// Ported from components/decision-graph/graph/graph-tabs.tsx.
// The tab derivations (the open-node list and the context-menu entries) are
// extracted as pure functions for vitest coverage (PORTING.md testing rule).
import { type Component, type PropType, type VNode, computed, defineComponent, h, isVNode } from 'vue';

import type { DecisionGraphType, DiffStatus } from '../dg-types';

export type GraphTabsProps = {
  disabled?: boolean;
  // PORTING: upstream's `tabBarExtraContent?: TabsProps['tabBarExtraContent']`
  // (a ReactNode prop) becomes the `#extra` slot — upstream render props
  // become Vue slots (docs/PORTING.md's React → Vue table).
};

// upstream: the openTabs → node mapping (graph-tabs.tsx:26-38)
export type GraphTabNode = {
  id: string;
  name: string;
  type?: string;
  diff?: { status: DiffStatus };
};

// upstream: the TabLabel props (graph-tabs.tsx:104-113)
export type GraphTabLabel = {
  key: string;
  // upstream's TabLabel index (-1 for the graph tab)
  index: number;
  total: number;
  icon?: VNode | Component;
  name: string;
  color: string;
  diffStatus?: DiffStatus;
  active: boolean;
  // upstream renders the close button only when onClose is given
  closable: boolean;
};

// upstream: the context-menu action keys (graph-tabs.tsx:115-147) — they are
// the actions the store's closeTab understands.
export type TabContextAction = 'close' | 'close-all' | 'close-other' | 'close-right' | 'close-left';

export type TabContextItem = {
  key: TabContextAction;
  label: string;
};

// upstream: the useDecisionGraphState selector body (graph-tabs.tsx:24-41)
export const buildOpenTabNodes = (
  decisionGraph: DecisionGraphType | undefined,
  openTabs: string[] | undefined,
): GraphTabNode[] =>
  (openTabs || [])
    .map((tab) => {
      const node = (decisionGraph?.nodes ?? []).find((node) => node.id === tab);
      if (!node) return undefined;

      return {
        id: node?.id,
        name: node.name,
        type: node.type,
        diff: node?._diff,
      };
    })
    .filter((node) => !!node) as GraphTabNode[];

// upstream: TabLabel's dropdown items (graph-tabs.tsx:115-147)
export const buildTabContextItems = (total: number, index: number): TabContextItem[] => {
  const items: (TabContextItem | false)[] = [
    total > 0 &&
      index !== -1 && {
        key: 'close',
        label: 'Close',
      },
    total > 0 &&
      index !== -1 && {
        key: 'close-all',
        label: 'Close all Tabs',
      },
    total > 0 &&
      index !== -1 && {
        key: 'close-other',
        label: 'Close other Tabs',
      },
    total > 0 &&
      index + 1 < total && {
        key: 'close-right',
        label: 'Close Tabs to the right',
      },
    total > 0 &&
      index > 0 &&
      index > 0 && {
        key: 'close-left',
        label: 'Close Tabs to the left',
      },
  ];

  return items.filter((item): item is TabContextItem => !!item);
};
</script>

<script setup lang="ts">
// PORTING: antd Tabs → ui/Tabs.vue (Reka UI — the tab labels ride in its
// #label slot); antd Avatar → a token-styled span (the
// grl-config-item-card__avatar pattern of graph-nodes.vue); antd Button →
// ui/Button; antd Dropdown (trigger=['contextMenu']) → reka-ui ContextMenu
// (expression/dt precedent); @ant-design/icons → lucide-vue-next
// (CloseOutlined → X, DeploymentUnitOutlined → Network,
// UnorderedListOutlined → List); upstream's DiffIcon → components/diff-icon.vue.
import { List, Network, X } from 'lucide-vue-next';
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';

import DiffIcon from '../../diff-icon.vue';
import Button from '../../ui/Button.vue';
import Tabs from '../../ui/Tabs.vue';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { NodeColor } from '../nodes/specifications/colors';
import { NodeKind } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';

const props = defineProps<GraphTabsProps>();

const graphActions = useDecisionGraphActions();

// upstream: the useDecisionGraphState selector (graph-tabs.tsx:24-41)
const state = useDecisionGraphState(({ decisionGraph, activeTab, openTabs, viewConfig }) => ({
  activeNodeId: (decisionGraph?.nodes ?? []).find((node) => node.id === activeTab)?.id,
  openNodes: buildOpenTabNodes(decisionGraph, openTabs),
  viewConfig,
}));

// upstream: the defaultItems useMemo + the openNodes map (graph-tabs.tsx:43-98)
// PORTING: upstream's useMemo depends on [viewConfig] only, so the graph
// tab's `active` flag and the `total` count froze at their first render — ours
// recompute on every state change (the stale-closure fix).
const tabLabels = computed<GraphTabLabel[]>(() => {
  const openNodes = state.value.openNodes;
  const total = openNodes.length;
  const activeNodeId = state.value.activeNodeId;
  const viewConfig = state.value.viewConfig;

  const graphTab: GraphTabLabel = {
    key: 'graph',
    index: -1,
    total,
    icon: viewConfig?.enabled ? List : Network,
    name: viewConfig?.enabled ? 'Nodes' : 'Graph',
    color: NodeColor.Blue,
    active: !activeNodeId || activeNodeId === 'graph',
    closable: false,
  };

  const nodeTabs = openNodes.map((node, index) => {
    const specification = nodeSpecification[node.type as NodeKind];

    return {
      key: node.id,
      index,
      total,
      icon: specification?.icon,
      name: node?.name ?? node?.type ?? '',
      color: specification?.color ?? NodeColor.Blue,
      diffStatus: node?.diff?.status,
      active: node.id === activeNodeId,
      closable: true,
    };
  });

  return [graphTab, ...nodeTabs];
});

// upstream: the antd Tabs items (graph-tabs.tsx:63-99) — the graph tab first,
// the open node tabs after it.
const tabItems = computed(() => tabLabels.value.map((tab) => ({ key: tab.key, label: tab.name })));

// upstream: activeKey={activeNodeId || 'graph'}
const activeKey = computed(() => state.value.activeNodeId || 'graph');

const tabLabelsByKey = computed(() => new Map(tabLabels.value.map((tab) => [tab.key, tab])));

// ui/Tabs hands the raw item back through its #label slot (a string or a
// { key, label } object) — the key is extracted here so the template never
// touches the union.
type TabSlotItem = string | { key: string; label?: string };

const keyOf = (item: TabSlotItem): string => (typeof item === 'string' ? item : item.key);

const emptyTab: GraphTabLabel = {
  key: '',
  index: -1,
  total: 0,
  name: '',
  color: NodeColor.Blue,
  active: false,
  closable: false,
};

const tabOf = (item: TabSlotItem): GraphTabLabel => tabLabelsByKey.value.get(keyOf(item)) ?? emptyTab;

const contextItemsOf = (item: TabSlotItem): TabContextItem[] => {
  const tab = tabOf(item);

  return buildTabContextItems(tab.total, tab.index);
};

const onTabChange = (key: string | undefined) => {
  // PORTING: antd's per-item `disabled` has no ui/Tabs equivalent (the
  // component has no per-item disabled support). Upstream's value is always
  // false (dg-wrapper's disableTabs state is never set), so the prop is
  // accepted for API parity and only guards the selection.
  if (props.disabled || !key) {
    return;
  }

  graphActions.openTab(key);
};

const onClose = (tab: GraphTabLabel) => graphActions.closeTab(tab.key);

const onContextSelect = (tab: GraphTabLabel, action: TabContextAction) => graphActions.closeTab(tab.key, action);

// renders the VNode | Component tab icons (graph-side-toolbar.vue's IconView
// precedent — a Vue vnode must not be re-mounted across instances).
const IconView = defineComponent({
  name: 'IconView',
  props: { node: { type: [Object, Function] as PropType<VNode | Component | null>, default: null } },
  setup: (props) => () => (isVNode(props.node) ? props.node : props.node ? h(props.node as Component) : null),
});
</script>

<template>
  <div>
    <Tabs
      size="small"
      class="grl-graph-tabs"
      :items="tabItems"
      :model-value="activeKey"
      @update:model-value="onTabChange"
    >
      <template #label="{ item }">
        <ContextMenuRoot>
          <ContextMenuTrigger as-child>
            <div class="grl-graph-tabs__tab" :data-active="tabOf(item).active">
              <span class="grl-graph-tabs__avatar" :style="{ background: tabOf(item).color }">
                <IconView :node="tabOf(item).icon" />
              </span>
              {{ tabOf(item).name }}
              <DiffIcon :status="tabOf(item).diffStatus" :style="{ fontSize: '16px' }" />
              <!-- PORTING: reka-ui's TabsTrigger activates on mousedown (antd
                   activates on click), so the close button swallows the
                   mousedown as well — upstream's click handler stopped the
                   propagation to keep the tab from activating. -->
              <Button
                v-if="tabOf(item).closable"
                class="grl-graph-tabs__closeIcon"
                type="text"
                size="small"
                :style="{ height: '20px', width: '20px', color: 'black', borderRadius: '50%', lineHeight: 0 }"
                @mousedown.stop
                @click="
                  (event) => {
                    event.stopPropagation();
                    onClose(tabOf(item));
                  }
                "
              >
                <template #icon><X :size="10" /></template>
              </Button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuPortal>
            <!-- PORTING: antd's Dropdown opens an (empty) overlay even with no
                 menu items; ours renders no content when there is no item. -->
            <ContextMenuContent v-if="contextItemsOf(item).length > 0" class="grl-context-menu">
              <ContextMenuItem
                v-for="contextItem in contextItemsOf(item)"
                :key="contextItem.key"
                class="grl-context-menu__item"
                @select="() => onContextSelect(tabOf(item), contextItem.key)"
              >
                {{ contextItem.label }}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenuPortal>
        </ContextMenuRoot>
      </template>
      <!-- PORTING: upstream renders antd's tabBarExtraContent only when the
           caller provides it — the slot is forwarded conditionally so ui/Tabs
           does not reserve the extra area for nothing. -->
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
    </Tabs>
  </div>
</template>

<style lang="scss">
// PORTING: antd Avatar (size='small' shape='square') → a token-styled span
// (the grl-config-item-card__avatar pattern of graph-nodes.vue).
.grl-graph-tabs__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 3px;

  > svg {
    width: 1em;
    height: 1em;
  }
}
</style>
