<script lang="ts">
// Ported from components/function/function.tsx — the public Function editor.
import type { editor } from 'monaco-editor';

import type { SimulationTrace, SimulationTraceDataFunction } from './types';

export type FunctionPermission = 'edit:full';

export type FunctionProps = {
  disabled?: boolean;
  defaultValue?: string;
  disableDebug?: boolean;
  language?: string;
  // PORTING: upstream value/onChange → modelValue (v-model convention)
  modelValue?: string;
  previousValue?: string;
  trace?: SimulationTrace<SimulationTraceDataFunction>;
  libraries?: FunctionLibrary[];
  inputData?: unknown;
  permission?: FunctionPermission;
  error?: {
    data: { nodeId: string; source?: string };
  };
};

// module-scope constant (upstream file tail)
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
</script>

<script setup lang="ts">
// PORTING: upstream value/onChange → modelValue + update:modelValue (v-model);
// onMonacoReady/onEditorMount → monaco-ready/editor-mount emits.
// @monaco-editor/react (useMonaco/Editor/DiffEditor) → our helpers/monaco
// loader + direct monaco.editor.create/createDiffEditor lifecycle (the
// ce-base.vue mount/dispose discipline applied to Monaco).
import { createVariableType } from '@gorules/zen-engine-wasm';
import { useDebounceFn, useThrottleFn } from '@vueuse/core';
import { MarkerSeverity } from 'monaco-editor';
import { Splitpane, Splitpanes } from 'splitpanes';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import '../../helpers/monaco';
import { type Monaco, loader } from '../../helpers/monaco';
import { isWasmAvailable } from '../../helpers/wasm';
import { useThemeMode } from '../../theme';
import FunctionDebugger from './function-debugger.vue';
import './function.scss';
import { variableTypeToTypescript } from './helpers/determine-type';
import { type FunctionLibrary, functionDefinitions, functionLibraries } from './helpers/libs';
import type { FunctionDebuggerTrace } from './types';

const props = withDefaults(defineProps<FunctionProps>(), {
  disabled: false,
  language: 'javascript',
  permission: 'edit:full',
  libraries: () => functionLibraries,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string): void;
  (e: 'monacoReady', monaco: Monaco): void;
  (e: 'editorMount', editor: editor.IStandaloneCodeEditor): void;
}>();

const monaco = shallowRef<Monaco | null>(null);
const mounted = ref(false);
const mode = useThemeMode();

// upstream: useState<string>() innerValue; value prop syncs post-mount
const innerValue = ref<string | undefined>(undefined);
const decorations = shallowRef<editor.IEditorDecorationsCollection | undefined>(undefined);

// upstream: useDebouncedCallback(onChange, 100)
const innerChange = useDebounceFn((val: string) => {
  emit('update:modelValue', val);
  emit('change', val);
}, 100);

const editorRef = shallowRef<editor.IStandaloneCodeEditor | undefined>(undefined);
const diffEditorRef = shallowRef<editor.IStandaloneDiffEditor | undefined>(undefined);

// upstream: useThrottledCallback(layout, 100, { trailing: true })
const resizeEditor = useThrottleFn(() => editorRef.value?.layout(), 100, true);
const resizeDiffEditor = useThrottleFn(() => diffEditorRef.value?.layout(), 100, true);

const editorContainer = ref<HTMLDivElement | null>(null);
const diffContainer = ref<HTMLDivElement | null>(null);

const onWindowResize = () => {
  resizeEditor();
  resizeDiffEditor();
};

onMounted(async () => {
  window.addEventListener('resize', onWindowResize);

  const instance = await loader.init();
  monaco.value = instance;

  innerValue.value = props.modelValue === undefined ? props.defaultValue : props.modelValue;
  mounted.value = true;
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  decorations.value?.clear();
  editorRef.value?.dispose();
  diffEditorRef.value?.dispose();
});

// upstream [monaco, libraries] effect: compiler options + lib typedefs
watch(
  () => [monaco.value, props.libraries] as const,
  ([instance]) => {
    if (!instance) return;

    instance.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: instance.languages.typescript.ScriptTarget.ES2020,
      module: instance.languages.typescript.ModuleKind.ESNext,
      moduleResolution: instance.languages.typescript.ModuleResolutionKind.NodeJs,
      allowSyntheticDefaultImports: true,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: true,
      lib: ['es2023'],
    });

    instance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSyntaxValidation: false,
      noSemanticValidation: false,
      noSuggestionDiagnostics: false,
      onlyVisible: false,
    });

    instance.languages.typescript.javascriptDefaults.setExtraLibs(
      functionLibraries.map((lib) => ({
        content: `declare module '${lib.name}' { ${lib.typeDef} }`,
        filePath: lib.name,
      })),
    );

    Object.entries(functionDefinitions.globals).forEach(([pkg, types]) => {
      instance.languages.typescript.javascriptDefaults.addExtraLib(types, `ts:${pkg}`);
    });

    emit('monacoReady', instance);
  },
);

// upstream [value] effect with mountedRef gate (skip first run)
watch(
  () => props.modelValue,
  (value) => {
    if (mounted.value && value !== undefined && value !== innerValue.value) {
      innerValue.value = value;
    }
  },
);

// upstream [monaco, inputData] effect: Input/Output/Handler types
watch(
  () => [monaco.value, props.inputData] as const,
  ([instance]) => {
    if (!instance) return;

    let data = 'any';
    if (isWasmAvailable()) {
      data = variableTypeToTypescript(createVariableType(props.inputData));
    }

    instance.languages.typescript.javascriptDefaults.addExtraLib(
      `
    type Input = ${data};
    type Output = Promise<any>;
    
    type Handler = (input: Input) => Output; 
    `,
      'ts:input.d.ts',
    );
  },
);

// upstream [innerValue, monaco] effect: clear markers on edit
watch(
  () => [innerValue.value, monaco.value] as const,
  ([, instance]) => {
    if (!instance) return;

    const model = instance.editor.getModels()?.[0];
    if (!model) {
      return;
    }

    instance.editor.setModelMarkers(model, 'gorules', []);
  },
);

// upstream [innerValue] effect: clear error decoration on edit
watch(innerValue, () => {
  if (!decorations.value) {
    return;
  }

  decorations.value.clear();
  decorations.value = undefined;
});

// upstream [error, editor] effect: error marker + hover decoration
watch(
  () => [props.error, editorRef.value] as const,
  () => {
    const instance = monaco.value;
    try {
      if (!props.error || !instance) {
        return;
      }

      const results = /Error:(\[.*])?(:?\d+)?(:\d+)?(.*)/s.exec(props.error.data.source ?? '');
      if (!results || results.length === 0) {
        return;
      }

      const line = parseFloat((results?.[2] ?? '').replace(/^:/, ''));
      const errorMessage = results?.[4] ?? '';
      if (!line || !errorMessage) {
        return;
      }

      const model = instance.editor.getModels()[0];
      if (!model) {
        return;
      }

      const range = new instance.Range(
        line,
        model.getLineFirstNonWhitespaceColumn(line),
        line,
        model.getLineLastNonWhitespaceColumn(line),
      );

      instance.editor.setModelMarkers(model, 'gorules', [
        {
          severity: MarkerSeverity.Error,
          message: errorMessage,
          startLineNumber: range.startLineNumber,
          endLineNumber: range.endLineNumber,
          startColumn: range.startColumn,
          endColumn: range.endColumn,
        },
      ]);

      const activeEditor = instance.editor.getEditors()[0];
      if (!activeEditor) {
        return;
      }

      const newDecorations = activeEditor.createDecorationsCollection([
        {
          range,
          options: {
            hoverMessage: { value: errorMessage },
            isWholeLine: true,
            className: 'grl-function__errorLineContent',
          },
        },
      ]);

      decorations.value?.clear?.();
      decorations.value = newDecorations;
    } catch {
      //
    }
  },
);

const monacoTheme = computed(() => (mode.value === 'dark' ? 'vs-dark' : 'light'));

// Editor / DiffEditor lifecycle — replaces @monaco-editor/react components.
const createEditors = () => {
  const instance = monaco.value;
  if (!instance) return;

  if (props.previousValue) {
    if (diffContainer.value && !diffEditorRef.value) {
      diffEditorRef.value = instance.editor.createDiffEditor(diffContainer.value, {
        ...monacoOptions,
        readOnly: true,
        theme: monacoTheme.value,
        automaticLayout: true,
      });
      diffEditorRef.value.setModel({
        original: instance.editor.createModel(props.previousValue, props.language),
        modified: instance.editor.createModel(innerValue.value ?? '', props.language),
      });
    }
  } else if (editorContainer.value && !editorRef.value) {
    editorRef.value = instance.editor.create(editorContainer.value, {
      ...monacoOptions,
      readOnly: props.disabled || props.permission !== 'edit:full',
      theme: monacoTheme.value,
      automaticLayout: true,
      value: innerValue.value ?? '',
      language: props.language,
    });
    editorRef.value.onDidChangeModelContent(() => {
      const value = editorRef.value?.getValue() ?? '';
      innerValue.value = value;
      innerChange(value);
    });
    emit('editorMount', editorRef.value);
  }
};

watch(
  () => [monaco.value, props.previousValue] as const,
  () => createEditors(),
  { flush: 'post' },
);

// theme switching (upstream passes theme per editor via props)
watch(monacoTheme, (theme) => monaco.value?.editor.setTheme(theme));

const rootStyle = computed(() => ({
  'height': '100%',
  '--color-text': 'var(--grl-color-text-base)',
  '--color-background-elevated': 'var(--grl-color-bg-elevated)',
  '--color-border': 'var(--grl-color-border)',
  '--line-height': 'var(--grl-line-height)',
}));
</script>

<template>
  <div class="grl-function" :data-theme="mode" :style="rootStyle">
    <!-- PORTING: react-resizable-panels → splitpanes; PanelGroup's autoSaveId
         (layout persistence) has no splitpanes equivalent — dropped. -->
    <Splitpanes class="grl-function__content">
      <Splitpane :size="70" :min-size="50">
        <div v-if="previousValue" ref="diffContainer" class="grl-function__editor-host" />
        <div v-else ref="editorContainer" class="grl-function__editor-host" />
      </Splitpane>
      <Splitpane v-if="!disableDebug" :min-size="25" :size="30">
        <FunctionDebugger
          :libraries="functionLibraries"
          :trace="trace as FunctionDebuggerTrace"
          :editor="editorRef"
          :editor-value="modelValue"
          :disabled="disabled || permission !== 'edit:full'"
        />
      </Splitpane>
    </Splitpanes>
  </div>
</template>
