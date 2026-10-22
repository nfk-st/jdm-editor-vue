<script lang="ts">
// Ported from components/decision-graph/graph/json-to-json-schema-dialog.tsx.
export type JsonToJsonSchemaDialogProps = {
  id?: string;
  onSuccess?: (payload: { schema: string; model: string }) => void;
  onDismiss?: () => void;
  isOpen?: boolean;
  model?: string;
};
</script>

<script setup lang="ts">
// PORTING: @monaco-editor/react Editor → helpers/monaco loader + direct
// monaco.editor.create lifecycle (function.vue's mount/dispose discipline;
// value sync per the round-5 lesson). antd Modal → ui/Modal (reka-ui Dialog
// unmounts content while closed — antd destroyOnClose parity). antd message →
// ui/Toast.
import json5 from 'json5';
import type { editor } from 'monaco-editor';
import toJsonSchema from 'to-json-schema';
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import type { Monaco } from '../../../helpers/monaco';
import { loader } from '../../../helpers/monaco';
import { copyToClipboard } from '../../../helpers/utility';
import { useThemeMode } from '../../../theme';
import Button from '../../ui/Button.vue';
import Modal from '../../ui/Modal.vue';
import { useToast } from '../../ui/toast';

const toast = useToast();

const props = defineProps<JsonToJsonSchemaDialogProps>();

const mode = useThemeMode();

const value = ref<string>('');

// upstream: useEffect([isOpen]) — if (isOpen && model) setValue(model)
watch(
  () => props.isOpen,
  (open) => {
    if (open && props.model) {
      value.value = props.model;
    }
  },
  { immediate: true },
);

// --- monaco lifecycle (replaces @monaco-editor/react's <Editor>) ----------
const monaco = shallowRef<Monaco | null>(null);
const monacoReady = ref(false);
const editorRef = shallowRef<editor.IStandaloneCodeEditor | undefined>(undefined);
const editorContainer = ref<HTMLDivElement | null>(null);

const monacoTheme = () => (mode.value === 'dark' ? 'vs-dark' : 'light');

const onOk = () => {
  try {
    props.onSuccess?.({
      schema: JSON.stringify(toJsonSchema(json5.parse(value.value)), null, 2),
      model: value.value,
    });
  } catch (e: any) {
    toast.error(e?.message);
  }
};

const createEditor = async () => {
  const instance = monaco.value ?? (await loader.init());
  monaco.value = instance;
  monacoReady.value = true;

  instance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSyntaxValidation: true,
  });

  instance.languages.typescript.javascriptDefaults.setModeConfiguration({
    codeActions: false,
    inlayHints: false,
  });

  if (!editorContainer.value || editorRef.value) return;

  editorRef.value = instance.editor.create(editorContainer.value, {
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 12,
    fontFamily: 'var(--mono-font-family)',
    tabSize: 2,
    lineDecorationsWidth: 2,
    find: {
      addExtraSpaceOnTop: false,
      seedSearchStringFromSelection: 'never',
    },
    scrollbar: {
      verticalSliderSize: 4,
      verticalScrollbarSize: 4,
      horizontalScrollbarSize: 4,
      horizontalSliderSize: 4,
    },
    lineNumbersMinChars: 3,
    theme: monacoTheme(),
    value: value.value || '',
    language: 'javascript',
  });

  editorRef.value.addAction({
    id: 'copy-json',
    label: 'Copy JSON',
    contextMenuGroupId: 'utils',
    run: async (editor) => {
      try {
        await copyToClipboard(JSON.stringify(json5.parse(editor.getValue())));
        toast.success('Copied to clipboard!');
      } catch {
        toast.error('Failed to copy to clipboard.');
      }
    },
  });

  editorRef.value.addAction({
    id: 'format',
    label: 'Format',
    contextMenuGroupId: 'utils',
    precondition: '!editorReadonly',
    run: (editor) => {
      const formatted = JSON.stringify(json5.parse(editor.getValue()), null, 2);
      editor.setValue(formatted);
    },
  });

  // upstream: the Editor wrapper's onChange → setValue
  editorRef.value.onDidChangeModelContent(() => {
    value.value = editorRef.value?.getValue() ?? '';
  });
};

// the modal body mounts with open (destroyOnClose parity) — create once the
// container exists, dispose when it goes away.
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => void createEditor());
    } else {
      disposeEditor();
    }
  },
  { flush: 'post' },
);

// value sync: external model writes reach the model (round-5 lesson) — the
// isOpen effect above already seeds `value` before the editor mounts.
watch(value, (next) => {
  const editor = editorRef.value;
  if (editor && editor.getValue() !== (next ?? '')) {
    editor.setValue(next ?? '');
  }
});

// theme switching (upstream passes theme per editor via props)
watch(mode, (theme) => monaco.value?.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'light'));

function disposeEditor() {
  editorRef.value?.getModel()?.dispose();
  editorRef.value?.dispose();
  editorRef.value = undefined;
}

onBeforeUnmount(disposeEditor);
</script>

<template>
  <Modal :open="!!isOpen" title="Convert to JSON Schema" :width="540" @update:open="(o) => !o && props.onDismiss?.()">
    <span class="grl-typography">Type or paste JSON or JSON5 model here and covert it to JSON Schema</span>
    <div ref="editorContainer" :style="{ height: '400px', marginTop: '12px' }" />
    <template #footer>
      <Button @click="props.onDismiss?.()">Cancel</Button>
      <Button type="primary" @click="onOk">Convert</Button>
    </template>
  </Modal>
</template>
