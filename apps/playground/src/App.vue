<script setup lang="ts">
import { ref } from 'vue';

import { JdmConfigProvider } from '@nfk.st/jdm-editor-vue';
import '@nfk.st/jdm-editor-vue/dist/style.css';

const mode = ref<'light' | 'dark'>('light');

// Stand-in sample graph — DecisionGraph lands with the decision-graph module.
const graph = ref({
  edges: [],
  nodes: [
    { id: 'input', name: 'Request', type: 'input', position: { x: 80, y: 160 } },
    { id: 'output', name: 'Response', type: 'output', position: { x: 480, y: 160 } },
  ],
});
</script>

<template>
  <div class="shell">
    <header class="bar">
      <strong>@nfk.st/jdm-editor-vue</strong>
      <span class="spacer" />
      <button @click="mode = mode === 'light' ? 'dark' : 'light'">
        {{ mode === 'light' ? 'Dark mode' : 'Light mode' }}
      </button>
    </header>

    <JdmConfigProvider :theme="{ mode }" style="flex: 1; min-height: 0">
      <main class="canvas-placeholder">
        <p>DecisionGraph component ports with the decision-graph module.</p>
        <p>Current graph JSON: {{ graph.nodes.length }} nodes / {{ graph.edges.length }} edges</p>
      </main>
    </JdmConfigProvider>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #d9d9d9;
}
.spacer {
  flex: 1;
}
.canvas-placeholder {
  display: grid;
  place-content: center;
  gap: 8px;
  height: 100%;
  opacity: 0.65;
}
</style>
