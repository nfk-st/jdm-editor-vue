<script lang="ts">
// Ported from components/function/function-debugger.tsx.
import type { editor } from 'monaco-editor';

import type { SimulationTrace, SimulationTraceDataFunction } from './types';
import type { FunctionLibrary } from './helpers/libs';

export enum TabKey {
  Console = 'Console',
  Libraries = 'Libraries',
}

export type FunctionDebuggerProps = {
  trace?: SimulationTrace<SimulationTraceDataFunction>;
  editor?: editor.IStandaloneCodeEditor;
  editorValue?: string;
  libraries: FunctionLibrary[];
  disabled?: boolean;
};
</script>

<script setup lang="ts">
// PORTING: antd Tabs/Button/Tooltip/Typography → ui/Tabs (reka) + ui/Button +
// ui/Tooltip + .grl-typography classes; @ant-design/icons → lucide-vue-next;
// upstream's private FunctionLibraryItem subcomponent (same file) is inlined
// into the Libraries tab — same markup, its useMemo canImport becomes a
// helper; ts-pattern's exhaustive match(activeTab) → v-if/v-else (two-way
// switch, same semantics).
import { ExternalLink, Paintbrush, Plus } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import typeScriptIcon from '../assets/typescript.svg?inline';
import Button from '../ui/Button.vue';
import Tabs from '../ui/Tabs.vue';
import Tooltip from '../ui/Tooltip.vue';
import FunctionDebuggerLog from './function-debugger-log.vue';

const props = withDefaults(defineProps<FunctionDebuggerProps>(), {
  libraries: () => [],
});

const traceLog = computed(() => props.trace?.traceData?.log || []);
const activeTab = ref<TabKey>(TabKey.Console);

const formatCode = () => props.editor?.getAction?.('editor.action.formatDocument')?.run?.();

// upstream (inline in JSX): ['"Info: Use console.log and run simulation to debug your code."']
const emptyTraceLines = ['"Info: Use console.log and run simulation to debug your code."'];

// upstream FunctionLibraryItem's useMemo([lib.name, editorValue]).
const canImport = (lib: FunctionLibrary) => {
  if (!props.editorValue) {
    return true;
  }

  return !props.editorValue.includes(`from "${lib.name}"`) && !props.editorValue.includes(`from '${lib.name}'`);
};

const importLibrary = (lib: FunctionLibrary) => {
  if (!props.editor) {
    return;
  }

  const importStatement = `import ${lib.importName ?? lib.name} from '${lib.name}';`;
  props.editor.setValue(importStatement + '\n' + props.editor.getValue());
};
</script>

<template>
  <div class="grl-function__debugger">
    <div class="grl-function__debugger__panel">
      <div class="grl-function__debugger__header">
        <Tabs v-model="activeTab" :items="Object.values(TabKey)" size="small" style="width: 100%">
          <template #extra>
            <div style="margin-right: 8px">
              <!-- PORTING: ui/Tooltip has no placement prop (antd bottomLeft) -->
              <Tooltip content="Format code">
                <Button size="small" type="text" @click="formatCode">
                  <template #icon><Paintbrush :size="14" /></template>
                </Button>
              </Tooltip>
            </div>
          </template>
        </Tabs>
      </div>
      <div class="grl-function__debugger__body">
        <!-- upstream: match(activeTab).with(Console).with(Libraries).exhaustive() -->
        <template v-if="activeTab === TabKey.Console">
          <FunctionDebuggerLog
            v-if="traceLog.length === 0"
            :lines="['&quot;Info: Use console.log and run simulation to debug your code.&quot;']"
            :ms-since-run="null"
          />

          <FunctionDebuggerLog v-for="(log, i) in traceLog" :key="i" :lines="log.lines" :ms-since-run="log.msSinceRun" />
        </template>

        <div v-else class="grl-function__libraries">
          <!-- upstream's private FunctionLibraryItem, inlined (see header note) -->
          <div v-for="lib in libraries" :key="lib.name" class="grl-function__libraries__item">
            <img alt="TypeScript Library" :src="typeScriptIcon" height="18" />
            <span class="grl-typography" style="font-weight: 600">{{ lib.name }}</span>
            <span class="grl-typography grl-typography--secondary" style="font-size: 12px; margin-top: 1.5px">
              {{ lib.tagline }}
            </span>
            <div class="grl-function__libraries__item__actions">
              <Tooltip content="Import library">
                <Button type="text" size="small" :disabled="!canImport(lib) || disabled" @click="importLibrary(lib)">
                  <template #icon><Plus :size="14" /></template>
                </Button>
              </Tooltip>
              <Tooltip content="Go to documentation">
                <!-- PORTING: antd Button with href renders an anchor; ui/Button is a
                  <button>, so the doc link is a token-styled <a> and renders a
                  disabled button when there is no documentationUrl. -->
                <a
                  v-if="lib.documentationUrl"
                  class="grl-btn grl-btn--text grl-btn--small"
                  :href="lib.documentationUrl"
                  target="_blank"
                >
                  <ExternalLink :size="14" />
                </a>
                <Button v-else type="text" size="small" disabled>
                  <template #icon><ExternalLink :size="14" /></template>
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
