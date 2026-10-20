<script lang="ts">
// Ported from components/decision-graph/nodes/decision-node.tsx.
// PORTING: antd Button/Dropdown/Typography → ui/Button + reka-ui
// DropdownMenu + .grl-typography spans; transition-hook's <Transition> →
// Vue <Transition>; antd MenuProps['items'] → DecisionNodeMenuItem.
// React.ReactNode props (icon/helper/actions/menu labels) become
// VNode | Component and render through VNodeView — templates cannot render
// raw vnodes directly.
import { MoreHorizontal, X } from 'lucide-vue-next';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui';
import { match } from 'ts-pattern';
import { type Component, type PropType, type VNode, computed, defineComponent, h, isVNode } from 'vue';

import DiffIcon from '../../diff-icon.vue';
import TextEdit from '../../text-edit.vue';
import Button from '../../ui/Button.vue';
import './decision-node.scss';
import GraphCard from './graph-card.vue';
import { NodeColor } from './specifications/colors';

// antd MenuProps['items'] narrowed to the fields this tree builds.
export type DecisionNodeMenuItem = {
  key: string;
  label?: VNode | string;
  icon?: VNode | Component;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'divider';
};

export type DecisionNodeProps = {
  name?: string;
  // PORTING: React.ReactNode → VNode | Component.
  icon?: VNode | Component;
  // PORTING: upstream declares `type` (the node displayName) but never
  // renders it — kept for API parity.
  type?: string | VNode;
  helper?: (VNode | false)[];
  disabled?: boolean;
  isSelected?: boolean;
  // children → default slot, details → #details slot.
  actions?: VNode[];
  status?: 'error' | 'success' | 'warning';
  diffStatus?: 'removed' | 'added' | 'modified' | 'moved';
  noBodyPadding?: boolean;
  color?: 'primary' | 'secondary' | string;
  menuItems?: DecisionNodeMenuItem[];
  // onNameChange → emit('nameChange'), onDetailsClose → emit('detailsClose').
  compactMode?: boolean;
  listMode?: boolean;
  detailsOpen?: boolean;
  detailsTitle?: string;
};

// upstream renders React.ReactNode children directly; Vue templates need a
// pass-through component for VNode props.
const VNodeView = defineComponent({
  name: 'VNodeView',
  props: { node: { type: [Object, String] as PropType<VNode | string | null>, default: null } },
  setup: (props) => () => (isVNode(props.node) ? props.node : (props.node ?? null)),
});
</script>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name?: string;
    icon?: VNode | Component;
    type?: string | VNode;
    helper?: (VNode | false)[];
    disabled?: boolean;
    isSelected?: boolean;
    actions?: VNode[];
    status?: 'error' | 'success' | 'warning';
    diffStatus?: 'removed' | 'added' | 'modified' | 'moved';
    noBodyPadding?: boolean;
    color?: 'primary' | 'secondary' | string;
    menuItems?: DecisionNodeMenuItem[];
    compactMode?: boolean;
    listMode?: boolean;
    detailsOpen?: boolean;
    detailsTitle?: string;
  }>(),
  {
    actions: () => [],
    disabled: false,
    isSelected: false,
    noBodyPadding: false,
    color: 'primary',
    menuItems: () => [],
    detailsOpen: false,
    detailsTitle: 'Details',
  },
);

const emit = defineEmits<{ (e: 'nameChange', name: string): void; (e: 'detailsClose'): void }>();

const nodeColor = computed(() =>
  match(props.color)
    .with('primary', () => NodeColor.Blue)
    .otherwise((c) => c),
);

// PORTING: icons may arrive as Components (specification icons are functional
// components rendering fresh vnodes) or as VNodes — h() normalizes.
const iconNode = computed<VNode | null>(() => (props.icon ? (isVNode(props.icon) ? props.icon : h(props.icon)) : null));
const helperNodes = computed<VNode[]>(() => (props.helper ?? []).filter((h): h is VNode => !!h));
const actionNodes = computed<VNode[]>(() => props.actions ?? []);
const menuIcon = (icon: VNode | Component): VNode => (isVNode(icon) ? icon : h(icon));
</script>

<template>
  <div
    class="grl-dn"
    :class="[
      compactMode && 'grl-dn--compact',
      listMode && 'grl-dn--list',
      !diffStatus && isSelected && 'grl-dn--selected',
      status && `grl-dn--${status}`,
      diffStatus && `grl-dn--diff-${diffStatus}`,
    ]"
    :style="{ '--node-color': nodeColor }"
    @keydown.stop
  >
    <GraphCard>
      <div class="grl-dn__status-bar">
        <div v-for="(helperNode, i) in helperNodes" :key="i" class="grl-dn__status-icon">
          <VNodeView :node="helperNode" />
        </div>
        <div v-if="status === 'error'" class="grl-dn__status-icon grl-dn__status-icon--error">
          <X :size="10" />
        </div>
        <!-- upstream renders DiffIcon unconditionally; it paints nothing
             when diffStatus is undefined -->
        <DiffIcon :status="diffStatus" :style="{ fontSize: '16px' }" />
      </div>
      <div class="grl-dn__header" :class="[compactMode && 'compact']">
        <div class="grl-dn__header__icon" :class="[compactMode && 'compact']">
          <VNodeView :node="iconNode" />
        </div>
        <TextEdit :value="name" :disabled="disabled" @change="(v) => emit('nameChange', v)" />
        <div v-if="menuItems.length > 0" class="grl-dn__header__actions nodrag">
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <Button type="text" size="small">
                <template #icon><MoreHorizontal :size="12" /></template>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent class="grl-context-menu grl-dn__menu" align="end" :side-offset="6">
                <template v-for="item in menuItems" :key="item.key">
                  <DropdownMenuSeparator v-if="item.type === 'divider'" class="grl-context-menu__separator" />
                  <DropdownMenuItem
                    v-else
                    class="grl-context-menu__item"
                    :class="[item.danger && 'grl-context-menu__item--danger']"
                    :disabled="item.disabled"
                    @select="item.onClick?.()"
                  >
                    <VNodeView v-if="item.icon" :node="menuIcon(item.icon)" />
                    <VNodeView :node="item.label ?? ''" />
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </div>
      <div
        v-if="$slots.default"
        class="grl-dn__body"
        :class="[actionNodes.length === 0 && 'grl-dn__body--no-footer', noBodyPadding && 'grl-dn__body--no-padding']"
      >
        <slot />
      </div>
      <div v-if="actionNodes.length > 0" class="grl-dn__footer nodrag">
        <div class="grl-dn__footer__actions">
          <VNodeView v-for="(action, i) in actionNodes" :key="i" :node="action" />
        </div>
      </div>
    </GraphCard>
    <!-- PORTING: transition-hook's render-prop Transition (stage/shouldMount,
         timeout 100) → Vue <Transition> with the same 0.1s ease-in-out. -->
    <Transition name="grl-dn-details">
      <GraphCard v-if="detailsOpen" class="nodrag">
        <div class="grl-dn__details">
          <div class="grl-dn__details__header">
            <span class="grl-typography grl-dn__details__header__text">{{ detailsTitle }}</span>
            <Button type="text" size="small" class="grl-dn__details__header__close" @click="emit('detailsClose')">
              <template #icon><X :size="8" /></template>
            </Button>
          </div>
          <div class="grl-dn__details__body">
            <slot name="details" />
          </div>
        </div>
      </GraphCard>
    </Transition>
  </div>
</template>

<style lang="scss">
// PORTING(additive): transition-hook replacement for the details card.
.grl-dn-details-enter-active,
.grl-dn-details-leave-active {
  transition: 0.1s ease-in-out;
}

.grl-dn-details-enter-from,
.grl-dn-details-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

// PORTING: antd's built-in Dropdown menu chrome → token-styled classes on
// top of .grl-context-menu (expression-item-context-menu.vue precedent).
.grl-dn__menu {
  min-width: 250px;
}

.grl-context-menu__separator {
  height: 1px;
  margin: 2px 4px;
  background-color: var(--grl-color-border);
}

.grl-context-menu__item--danger {
  color: var(--grl-color-error);

  &:hover,
  &[data-highlighted] {
    color: var(--grl-color-error-hover);
  }
}
</style>
