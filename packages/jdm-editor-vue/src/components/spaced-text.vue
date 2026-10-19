<script setup lang="ts">
// Ported from components/spaced-text.tsx.
import Stack from './stack.vue';

withDefaults(defineProps<{ gap?: number }>(), { gap: 16 });
</script>

<template>
  <Stack :gap="gap" horizontal horizontal-align="space-between">
    <span class="grl-typography" style="color: inherit"><slot /></span>
    <span v-if="$slots.right" class="grl-typography" style="color: inherit"><slot name="right" /></span>
  </Stack>
</template>
