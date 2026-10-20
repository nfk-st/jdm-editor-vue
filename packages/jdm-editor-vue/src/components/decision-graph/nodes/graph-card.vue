<script lang="ts">
// Ported from components/decision-graph/nodes/graph-card.tsx.
// PORTING: React.HTMLAttributes<HTMLDivElement> → Vue's HTMLAttributes;
// upstream's clsx merge + {...props} spread → native attr fallthrough (Vue
// merges the fallthrough class/style with the static ones on the root).
import type { HTMLAttributes } from 'vue';

export type GraphCardProps = HTMLAttributes;
</script>

<script setup lang="ts">
defineOptions({ name: 'GraphCard' });
</script>

<template>
  <div class="grl-dn__graphCard">
    <slot />
  </div>
</template>
