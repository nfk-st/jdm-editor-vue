<script setup lang="ts">
// Ported from components/arrow-diff-icon.tsx (antd icons → lucide).
import { ArrowDown, ArrowRight } from 'lucide-vue-next';

withDefaults(defineProps<{ direction?: 'right' | 'down'; size?: 'small' | 'medium' }>(), {
  direction: 'right',
  size: 'small',
});
</script>

<template>
  <ArrowDown v-if="direction === 'down'" class="text-modified" :size="size === 'small' ? 12 : 16" />
  <ArrowRight v-else class="text-modified" :size="size === 'small' ? 12 : 16" />
</template>
