<script setup lang="ts">
// Ported from components/decision-graph/dg-panel.tsx.
// PORTING: re-resizable (top-handle-only) → a bottom-anchored panel with a
// drag handle (pointer events), localStorage persistence kept verbatim; antd
// Typography/Tooltip/Button → tokens + ui/Button (text/ghost, no Tooltip
// wrapper needed — title attr for the close affordance).
import { X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import Button from '../ui/Button.vue';
import { useDecisionGraphActions, useDecisionGraphState } from './context/dg-store.context';

const heightKey = 'jdmEditor:graphPanel:height';

const graphActions = useDecisionGraphActions();
const panels = useDecisionGraphState(({ panels }) => panels);
const activePanelId = useDecisionGraphState(({ activePanel }) => activePanel);

const activePanel = computed(() =>
  activePanelId.value === undefined
    ? undefined
    : (panels.value || []).find((panel) => panel.id === activePanelId.value),
);

// upstream: Number.parseFloat(localStorage.getItem(heightKey) ?? '') ?? 300
const defaultHeight = computed(() => {
  return Number.parseFloat(localStorage.getItem(heightKey) ?? '') ?? 300;
});

const height = ref(Math.min(Math.max(defaultHeight.value, 150), 500));
const panelRef = ref<HTMLDivElement | null>(null);
const dragging = ref(false);

const onHandlePointerDown = (e: PointerEvent) => {
  dragging.value = true;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
};

const onHandlePointerMove = (e: PointerEvent) => {
  if (!dragging.value) return;
  const next = Math.min(Math.max(panelRef.value!.getBoundingClientRect().bottom - e.clientY, 150), 500);
  height.value = next;
};

const onHandlePointerUp = () => {
  if (!dragging.value) return;
  dragging.value = false;
  // upstream persists elementRef.clientHeight on resize
  if (panelRef.value) {
    localStorage.setItem(heightKey, panelRef.value.clientHeight.toString());
  }
};

onMounted(() => {
  window.addEventListener('pointermove', onHandlePointerMove);
  window.addEventListener('pointerup', onHandlePointerUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onHandlePointerMove);
  window.removeEventListener('pointerup', onHandlePointerUp);
});
</script>

<template>
  <div v-if="activePanel" ref="panelRef" class="grl-dg__panel" :style="{ height: `${height}px` }">
    <div class="grl-dg__panel__resize-handle" @pointerdown="onHandlePointerDown" />
    <div v-if="!activePanel.hideHeader" class="grl-dg__panel__toolbar">
      <div class="grl-dg__panel__toolbar__content">
        <span class="grl-typography" :style="{ fontSize: '13px' }">{{ activePanel.title }}</span>
      </div>
      <div class="grl-dg__panel__toolbar__actions">
        <Button size="small" type="text" title="Close panel" @click="() => graphActions.setActivePanel(undefined)">
          <template #icon><X :size="12" /></template>
        </Button>
      </div>
    </div>
    <div class="grl-dg__panel__content">
      <component :is="activePanel.renderPanel" v-if="activePanel.renderPanel" />
    </div>
  </div>
</template>

<style lang="scss">
// PORTING: re-resizable replacement — the panel owns its resize affordance.
.grl-dg__panel {
  position: relative;
  display: flex;
  flex-direction: column;

  &__resize-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    cursor: ns-resize;
    z-index: 10;
  }
}
</style>
