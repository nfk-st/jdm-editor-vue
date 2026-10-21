<script setup lang="ts">
// Ported from components/expression/expression-command-bar.tsx.
import { computed } from 'vue';

import Stack from '../stack.vue';
import Select from '../ui/Select.vue';
import { useExpressionStoreRaw } from './context/expression-store.context';

const expressionStore = useExpressionStoreRaw();

// PORTING: upstream used ts-pattern's P.array() here; its narrowing fights the
// port's trace typing — plain Array.isArray keeps identical semantics.
const traceCount = computed(() => {
  const data = expressionStore.debug?.trace?.traceData;
  return Array.isArray(data) ? data.length : null;
});

// PORTING: antd Select takes number option values; ui/Select is string-typed
// — stringify at the boundary, parse back on change.
const traceIndexOptions = computed(() => {
  if (!traceCount.value) {
    return null;
  }

  return Array.from({ length: traceCount.value }).map((_, i) => ({
    label: String(i),
    value: String(i),
  }));
});

const selectedIndex = computed(() =>
  traceIndexOptions.value?.some((t) => t.value === String(expressionStore.debugIndex))
    ? String(expressionStore.debugIndex)
    : '0',
);

const onSelect = (value: string) => {
  expressionStore.setState({ debugIndex: Number(value) });
};
</script>

<template>
  <Stack
    v-if="traceIndexOptions"
    horizontal
    horizontal-align="space-between"
    vertical-align="center"
    class="grl-dt__command-bar"
  >
    <Stack :gap="8" horizontal class="full-width" />
    <Stack horizontal vertical-align="center" horizontal-align="end">
      <span class="grl-typography" :style="{ fontSize: '12px' }">Simulation index:</span>
      <Select
        size="small"
        :style="{ fontSize: '12px', minWidth: '60px' }"
        :options="traceIndexOptions"
        :model-value="selectedIndex"
        @update:model-value="onSelect"
      />
    </Stack>
  </Stack>
</template>
