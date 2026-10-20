<script lang="ts">
// Ported from components/decision-graph/graph/tab-json-schema.tsx.
import type { editor } from 'monaco-editor';

// module-scope constant (upstream file body)
const monacoOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  contextmenu: false,
  fontSize: 13,
  fontFamily: 'var(--mono-font-family)',
  tabSize: 2,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  scrollbar: {
    verticalSliderSize: 4,
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontalSliderSize: 4,
  },
};

const schemaTooltip = 'Provide JSON Schema format. If no JSON Schema is provided, validation will be skipped.';

// PORTING(DnD): upstream's `manager?: DragDropManager` prop is dropped with
// react-dnd (docs/PORTING.md dependency map) — renderTab passes only the id.
export type TabJsonSchemaProps = {
  id: string;
  type?: 'input' | 'output';
};
</script>

<script setup lang="ts">
// PORTING: @monaco-editor/react (Editor/DiffEditor) → helpers/monaco loader +
// direct monaco.editor.create/createDiffEditor lifecycle (function.vue's
// mount/dispose discipline; value sync on BOTH diff sides per its round-5
// lesson). react-resizable-panels PanelGroup → splitpanes (autoSaveId has no
// equivalent — dropped). antd theme.useToken → useThemeMode + token vars.
import { useThrottleFn } from '@vueuse/core';
import { Import, Info, Paintbrush } from 'lucide-vue-next';
import { Pane, Splitpanes } from 'splitpanes';
import { match } from 'ts-pattern';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import type { Monaco } from '../../../helpers/monaco';
import { loader } from '../../../helpers/monaco';
import { useThemeMode } from '../../../theme';
import Button from '../../ui/Button.vue';
import Spinner from '../../ui/Spinner.vue';
import Tabs from '../../ui/Tabs.vue';
import Tooltip from '../../ui/Tooltip.vue';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../context/dg-store.context';
import { useTabSerializer } from '../context/serializer.context';
import JsonToJsonSchemaDialog from './json-to-json-schema-dialog.vue';

enum TabKey {
  Schema = 'Schema',
}

const language = 'json';

const props = withDefaults(defineProps<TabJsonSchemaProps>(), { type: 'input' });

const graphActions = useDecisionGraphActions();

const mode = useThemeMode();

const jsonToJsonSchemaOpen = ref(false);
const activeTab = ref<TabKey>(TabKey.Schema);

// upstream reads localStorage for the dialog's model at render time — a
// computed keeps the template free of globals (Vue templates cannot reach
// localStorage).
const dialogModel = computed(() => localStorage.getItem(`${props.id}-model`) || undefined);

const onDialogSuccess = ({ schema, model }: { schema: string; model: string }) => {
  localStorage.setItem(`${props.id}-model`, model);
  graphActions.updateNode(props.id, (draft) => {
    draft.content = { schema };
    return draft;
  });
  jsonToJsonSchemaOpen.value = false;
};

const monaco = shallowRef<Monaco | null>(null);
const monacoReady = ref(false);
const editorRef = shallowRef<editor.IStandaloneCodeEditor | undefined>(undefined);
const diffEditorRef = shallowRef<editor.IStandaloneDiffEditor | undefined>(undefined);
const pendingViewStateRef = ref<editor.ICodeEditorViewState | null>(null);

const editorContainer = ref<HTMLDivElement | null>(null);
const diffContainer = ref<HTMLDivElement | null>(null);

// upstream: useThrottledCallback(layout, 100, { trailing: true })
const resizeEditor = useThrottleFn(() => editorRef.value?.layout(), 100, true);
const resizeDiffEditor = useThrottleFn(() => diffEditorRef.value?.layout(), 100, true);

useTabSerializer<editor.ICodeEditorViewState | null>(props.id, 'monaco', {
  serialize: () => editorRef.value?.saveViewState() ?? pendingViewStateRef.value ?? null,
  restore: (state) => {
    if (!state) return;
    if (editorRef.value) {
      editorRef.value.restoreViewState(state);
    } else {
      pendingViewStateRef.value = state;
    }
  },
});

// upstream: useEffect([editor]) applying a pending view state
watch(editorRef, (editor) => {
  if (editor && pendingViewStateRef.value) {
    editor.restoreViewState(pendingViewStateRef.value);
    pendingViewStateRef.value = null;
  }
});

const state = useDecisionGraphState(({ simulate, disabled, decisionGraph }) => ({
  nodeError: match(simulate)
    .with({ error: { data: { nodeId: props.id } } }, ({ error }) => error)
    .otherwise(() => null),
  disabled,
  content: (decisionGraph?.nodes ?? []).find((node) => node.id === props.id)?.content as { schema?: string },
}));

const { contentDiff } = useNodeDiff(props.id);

const previousValue = computed(() => {
  return contentDiff.value?.fields?.schema?.previousValue;
});

const monacoTheme = computed(() => (mode.value === 'dark' ? 'vs-dark' : 'light'));

const rootStyle = computed(() => ({
  'height': '100%',
  '--color-text': 'var(--grl-color-text-base)',
  '--color-background-elevated': 'var(--grl-color-bg-elevated)',
  '--color-border': 'var(--grl-color-border)',
  '--line-height': 'var(--grl-line-height)',
}));

const onWindowResize = () => {
  resizeEditor();
  resizeDiffEditor();
};

onMounted(async () => {
  window.addEventListener('resize', onWindowResize);

  const instance = await loader.init();
  monaco.value = instance;
  monacoReady.value = true;
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  disposeEditors();
});

const disposeEditors = () => {
  editorRef.value?.getModel()?.dispose();
  editorRef.value?.dispose();
  editorRef.value = undefined;
  const diff = diffEditorRef.value;
  if (diff) {
    diff.getModel()?.original?.dispose();
    diff.getModel()?.modified?.dispose();
    diff.dispose();
    diffEditorRef.value = undefined;
  }
};

// Editor / DiffEditor lifecycle — replaces @monaco-editor/react components;
// the branch follows upstream's previousValue !== undefined render switch.
const createEditors = () => {
  const instance = monaco.value;
  if (!instance) return;

  if (previousValue.value !== undefined) {
    if (diffContainer.value && !diffEditorRef.value) {
      diffEditorRef.value = instance.editor.createDiffEditor(diffContainer.value, {
        ...monacoOptions,
        readOnly: true,
        theme: monacoTheme.value,
        automaticLayout: true,
      });
      diffEditorRef.value.setModel({
        original: instance.editor.createModel(previousValue.value, language),
        modified: instance.editor.createModel(state.value.content?.schema || '', language),
      });
    }
  } else if (editorContainer.value && !editorRef.value) {
    editorRef.value = instance.editor.create(editorContainer.value, {
      ...monacoOptions,
      readOnly: state.value.disabled,
      theme: monacoTheme.value,
      automaticLayout: true,
      value: state.value.content?.schema || '',
      language,
    });
    // upstream: the Editor wrapper's onChange → updateNode
    editorRef.value.onDidChangeModelContent(() => {
      const value = editorRef.value?.getValue() ?? '';
      graphActions.updateNode(props.id, (draft) => {
        draft.content = { schema: value };
        return draft;
      });
    });
  }
};

// (re)create on init + on the previousValue branch toggle; the v-if container
// swap orphans the old editor's DOM node, so dispose first (function.vue's
// review-5 discipline).
watch(
  () => [monacoReady.value, previousValue.value] as const,
  () => {
    disposeEditors();
    createEditors();
  },
  { flush: 'post' },
);

// value sync: external content writes must reach the model (round-5) —
// upstream's Editor wrapper does this via its value prop effect.
watch(
  () => state.value.content?.schema,
  (value) => {
    const editor = editorRef.value;
    if (editor && editor.getValue() !== (value ?? '')) {
      editor.setValue(value ?? '');
    }
    const modified = diffEditorRef.value?.getModel()?.modified;
    if (modified && modified.getValue() !== (value ?? '')) {
      modified.setValue(value ?? '');
    }
  },
);

// original side of the diff syncs with previousValue (round-5)
watch(
  () => previousValue.value,
  (previous) => {
    const original = diffEditorRef.value?.getModel()?.original;
    if (original && previous !== undefined && original.getValue() !== previous) {
      original.setValue(previous);
    }
  },
);

// theme switching (upstream passes theme per editor via props)
watch(monacoTheme, (theme) => monaco.value?.editor.setTheme(theme));
</script>

<template>
  <div class="grl-node-content" :data-theme="mode" :style="rootStyle">
    <!-- PORTING: react-resizable-panels PanelGroup (autoSaveId dropped) →
         splitpanes. -->
    <Splitpanes class="grl-node-content-main">
      <Pane>
        <div class="grl-node-content-side">
          <div class="grl-node-content-side__panel">
            <div class="grl-node-content-side__header">
              <Tabs
                class="grl-inline-tabs"
                size="small"
                :style="{ width: '100%' }"
                :model-value="activeTab"
                :items="Object.values(TabKey).map((t) => ({ key: t }))"
                @update:model-value="(t) => (activeTab = t as TabKey)"
              >
                <template #label="{ label }">
                  <span>
                    {{ label }}
                    <Tooltip :content="schemaTooltip">
                      <Info :size="10" :style="{ marginLeft: '4px', opacity: 0.5, verticalAlign: 'text-top' }" />
                    </Tooltip>
                  </span>
                </template>
                <template #extra>
                  <Tooltip content="Format code">
                    <Button
                      size="small"
                      type="text"
                      :disabled="state.disabled"
                      @click="() => editorRef?.getAction?.('editor.action.formatDocument')?.run?.()"
                    >
                      <template #icon><Paintbrush /></template>
                    </Button>
                  </Tooltip>
                  <Tooltip content="Import from JSON">
                    <Button size="small" type="text" :disabled="state.disabled" @click="jsonToJsonSchemaOpen = true">
                      <template #icon><Import /></template>
                    </Button>
                  </Tooltip>
                </template>
              </Tabs>
            </div>
            <div class="grl-node-content-side__body">
              <template v-if="activeTab === TabKey.Schema">
                <template v-if="previousValue !== undefined">
                  <Spinner v-if="!monacoReady" size="large" />
                  <div v-show="monacoReady" ref="diffContainer" style="height: 100%" />
                </template>
                <template v-else>
                  <Spinner v-if="!monacoReady" size="large" />
                  <div v-show="monacoReady" ref="editorContainer" style="height: 100%" />
                </template>
              </template>
            </div>
            <!-- PORTING: upstream's JsonToJsonSchemaDialog takes onSuccess /
                 onDismiss as callback PROPS (not emits) — bound as props. -->
            <JsonToJsonSchemaDialog
              :is-open="jsonToJsonSchemaOpen"
              :model="dialogModel"
              :on-dismiss="() => (jsonToJsonSchemaOpen = false)"
              :on-success="onDialogSuccess"
            />
          </div>
        </div>
      </Pane>
    </Splitpanes>
  </div>
</template>
