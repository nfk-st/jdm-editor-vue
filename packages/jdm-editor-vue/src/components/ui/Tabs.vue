<script setup lang="ts">
// antd Tabs replacement — Reka UI Tabs styled with --grl-* tokens. Covers the
// port's usages (function debugger, later decision-graph simulator): label-only
// items, v-model activeKey (antd activeKey/onChange), size, and extra content
// (antd tabBarExtraContent, rendered right of the list).
// PORTING: tab content renders OUTSIDE the control in every ported consumer,
// driven by the v-model — upstream's `.grl-inline-tabs` global antd overrides
// (styles.scss:152) are folded into this component's own look instead of
// styling antd's DOM.
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';

export type TabItem = { key: string; label?: string };

withDefaults(
  defineProps<{
    items?: (string | TabItem)[];
    size?: 'default' | 'small';
  }>(),
  { items: () => [], size: 'default' },
);

const activeKey = defineModel<string>();

const keyOf = (item: string | TabItem): string => (typeof item === 'string' ? item : item.key);
const labelOf = (item: string | TabItem): string => (typeof item === 'string' ? item : (item.label ?? item.key));
</script>

<template>
  <TabsRoot v-model="activeKey" class="grl-tabs" :class="`grl-tabs--${size}`">
    <div class="grl-tabs__bar">
      <TabsList class="grl-tabs__list">
        <TabsTrigger v-for="item in items" :key="keyOf(item)" :value="keyOf(item)" class="grl-tabs__tab">
          <!-- PORTING(additive): scoped #label slot for callers whose tab
               labels carry more than text (graph-tabs' icon + diff + close). -->
          <slot name="label" :item="item" :label="labelOf(item)">{{ labelOf(item) }}</slot>
        </TabsTrigger>
      </TabsList>
      <div v-if="$slots.extra" class="grl-tabs__extra"><slot name="extra" /></div>
    </div>
    <!-- default slot for TabsContent-style usage; unused by current ported consumers -->
    <slot />
  </TabsRoot>
</template>

<style lang="scss">
.grl-tabs {
  display: flex;
  flex-direction: column;
  width: 100%;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__list {
    display: flex;
    margin: 0;
  }

  &__tab {
    margin: 0;
    padding: 10px 14px;
    font-size: 13px;
    font-family: var(--grl-font-family);
    color: var(--grl-color-text);
    background: none;
    border: none;
    cursor: pointer;
    transition: 0.1s ease;

    &:hover {
      background: var(--grl-color-bg-text-hover);
    }

    &[data-state='active'] {
      color: var(--grl-color-primary);
      box-shadow: inset 0 -2px 0 var(--grl-color-primary);
    }

    // a11y (review-5): replace outline with a token focus ring, per the
    // Input.vue exemplar
    &:focus-visible {
      outline: none;
      box-shadow:
        inset 0 -2px 0 var(--grl-color-primary),
        0 0 0 2px var(--grl-control-outline);
    }
  }

  &__extra {
    display: flex;
    align-items: center;
  }

  &--small &__tab {
    padding: 8px 14px;
  }
}
</style>
