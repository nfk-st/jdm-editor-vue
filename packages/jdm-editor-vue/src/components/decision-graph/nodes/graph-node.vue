<script lang="ts">
// Ported from components/decision-graph/nodes/graph-node.tsx.
// PORTING: React.forwardRef → root element exposed as `rootElement` (the
// switch node's intersection observer attaches to it); antd
// App.useApp().modal.confirm → in-tree ui/Modal driven by a ref; antd
// Button/Typography → ui/Button + .grl-typography. The DecisionNode prop
// merge order of upstream's JSX (menuItems before {...decisionNodeProps},
// the rest after) is preserved via effectiveMenuItems + explicit bindings.
import { Handle, type HandleProps, Position } from '@vue-flow/core';
import clsx from 'clsx';
import { BookOpen } from 'lucide-vue-next';
import { P, match } from 'ts-pattern';
import { type Component, type VNode, computed, h, ref } from 'vue';

import { platform } from '../../../helpers/platform';
import { usePersistentState } from '../../../helpers/use-persistent-state';
import SpacedText from '../../spaced-text.vue';
import Button from '../../ui/Button.vue';
import Modal from '../../ui/Modal.vue';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../context/dg-store.context';
import DecisionNode, { type DecisionNodeMenuItem, type DecisionNodeProps } from './decision-node.vue';
import type { MinimalNodeSpecification } from './specifications/specification-types';

enum Details {
  Settings,
}

export type GraphNodeProps = {
  id: string;
  handleLeft?: boolean | Partial<HandleProps>;
  handleRight?: boolean | Partial<HandleProps>;
  className?: string;
  specification: MinimalNodeSpecification;
  displayError?: boolean;
} & Pick<
  Partial<DecisionNodeProps>,
  'name' | 'helper' | 'actions' | 'isSelected' | 'noBodyPadding' | 'listMode' | 'menuItems'
>;
</script>

<script setup lang="ts">
defineOptions({ name: 'GraphNode' });

const props = withDefaults(defineProps<GraphNodeProps>(), {
  handleLeft: true,
  handleRight: true,
  className: undefined,
  displayError: undefined,
  name: undefined,
  helper: undefined,
  actions: undefined,
  isSelected: undefined,
  noBodyPadding: undefined,
  listMode: undefined,
  menuItems: undefined,
});

const [currentDetails, setCurrentDetails] = usePersistentState<Details>(`node:details:${props.id}`, Details.Settings);
const [detailsOpen, setDetailsOpen] = usePersistentState<boolean>(`node:detailsOpen:${props.id}`, false);
const graphActions = useDecisionGraphActions();
// PORTING: antd modal.confirm → local Modal open state.
const deleteModalOpen = ref(false);

const rootRef = ref<HTMLDivElement | null>(null);
defineExpose({ rootElement: rootRef });

const { diff } = useNodeDiff(props.id);

// PORTING: upstream's zustand selector returns a fresh object per render;
// here it is one ComputedRef of that object (auto-unwrapped in template).
const nodeState = useDecisionGraphState(({ simulate, disabled, compactMode }) => ({
  disabled,
  nodeTrace: match(simulate)
    .with({ result: P._ }, ({ result }) => result?.trace?.[props.id])
    .otherwise(() => null),
  nodeError: match(simulate)
    .with({ error: { data: { nodeId: props.id } } }, ({ error }) => error)
    .otherwise(() => null),
  compactMode,
}));

const Settings = computed<Component | undefined>(() => props.specification?.renderSettings);

// upstream builds this array inline and spreads caller props over it — only
// the caller's menuItems can override (everything else is re-bound after the
// spread upstream); vnodes rebuilt per computed evaluation.
const menuItems = computed<DecisionNodeMenuItem[]>(
  () =>
    [
      props.specification?.documentationUrl
        ? {
            key: 'documentation',
            label: h(SpacedText, {}, { default: () => 'Documentation', right: () => h(BookOpen, { size: 12 }) }),
            onClick: () => window.open(props.specification?.documentationUrl, '_href'),
          }
        : null,
      props.specification?.documentationUrl ? { key: 'divider-1', type: 'divider' } : null,
      !props.displayError && {
        key: 'copy-clipboard',
        label: h(SpacedText, {}, { default: () => 'Copy to clipboard', right: () => platform.shortcut('Ctrl + C') }),
        onClick: () => graphActions.copyNodes([props.id]),
      },
      !props.displayError && {
        key: 'duplicate',
        disabled: nodeState.value.disabled,
        label: h(SpacedText, {}, { default: () => 'Duplicate', right: () => platform.shortcut('Ctrl + D') }),
        onClick: () => graphActions.duplicateNodes([props.id]),
      },
      !props.displayError && { key: 'divider-2', type: 'divider' },
      {
        key: 'delete',
        danger: true,
        label: h(SpacedText, {}, { default: () => 'Delete', right: () => platform.shortcut('Backspace') }),
        disabled: nodeState.value.disabled,
        onClick: () => (deleteModalOpen.value = true),
      },
      // upstream filters only `false`; antd skips the nulls — filter(Boolean)
      // yields the same rendered items.
    ].filter(Boolean) as DecisionNodeMenuItem[],
);

// PORTING: upstream's {...decisionNodeProps} (which may carry the caller's
// menuItems, e.g. inputSpecification's) overrides the locally built list.
const effectiveMenuItems = computed<DecisionNodeMenuItem[]>(() => props.menuItems ?? menuItems.value);

const handleLeftProps = computed(() => (typeof props.handleLeft !== 'boolean' ? (props.handleLeft ?? {}) : {}));
const handleRightProps = computed(() => (typeof props.handleRight !== 'boolean' ? (props.handleRight ?? {}) : {}));

const actions = computed<VNode[]>(() => {
  if (!Settings.value) {
    return props.actions ?? [];
  }

  return [
    ...(props.actions ?? []),
    h(
      Button,
      {
        key: 'settings',
        type: 'text',
        style: { marginLeft: 'auto' },
        onClick: () => {
          setDetailsOpen(currentDetails.value === Details.Settings ? !detailsOpen.value : true);
          setCurrentDetails(Details.Settings);
        },
      },
      { default: () => 'Settings' },
    ),
  ];
});

const detailsTitle = computed(() =>
  match(currentDetails.value)
    .with(Details.Settings, () => 'Settings')
    .otherwise(() => undefined),
);

const status = computed(() =>
  match([nodeState.value.nodeTrace, nodeState.value.nodeError, props.displayError])
    .with([P._, P._, true], () => 'error' as const)
    .with([P._, P.not(P.nullish), P._], () => 'error' as const)
    .with([P.not(P.nullish), P._, P._], () => 'success' as const)
    .otherwise(() => undefined),
);

const diffStatus = computed(() =>
  match([diff.value])
    .with([{ status: 'added' }], () => 'added' as const)
    .with([{ status: 'modified' }], () => 'modified' as const)
    .with([{ status: 'removed' }], () => 'removed' as const)
    .with([{ status: 'moved' }], () => 'moved' as const)
    .otherwise(() => undefined),
);

// upstream: match(navigator.platform.includes('Mac')) — metaKey on Mac,
// ctrlKey elsewhere (PORTING(SSR): navigator read deferred to click time).
const onClick = (event: MouseEvent) => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const isToggle = isMac ? event.metaKey : event.ctrlKey;

  graphActions.triggerNodeSelect(props.id, isToggle ? 'toggle' : 'only');
};

const onNameChange = (name: string) => {
  graphActions.updateNode(props.id, (draft) => {
    draft.name = name;
    return draft;
  });
};

const onConfirmDelete = () => {
  deleteModalOpen.value = false;
  graphActions.removeNodes([props.id]);
};
</script>

<template>
  <div
    ref="rootRef"
    :class="clsx('grl-graph-node', className)"
    :style="{ minWidth: '220px', maxWidth: '220px' }"
    @click="onClick"
  >
    <Handle
      v-if="handleLeft"
      :class="clsx('grl-graph-node__handle-left', nodeState.compactMode && 'compact')"
      type="target"
      :position="Position.Left"
      v-bind="handleLeftProps"
    />
    <DecisionNode
      :menu-items="effectiveMenuItems"
      :is-selected="isSelected"
      :no-body-padding="noBodyPadding"
      :list-mode="listMode"
      :disabled="nodeState.disabled"
      :icon="specification.icon"
      :color="specification.color"
      :type="specification.displayName"
      :helper="helper"
      :name="name"
      :details-open="detailsOpen"
      :details-title="detailsTitle"
      :actions="actions"
      :status="status"
      :diff-status="diffStatus"
      :compact-mode="nodeState.compactMode"
      @name-change="onNameChange"
      @details-close="() => setDetailsOpen(false)"
    >
      <template #details>
        <component :is="Settings" v-if="Settings" :id="id" />
      </template>
      <slot />
    </DecisionNode>
    <Handle
      v-if="handleRight"
      :class="clsx('grl-graph-node__handle-right', nodeState.compactMode && 'compact')"
      type="source"
      :position="Position.Right"
      v-bind="handleRightProps"
    />
    <!-- PORTING: antd modal.confirm({ title: 'Delete node', okButtonProps:
         { danger: true } }) → ui/Modal with a danger OK footer button. -->
    <Modal confirm :open="deleteModalOpen" title="Delete node" :width="416" @update:open="(o) => (deleteModalOpen = o)">
      <span class="grl-typography">
        Are you sure you want to delete
        <span class="grl-typography" :style="{ fontWeight: 600 }">{{ name }}</span> node.
      </span>
      <template #footer>
        <Button @click="deleteModalOpen = false">Cancel</Button>
        <Button type="primary" danger @click="onConfirmDelete">OK</Button>
      </template>
    </Modal>
  </div>
</template>
