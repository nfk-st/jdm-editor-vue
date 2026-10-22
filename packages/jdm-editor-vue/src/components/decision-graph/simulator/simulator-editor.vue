<script setup lang="ts">
// Ported from simulator/simulator-editor.tsx — Monaco editor with copy/format
// actions. PORTING: @monaco-editor/react → our loader + direct create
// (function.vue pattern, incl. the round-5 value-sync lesson); antd message →
// ui/Toast.
import json5 from 'json5';
import type { editor } from 'monaco-editor';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import { type Monaco, loader } from '../../../helpers/monaco';
import { copyToClipboard } from '../../../helpers/utility';
import { useThemeMode } from '../../../theme';
import Spinner from '../../ui/Spinner.vue';
import { useToast } from '../../ui/toast';

// PORTING: upstream's `value` / `onChange` pair becomes `modelValue` +
// `update:modelValue` on our public components (PORTING.md's React → Vue
// table); `change` is kept alongside, as in every other public component of
// this port (ui/Input.vue exemplar).
const props = defineProps<{
  modelValue?: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
  (e: 'change', value: string | undefined): void;
}>();

const mode = useThemeMode();
const toast = useToast();
const monaco = shallowRef<Monaco | null>(null);
const container = ref<HTMLDivElement | null>(null);
const editorRef = shallowRef<editor.IStandaloneCodeEditor | null>(null);

const monacoTheme = () => (mode.value === 'dark' ? 'vs-dark' : 'light');

onMounted(async () => {
  const instance = await loader.init();
  monaco.value = instance;

  instance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSyntaxValidation: true,
  });

  instance.languages.typescript.javascriptDefaults.setModeConfiguration({
    codeActions: false,
    inlayHints: false,
  });

  if (!container.value) return;
  editorRef.value = instance.editor.create(container.value, {
    value: props.modelValue ?? '',
    language: 'javascript',
    theme: monacoTheme(),
    automaticLayout: true,
    readOnly: props.readOnly,
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
  });

  editorRef.value.onDidChangeModelContent(() => {
    const value = editorRef.value?.getValue();
    emit('update:modelValue', value);
    emit('change', value);
  });

  editorRef.value.addAction({
    id: 'copy-json',
    label: 'Copy JSON',
    contextMenuGroupId: 'utils',
    run: async (activeEditor) => {
      try {
        await copyToClipboard(JSON.stringify(json5.parse(activeEditor.getValue())));
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
    run: (activeEditor) => {
      const formatted = JSON.stringify(json5.parse(activeEditor.getValue()), null, 2);
      activeEditor.setValue(formatted);
    },
  });
});

onBeforeUnmount(() => {
  editorRef.value?.getModel()?.dispose();
  editorRef.value?.dispose();
});

// round-5 lesson: external value writes sync into the model
watch(
  () => props.modelValue,
  (value) => {
    const activeEditor = editorRef.value;
    if (activeEditor && value !== undefined && activeEditor.getValue() !== value) {
      activeEditor.setValue(value);
    }
  },
);

watch(
  () => props.readOnly,
  (readOnly) => editorRef.value?.updateOptions({ readOnly }),
);

watch(mode, () => monaco.value?.editor.setTheme(monacoTheme()));
</script>

<template>
  <div class="grl-dg__simulator__editor">
    <Spinner v-if="!monaco" size="large" />
    <div v-show="monaco" ref="container" class="grl-dg__simulator__editor__host" />
  </div>
</template>

<style lang="scss">
.grl-dg__simulator__editor {
  position: relative;
  height: 100%;

  &__host {
    height: 100%;
  }
}
</style>
