<script setup lang="ts">
import { GripVertical, MinusSquare, PlusSquare } from 'lucide-vue-next';
import { computed, useAttrs } from 'vue';

// Ported from components/diff-icon.tsx (antd icons → lucide).
// PORTING(P4): upstream spreads {...rest} (class/style/attrs) onto every
// branch and merges consumer style AFTER the status color (consumer wins);
// box icons size from style.fontSize (upstream default 14).
defineOptions({ inheritAttrs: false });

// PORTING: local stand-in for decision-graph/dg-types DiffStatus — swap when
// decision-graph lands.
type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged' | 'moved';

defineProps<{ status?: DiffStatus }>();

const attrs = useAttrs();

const fontSize = computed<number>(() => {
  const size = (attrs.style as Record<string, unknown> | undefined)?.fontSize;
  return typeof size === 'number' ? size : parseInt(String(size ?? '14'), 10) || 14;
});

const mergedStyle = (color: string) => [{ color }, attrs.style];
</script>

<template>
  <MinusSquare
    v-if="status === 'removed'"
    v-bind="$attrs"
    :size="fontSize"
    :style="mergedStyle('var(--grl-color-error)')"
  />
  <PlusSquare
    v-else-if="status === 'added'"
    v-bind="$attrs"
    :size="fontSize"
    :style="mergedStyle('var(--grl-color-success)')"
  />
  <span
    v-else-if="status === 'modified'"
    v-bind="$attrs"
    :style="[
      mergedStyle(''),
      {
        width: `${fontSize}px`,
        height: `${fontSize}px`,
        border: '1.5px solid var(--grl-color-warning)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxSizing: 'border-box',
      },
      attrs.style,
    ]"
  >
    <span
      :style="{
        width: 3,
        height: 3,
        backgroundColor: 'var(--grl-color-warning)',
        borderRadius: '50%',
      }"
    />
  </span>
  <GripVertical
    v-else-if="status === 'moved'"
    v-bind="$attrs"
    :size="fontSize"
    :style="mergedStyle('var(--grl-color-info)')"
  />
</template>
