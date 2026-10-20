<script lang="ts">
// Ported from components/decision-graph/graph/graph-components.tsx.
// The palette group builders are extracted as pure functions for vitest
// coverage (PORTING.md testing rule).
import type { XYPosition } from '@vue-flow/core';

import type { CustomNodeSpecification } from '../nodes/custom-node';
import type { NodeSpecification } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';

export type GraphComponentsProps = {
  inputDisabled?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
};

// upstream: innerGroups useMemo body — core specs, the `extended` group for
// custom components, then custom nodes grouped by their `group` (ungrouped →
// 'custom').
export const buildSpecificationGroups = (
  customComponents: NodeSpecification[],
  customNodes: CustomNodeSpecification<object, any>[],
): Record<string, NodeSpecification[]> => {
  const initialGroups: Record<string, NodeSpecification[]> = {
    core: Object.values(nodeSpecification),
  };
  if (customComponents?.length > 0) {
    initialGroups.extended = customComponents;
  }

  (customNodes || []).forEach((node) => {
    const group = node.group?.trim?.() || '';
    if (group.length > 0) {
      if (initialGroups?.[group]) {
        initialGroups[group].push({ ...node, type: 'customNode' });
      } else {
        initialGroups[group] = [{ ...node, type: 'customNode' }];
      }
    }
  });

  (customNodes || []).forEach((node) => {
    if (!node?.group) {
      if (initialGroups?.['custom']) {
        initialGroups['custom'].push({ ...node, type: 'customNode' });
      } else {
        initialGroups['custom'] = [{ ...node, type: 'customNode' }];
      }
    }
  });

  return initialGroups;
};

// upstream: groups useMemo body — per-group search filter over
// type/displayName/shortDescription/group.
export const filterGroupsBySearch = (
  groups: Record<string, NodeSpecification[]>,
  search: string,
): Record<string, NodeSpecification[]> => {
  return Object.keys(groups).reduce((acc, key) => {
    return {
      ...acc,
      [key]: (groups[key] || []).filter(
        (el) =>
          !(search?.trim?.().length > 0) ||
          (el.type || '').toLowerCase().indexOf(search.toLowerCase()) > -1 ||
          ((el.displayName || '') as string).toLowerCase().indexOf(search.toLowerCase()) > -1 ||
          (el.shortDescription || '').toLowerCase().indexOf(search.toLowerCase()) > -1 ||
          (el.group || '').toLowerCase().indexOf(search.toLowerCase()) > -1,
      ),
    };
  }, {});
};
</script>

<script setup lang="ts">
// PORTING: React.memo → plain SFC (vue-flow reactivity); antd Input (search,
// allowClear) → local clear affordance over ui/Input; the per-node drag
// start/disabled decisions move from JSX props into groupNodeProps (upstream
// graph-components.tsx:25-45,120-153).
import { X } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import Input from '../../ui/Input.vue';
import { useDecisionGraphState } from '../context/dg-store.context';
import DecisionNode from '../nodes/decision-node.vue';
import { NodeKind } from '../nodes/specifications/specification-types';

const props = defineProps<GraphComponentsProps>();

const customComponents = useDecisionGraphState((store) => store.components || []);
const customNodes = useDecisionGraphState((store) => store.customNodes || []);

const search = ref('');

// upstream: useCallback onDragStart (graph-components.tsx:25-45)
const onDragStart = (event: DragEvent, nodeType: string, component?: string) => {
  const target = event.target as HTMLDivElement;
  if (!target) {
    return;
  }

  const { offsetX, offsetY } = event;
  const { height, width } = target.getBoundingClientRect();

  const positionData: XYPosition = {
    x: offsetX / width,
    y: offsetY / height,
  };

  // PORTING: React's DragEvent types `dataTransfer` as non-nullable; the DOM
  // DragEvent types it as `DataTransfer | null`. A dragstart event always
  // carries a dataTransfer, so it is narrowed once here — the runtime reads
  // are unchanged.
  const dataTransfer = event.dataTransfer as DataTransfer;

  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData('nodeType', nodeType);
  dataTransfer.setData('relativePosition', JSON.stringify(positionData));
  if (component) {
    dataTransfer.setData('customNodeComponent', component);
  }
};

const innerGroups = computed<Record<string, NodeSpecification[]>>(() => {
  return buildSpecificationGroups(customComponents.value, customNodes.value);
});

const groups = computed<Record<string, NodeSpecification[]>>(() => {
  return filterGroupsBySearch(innerGroups.value, search.value);
});

const customCount = computed(() => (customComponents.value?.length || 0) + (customNodes.value?.length || 0));

const groupEntries = computed(() => Object.keys(groups.value));

const nodeKey = (node: NodeSpecification) => ('kind' in node ? ((node as { kind: string }).kind as string) : node.type);

// upstream computes these per DragDecisionNode (core: graph-components.tsx
// 120-129; otherwise: 145-149).
const dragProps = (group: string, node: NodeSpecification) => {
  const isCore = group === 'core';
  const isKnownCore = nodeSpecification[node.type as NodeKind] !== undefined;

  return {
    key: nodeKey(node),
    draggable: !(isCore
      ? node.type === NodeKind.Input
        ? props.disabled || props.inputDisabled
        : props.disabled
      : props.disabled),
    onDragstart: (event: DragEvent) => {
      if (isCore) {
        if (isKnownCore) {
          onDragStart(event, node.type);
        } else {
          onDragStart(event, 'customNode', 'kind' in node ? ((node as { kind: string }).kind as string) : '');
        }
        return;
      }

      if (group === 'extended') {
        onDragStart(event, node.type);
        return;
      }
      onDragStart(event, 'customNode', 'kind' in node ? ((node as { kind: string }).kind as string) : '');
    },
  };
};
</script>

<template>
  <div>
    <div v-if="customCount > 5" class="grl-dg__components-search">
      <!-- PORTING: antd Input allowClear → local clear affordance. -->
      <Input v-model="search" placeholder="Search components..." class="grl-dg__aside__menu__components__search" />
      <span v-if="search" class="grl-input-affix__clear" role="button" aria-label="Clear search" @click="search = ''">
        <X :size="12" />
      </span>
    </div>
    <div class="grl-dg__aside__menu__components">
      <template v-for="group in groupEntries" :key="group">
        <div
          v-for="node in (groups[group] || []).length > 0 ? groups[group] : []"
          :key="dragProps(group, node).key"
          class="draggable-component"
          :draggable="dragProps(group, node).draggable"
          @dragstart="(e) => dragProps(group, node).onDragstart(e)"
        >
          <div :style="{ pointerEvents: 'none' }">
            <DecisionNode
              list-mode
              compact-mode
              :color="node.color"
              :icon="node.icon"
              :name="props.collapsed ? undefined : (node.displayName as string)"
              :type="node.shortDescription"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
// PORTING: antd Input allowClear → local affix wrapper around ui/Input.
.grl-dg__components-search {
  position: relative;

  .grl-input-affix__clear {
    position: absolute;
    top: 0;
    right: 8px;
    display: inline-flex;
    align-items: center;
    height: 32px;
    color: var(--grl-color-text-secondary);
    cursor: pointer;
  }
}
</style>
