<script setup lang="ts">
import {
  CodeEditor,
  DecisionTable,
  Expression,
  ExpressionBuilder,
  Function as FunctionEditor,
  JdmConfigProvider,
} from '@nfk.st/jdm-editor-vue';
import type { DecisionTableType } from '@nfk.st/jdm-editor-vue';
import '@nfk.st/jdm-editor-vue/dist/style.css';
import { ref } from 'vue';

const mode = ref<'light' | 'dark'>('light');

const expression = ref('age >= 18 && status == "active"');
const builderValue = ref('count > 1');

const tableIds = { in1: crypto.randomUUID(), in2: crypto.randomUUID(), out1: crypto.randomUUID() };
const fnSource = ref(`async function handler(input) {
  const risk = input.age > 60 ? 'high' : 'low';
  return { risk };
}`);
const table = ref<DecisionTableType>({
  hitPolicy: 'first',
  inputs: [
    { id: tableIds.in1, name: 'age', field: 'age', fieldType: { type: 'number' } },
    { id: tableIds.in2, name: 'country', field: 'country', fieldType: { type: 'string' } },
  ],
  outputs: [{ id: tableIds.out1, name: 'risk', field: 'risk', outputFieldType: { type: 'string' } }],
  rules: [
    { _id: crypto.randomUUID(), [tableIds.in1]: '>= 60', [tableIds.in2]: '== "DE"', [tableIds.out1]: '"low"' },
    { _id: crypto.randomUUID(), [tableIds.in1]: '< 30', [tableIds.in2]: '', [tableIds.out1]: '"high"' },
  ],
});

const rows = ref([
  { id: crypto.randomUUID(), key: 'eligible', value: 'age >= 18' },
  { id: crypto.randomUUID(), key: 'score', value: 'min(age / 10, 10)' },
]);

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
      <main class="content">
        <section class="demo">
          <h3>CodeEditor (Zen expression)</h3>
          <CodeEditor v-model="expression" type="unary" style="height: 120px" />
          <pre class="value">{{ expression }}</pre>
        </section>

        <section class="demo">
          <h3>ExpressionBuilder</h3>
          <ExpressionBuilder v-model="builderValue" />
          <pre class="value">{{ builderValue }}</pre>
        </section>

        <section class="demo">
          <h3>Expression (row editor)</h3>
          <Expression v-model="rows" />
          <pre class="value">{{ rows.map((r) => `${r.key} = ${r.value}`).join('\n') }}</pre>
        </section>

        <section class="demo demo--wide">
          <h3>DecisionTable</h3>
          <DecisionTable v-model="table" :table-height="360" />
        </section>

        <section class="demo demo--wide">
          <h3>Function editor (Monaco + debugger)</h3>
          <div class="fn-host">
            <FunctionEditor v-model="fnSource" :input-data="{ age: 42 }" />
          </div>
        </section>

        <section class="demo muted">
          <p>DecisionGraph component ports with the decision-graph module.</p>
          <p>Current graph JSON: {{ graph.nodes.length }} nodes / {{ graph.edges.length }} edges</p>
        </section>
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
.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  overflow: auto;
}
.demo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 640px;
}

.demo--wide {
  max-width: 100%;
}

.fn-host {
  height: 420px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  border-radius: 6px;
  overflow: hidden;
}
.value {
  margin: 0;
  padding: 8px;
  background: rgba(127, 127, 127, 0.1);
  border-radius: 4px;
  font-size: 12px;
}
.muted {
  opacity: 0.65;
}
</style>
