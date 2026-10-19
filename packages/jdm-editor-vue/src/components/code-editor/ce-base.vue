<script lang="ts">
// Ported from components/code-editor/ce-base.tsx — the core CodeMirror 6
// wrapper. CodeMirror is vanilla: the view is created in onMounted and
// destroyed in onBeforeUnmount (SSR-import-safe, see docs/PORTING.md).
import type { Extension } from '@codemirror/state';

export type ExtensionParams = {
  type?: 'standard' | 'unary' | 'template';
};

// PORTING: upstream spreads React.HTMLAttributes onto the root div; here
// unknown attrs/events fall through via v-bind="$attrs" (class/style merge).
// The `onChange`/`onStateChange` function props become `change`/`stateChange`
// emits (see autosize-text-area.vue precedent).
export type CodeEditorBaseProps = {
  maxRows?: number;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  type?: 'unary' | 'standard' | 'template';
  lint?: boolean;
  strict?: boolean;
  fullHeight?: boolean;
  noStyle?: boolean;
  extension?: (params: ExtensionParams) => Extension;
  livePreview?: { input: unknown; fromSimulation: boolean; result?: unknown };
  variableType?: any;
  expectedVariableType?: any;
  lazy?: boolean;
  initialSelection?: { anchor: number; head?: number };
};

// PORTING: upstream's ref is the HTMLDivElement itself augmented with
// `codeMirror` (business/focus-helper.ts reads it off the DOM element via
// querySelector). Vue template refs receive this exposed object instead; the
// DOM element still carries `.codeMirror` so that helper keeps working.
export type CodeEditorBaseRef = {
  el: HTMLDivElement | null;
  codeMirror: EditorView | null;
};
</script>

<script setup lang="ts">
import { bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, Text } from '@codemirror/state';
import { EditorView, placeholder as placeholderExt } from '@codemirror/view';
import { createVariableType } from '@gorules/zen-engine-wasm';
import clsx from 'clsx';
import { clamp } from 'lodash';
import { match } from 'ts-pattern';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import { isWasmAvailable } from '../../helpers/wasm';
import { useThemeMode } from '../../theme';
import {
  updateExpectedVariableTypeEffect,
  updateExpressionTypeEffect,
  updateStrictModeEffect,
  updateVariableTypeEffect,
} from './extensions/types';
import { zenExtensions, zenStyleDark, zenStyleLight } from './extensions/zen';

defineOptions({ inheritAttrs: false });

// withDefaults mirrors upstream's destructuring defaults.
const props = withDefaults(defineProps<CodeEditorBaseProps>(), {
  type: 'standard',
  lint: true,
  strict: false,
  fullHeight: false,
  noStyle: false,
});

const emit = defineEmits<{
  (e: 'change', value: string): void;
  (e: 'stateChange', state: EditorState): void;
}>();

const container = ref<HTMLDivElement | null>(null);
const codeMirror = shallowRef<EditorView | null>(null);
// antd theme.useToken() → useThemeMode() (docs/PORTING.md antd → tokens).
const mode = useThemeMode();

const zenHighlightDark = syntaxHighlighting(zenStyleDark);
const zenHighlightLight = syntaxHighlighting(zenStyleLight);

const editorTheme = (isDark = false) => (isDark ? zenHighlightDark : zenHighlightLight);

// PORTING: emits are stable for the component's lifetime, so the update
// listener never needs reconfiguring — upstream's [onChange, onStateChange]
// effect (compartment reconfigure) is dropped.
const updateListener = () =>
  EditorView.updateListener.of((update) => {
    emit('stateChange', update.state);
    if (!update.docChanged) {
      return;
    }

    emit('change', update.state.doc.toString());
  });

// useMemo → plain per-instance consts (setup runs once per instance).
const compartment = {
  zenExtension: new Compartment(),
  theme: new Compartment(),
  placeholder: new Compartment(),
  readOnly: new Compartment(),
  updateListener: new Compartment(),
  userProvided: new Compartment(),
};

const applyTypeLint = (type: NonNullable<CodeEditorBaseProps['type']>, lint: boolean) => {
  codeMirror.value?.dispatch({
    effects: [
      compartment.zenExtension.reconfigure(zenExtensions({ type, lint })),
      updateExpressionTypeEffect.of(
        match(type)
          .with('unary', () => 'unary' as const)
          .otherwise(() => 'standard' as const),
      ),
    ],
  });
};

const applyVariableType = (variableType: any) => {
  if (!codeMirror.value || !isWasmAvailable()) {
    return;
  }

  if (variableType === null || variableType === undefined) {
    codeMirror.value.dispatch({
      effects: updateVariableTypeEffect.of(null),
    });
    return;
  }

  codeMirror.value.dispatch({
    effects: updateVariableTypeEffect.of(createVariableType(variableType)),
  });
};

const applyExpectedVariableType = (expectedVariableType: any) => {
  if (!codeMirror.value || !isWasmAvailable()) {
    return;
  }

  if (expectedVariableType === null || expectedVariableType === undefined) {
    codeMirror.value.dispatch({
      effects: updateExpectedVariableTypeEffect.of(null),
    });
    return;
  }

  codeMirror.value.dispatch({
    effects: updateExpectedVariableTypeEffect.of(createVariableType(expectedVariableType)),
  });
};

const applyStrictMode = (strict: boolean) => {
  codeMirror.value?.dispatch({
    effects: updateStrictModeEffect.of(strict),
  });
};

onMounted(() => {
  if (!container.value || codeMirror.value) {
    return;
  }

  // PORTING: upstream's queueMicrotask/didMount dance is a React Strict Mode
  // workaround — Vue has no double-mount, so cleanup simply lives in
  // onBeforeUnmount.

  const clampSelection = (n: number) => clamp(n, 0, props.value?.length ?? 0);

  const editorView = new EditorView({
    parent: container.value,
    state: EditorState.create({
      doc: props.value,
      selection: props.initialSelection
        ? {
            head: props.initialSelection.head ? clampSelection(props.initialSelection.head) : undefined,
            anchor: clampSelection(props.initialSelection.anchor),
          }
        : undefined,
      extensions: [
        EditorView.lineWrapping,
        bracketMatching(),
        compartment.zenExtension.of(zenExtensions({ type: props.type, lint: props.lint })),
        compartment.updateListener.of(updateListener()),
        compartment.theme.of(editorTheme(mode.value === 'dark')),
        compartment.placeholder.of(props.placeholder ? placeholderExt(props.placeholder) : []),
        compartment.readOnly.of(EditorView.editable.of(!props.disabled)),
        compartment.userProvided.of(props.extension?.({ type: props.type }) ?? []),
      ],
    }),
  });

  if (props.initialSelection) {
    editorView.focus();
  }

  codeMirror.value = editorView;
  if (container.value) {
    // Same DOM attachment as upstream, so business/focus-helper.ts can read
    // `.grl-ce` → `.codeMirror` via querySelector (kept 1:1).
    (container.value as HTMLDivElement & { codeMirror?: EditorView | null }).codeMirror = editorView;
  }

  // React effects with deps also run once on mount; the value/theme/placeholder/
  // disabled/extension effects are no-ops there (identical reconfigure), but
  // these four carry real state — replay them in upstream declaration order.
  applyTypeLint(props.type, props.lint);
  applyVariableType(props.variableType);
  applyExpectedVariableType(props.expectedVariableType);
  applyStrictMode(props.strict);
});

onBeforeUnmount(() => {
  codeMirror.value?.destroy();
  codeMirror.value = null;
});

watch(
  () => props.value,
  (value) => {
    if (!codeMirror.value || value === undefined) {
      return;
    }

    const cm = codeMirror.value;
    if (cm.state.doc.eq(Text.of(value.split('\n')))) {
      return;
    }

    const currentHead = cm.state.selection.main.head;
    const newLength = value.length;

    cm.dispatch({
      changes: {
        from: 0,
        to: cm.state.doc.length,
        insert: value,
      },
      // Adjust the selection if it would be out of bounds
      ...(currentHead > newLength && { selection: { anchor: newLength } }),
    });
  },
);

watch(mode, () => {
  codeMirror.value?.dispatch({
    effects: compartment.theme.reconfigure(editorTheme(mode.value === 'dark')),
  });
});

watch(
  () => props.placeholder,
  (placeholder) => {
    codeMirror.value?.dispatch({
      effects: compartment.placeholder.reconfigure(placeholder ? placeholderExt(placeholder) : []),
    });
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    codeMirror.value?.dispatch({
      effects: compartment.readOnly.reconfigure(EditorView.editable.of(!disabled)),
    });
  },
);

watch([() => props.type, () => props.lint], ([type, lint]) => {
  applyTypeLint(type, lint);
});

watch([() => props.extension, () => props.type], () => {
  codeMirror.value?.dispatch({
    effects: compartment.userProvided.reconfigure(props.extension?.({ type: props.type }) ?? []),
  });
});

watch(
  () => props.variableType,
  (variableType) => {
    applyVariableType(variableType);
  },
);

watch(
  () => props.expectedVariableType,
  (expectedVariableType) => {
    applyExpectedVariableType(expectedVariableType);
  },
);

watch(
  () => props.strict,
  (strict) => {
    applyStrictMode(strict);
  },
);

defineExpose({ el: container, codeMirror });
</script>

<template>
  <div
    ref="container"
    v-bind="$attrs"
    :class="clsx('grl-ce', maxRows && !fullHeight && 'max-rows', fullHeight && 'full-height', noStyle && 'no-style')"
    :style="{ '--editorMaxRows': maxRows }"
    :data-type="type"
  />
</template>
