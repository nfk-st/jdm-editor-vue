<script lang="ts">
// Ported from components/decision-graph/graph/graph-nodes.tsx.
// The Decision View node/group derivations are extracted as pure functions
// for vitest coverage (PORTING.md testing rule).
import { match } from 'ts-pattern';

import type { ViewConfig } from '../context/dg-store.context';
import type { DecisionGraphType, DecisionNode, DiffStatus } from '../dg-types';
import { NodeColor } from '../nodes/specifications/colors';
import { NodeKind, type NodeSpecification } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';

export type GraphNodesProps = {
  className?: string;
};

export type DecisionViewItem = {
  id: string;
  type?: string;
  name: string;
  description?: string;
  disabled: boolean;
  position: { x: number; y: number };
  icon?: NodeSpecification['icon'];
  _diff?: { status: DiffStatus };
};

// upstream: nodes useMemo body (graph-nodes.tsx:31-53)
export const buildDecisionViewNodes = (
  decisionGraph: DecisionGraphType | undefined,
  customComponents: NodeSpecification[],
  viewConfig: ViewConfig | undefined,
): DecisionViewItem[] => {
  return (decisionGraph?.nodes || [])
    .filter((node) => (viewConfig?.enabled ? !!viewConfig?.permissions?.[node.id] : true))
    .map((node) => {
      const kind = node.type as NodeKind;
      const specification =
        nodeSpecification[node.type as NodeKind] || (customComponents || []).find((cmp) => cmp.type === node.type);

      return {
        id: node.id,
        type: node.type,
        name: node.name,
        disabled: match(kind)
          .with(NodeKind.Function, () => false)
          .with(NodeKind.DecisionTable, () => false)
          .with(NodeKind.Expression, () => false)
          .otherwise(() => true),
        position: node.position,
        icon: specification?.icon,
        ...(node?._diff ? { _diff: node._diff } : {}),
      };
    });
};

export type DecisionViewGroup = { title: string; nodes: DecisionViewItem[] };

// upstream: nodeGroups useMemo body (graph-nodes.tsx:98-117)
export const groupDecisionViewNodes = (nodes: DecisionViewItem[], search: string): DecisionViewGroup[] => {
  const filtered = nodes.filter((node) =>
    search.trim()?.length > 0 ? node.name?.toLowerCase?.()?.indexOf?.(search?.trim?.()?.toLowerCase?.()) > -1 : true,
  );

  return [
    {
      title: 'Decision Tables',
      nodes: filtered.filter((node) => node.type === NodeKind.DecisionTable),
    },
    {
      title: 'Expressions',
      nodes: filtered.filter((node) => node.type === NodeKind.Expression),
    },
    {
      title: 'Functions',
      nodes: filtered.filter((node) => node.type === NodeKind.Function),
    },
  ];
};
</script>

<script setup lang="ts">
// PORTING: antd Card/Avatar/Row/Col/Typography/Input → token markup (the
// .config-item-card / .grl-dg__view styles in dg.scss) + local grid; ConfigItem
// stays an in-file component (dt-excel-dialog's ImportColumnRow precedent).
import clsx from 'clsx';
import { Search, X } from 'lucide-vue-next';
import { type Component, type VNode, computed, defineComponent, h, isVNode, ref } from 'vue';

import Button from '../../ui/Button.vue';
import Input from '../../ui/Input.vue';
import { useDecisionGraphActions, useDecisionGraphListeners, useDecisionGraphState } from '../context/dg-store.context';

const props = defineProps<GraphNodesProps>();

const state = useDecisionGraphState((store) => ({
  decisionGraph: store.decisionGraph || [],
  customComponents: store.components,
  viewConfig: store.viewConfig,
  viewConfigCta: store.viewConfigCta,
}));

const { openTab } = useDecisionGraphActions();
const onViewConfigCta = useDecisionGraphListeners((s) => s.onViewConfigCta);

const nodes = computed(() =>
  buildDecisionViewNodes(
    state.value.decisionGraph as DecisionGraphType | undefined,
    state.value.customComponents,
    state.value.viewConfig,
  ),
);

const search = ref('');

const nodeGroups = computed(() => groupDecisionViewNodes(nodes.value, search.value));

const isEmpty = computed(() => (nodes.value?.length || 0) === 0);

const renderIcon = (icon: Component | VNode | undefined): VNode | null =>
  icon ? (isVNode(icon) ? icon : h(icon)) : null;

// upstream: in-file ConfigItem (graph-nodes.tsx:57-96)
const ConfigItem = defineComponent({
  name: 'ConfigItem',
  props: { node: { type: Object as () => DecisionViewItem, required: true } },
  setup(nodeProps) {
    const specification = computed(() => nodeSpecification?.[nodeProps.node?.type as NodeKind]);
    return () =>
      h(
        'div',
        {
          class: clsx(['config-item-card', 'grl-config-item-card', nodeProps.node?._diff?.status]),
          style: { padding: '16px', cursor: 'pointer' },
          onClick: () => openTab(nodeProps.node.id),
        },
        [
          h('div', { class: 'config-item-card__content' }, [
            h(
              'span',
              {
                class: 'grl-config-item-card__avatar',
                style: {
                  background: specification.value?.color || NodeColor.Blue,
                  fontSize: '16px',
                  width: '24px',
                  height: '24px',
                  lineHeight: '22px',
                  borderRadius: '3px',
                },
              },
              renderIcon(specification.value?.icon) ?? undefined,
            ),
            h('div', { style: { flex: 1 } }, [
              h(
                'span',
                {
                  class: 'grl-typography',
                  style: { margin: 0, fontSize: '14px', marginBottom: nodeProps.node?.description ? '4px' : 0 },
                },
                nodeProps.node.name,
              ),
              nodeProps.node?.description
                ? h(
                    'span',
                    { class: 'grl-typography grl-typography--secondary', style: { fontSize: '14px' } },
                    nodeProps.node.description,
                  )
                : null,
            ]),
          ]),
        ],
      );
  },
});
</script>

<template>
  <div :class="clsx(['grl-dg__view', props.className])">
    <div class="grl-dg__view__content">
      <div class="grl-dg__view__content__heading">
        <div class="grl-dg__view__content__heading__first-row">
          <!-- PORTING(react): React appends 'px' to numeric style values; Vue does not. -->
          <h4 class="grl-typography grl-dg__view__title" :style="{ margin: 0, marginBottom: '8px', fontSize: '20px' }">
            {{ isEmpty ? 'Decision View Not Configured' : 'Decision View' }}
          </h4>
          <Button v-if="state.viewConfigCta" type="primary" @click="() => onViewConfigCta?.()">
            {{ state.viewConfigCta }}
          </Button>
        </div>
        <span v-if="!isEmpty" class="grl-typography grl-typography--secondary">
          {{ state.viewConfig?.description || 'Configure business rules for your decision model' }}
        </span>
        <template v-else>
          <span v-if="(state.decisionGraph?.nodes?.length || 0) > 0" class="grl-typography grl-typography--secondary">
            This decision model contains multiple components, but no view has been configured yet.
          </span>
          <span v-else class="grl-typography grl-typography--secondary">
            This decision model doesn't contain any component.
          </span>
        </template>
      </div>

      <div v-if="!isEmpty" class="grl-dg__view__content__search">
        <div :style="{ display: 'flex', alignItems: 'center', gap: '8px' }">
          <div class="grl-dg__view__search-input">
            <span class="grl-dg__view__search-input__prefix"><Search :size="12" /></span>
            <!-- PORTING: antd Input prefix → local affix markup over ui/Input. -->
            <Input v-model="search" placeholder="Search nodes" :style="{ width: '350px' }" />
          </div>
          <Button v-if="search?.trim()?.length > 0" type="text" size="small" @click="() => (search = '')">
            <template #icon><X :size="12" /></template>
            Clear
          </Button>
        </div>
        <span class="grl-typography grl-typography--secondary" :style="{ whiteSpace: 'nowrap' }">
          {{ nodes?.length || 0 }} configurable items
        </span>
      </div>

      <div
        v-for="group in nodeGroups.filter((group) => group?.nodes?.length > 0)"
        :key="group.title"
        class="grl-dg__view__content__node-groups"
      >
        <h5 class="grl-typography grl-dg__view__subtitle" :style="{ marginBottom: '16px', fontSize: '16px' }">
          {{ group.title }}
        </h5>
        <div class="grl-dg__view__grid">
          <ConfigItem v-for="node in group.nodes" :key="node.id" :node="node" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// PORTING: antd Row/Col gutters → responsive grid; antd Avatar square →
// token-styled span.
.grl-config-item-card__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;

  > svg {
    width: 1em;
    height: 1em;
  }
}

.grl-dg__view__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.grl-dg__view__search-input {
  position: relative;
  display: inline-flex;
  align-items: center;

  &__prefix {
    position: absolute;
    left: 8px;
    display: inline-flex;
    color: var(--grl-color-text-secondary);
    pointer-events: none;
  }

  .grl-input {
    padding-left: 26px;
  }
}
</style>
