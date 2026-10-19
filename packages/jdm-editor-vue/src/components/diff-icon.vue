<script setup lang="ts">
// Ported from components/diff-icon.tsx (antd icons → lucide).
import { MinusSquare, PlusSquare, GripVertical } from 'lucide-vue-next';
import { computed } from 'vue';
import { match } from 'ts-pattern';

// PORTING: local stand-in for decision-graph/dg-types DiffStatus — swap when
// decision-graph lands.
type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged' | 'moved';

const props = defineProps<{ status?: DiffStatus }>();
</script>

<template>
  <template v-if="status">
    <component
      :is="
        match(status)
          .with('removed', () => MinusSquare)
          .with('added', () => PlusSquare)
          .otherwise(() => null)
      "
      v-if="['removed', 'added'].includes(status)"
      :style="{
        color: status === 'removed' ? 'var(--grl-color-error)' : 'var(--grl-color-success)',
      }"
    />
    <span
      v-else-if="status === 'modified'"
      :style="{
        width: '14px',
        height: '14px',
        border: '1.5px solid var(--grl-color-warning)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxSizing: 'border-box',
      }"
    >
      <span
        :style="{
          width: '3px',
          height: '3px',
          backgroundColor: 'var(--grl-color-warning)',
          borderRadius: '50%',
        }"
      />
    </span>
    <GripVertical v-else-if="status === 'moved'" :style="{ color: 'var(--grl-color-info)' }" />
  </template>
</template>
