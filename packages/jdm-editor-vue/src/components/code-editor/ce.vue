<script lang="ts">
// Ported from components/code-editor/ce.tsx — the public CodeEditor.
import type { EditorState as CmEditorState } from '@codemirror/state';

import type { CodeEditorBaseProps, CodeEditorBaseRef } from './ce-base.vue';

export type CodeEditorRef = CodeEditorBaseRef;

// PORTING: `value`/`onChange` → `modelValue` + `update:modelValue` (v-model)
// per docs/PORTING.md's public-prop convention; `lazy` rides along as upstream.
export type CodeEditorProps = Omit<CodeEditorBaseProps, 'value'> & {
  modelValue?: string;
  lazy?: boolean;
};

type EditorState = { type: 'lazy' } | { type: 'edit'; initialSelection?: CodeEditorProps['initialSelection'] };
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';

import CodeEditorBase from './ce-base.vue';
import CodeHighlighter from './ce-highlight.vue';
import './ce.scss';

defineOptions({ inheritAttrs: false });

// Destructuring defaults from upstream: lazy = false, value = '', type = 'standard'.
const props = withDefaults(defineProps<CodeEditorProps>(), {
  modelValue: '',
  lazy: false,
  type: 'standard',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'stateChange', state: CmEditorState): void;
  (e: 'blur', event: FocusEvent): void;
}>();

const editorState = ref<EditorState>(props.lazy ? { type: 'lazy' } : { type: 'edit' });
const baseRef = ref<InstanceType<typeof CodeEditorBase> | null>(null);
const highlighterRef = ref<InstanceType<typeof CodeHighlighter> | null>(null);
const isMouseDownRef = ref(false);

// PORTING: upstream takes React.MouseEvent; the native MouseEvent carries the
// same coordinates/selection data.
const getCursorPositionFromClick = (
  event: MouseEvent,
  containerElement: HTMLElement,
): CodeEditorProps['initialSelection'] | null => {
  const selection = document.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);

    const startRange = document.createRange();
    startRange.selectNodeContents(containerElement);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = document.createRange();
    endRange.selectNodeContents(containerElement);
    endRange.setEnd(range.endContainer, range.endOffset);

    return {
      anchor: startRange.toString().length,
      head: endRange.toString().length,
    };
  }

  const position = document.caretPositionFromPoint(event.clientX, event.clientY);
  if (!position) {
    return null;
  }

  const preRange = document.createRange();
  preRange.selectNodeContents(containerElement);
  preRange.setEnd(position.offsetNode, position.offset);

  return { anchor: preRange.toString().length };
};

const handleMouseDown = () => {
  isMouseDownRef.value = true;
};

const handleMouseUp = () => {
  isMouseDownRef.value = false;
};

const handleClick = (event: MouseEvent) => {
  if (props.disabled || editorState.value.type !== 'lazy') {
    return;
  }

  // Upstream measures against the highlighter's container element.
  const containerEl = highlighterRef.value?.el ?? null;
  const selection = containerEl ? (getCursorPositionFromClick(event, containerEl) ?? undefined) : undefined;

  editorState.value = { type: 'edit', initialSelection: selection };
};

const handleFocus = () => {
  if (props.disabled || editorState.value.type !== 'lazy' || isMouseDownRef.value) {
    return;
  }

  editorState.value = { type: 'edit', initialSelection: { anchor: props.modelValue.length } };
};

const handleBlur = (event: FocusEvent) => {
  emit('blur', event);

  if (props.lazy) {
    editorState.value = { type: 'lazy' };
  }
};

const value = computed(() => props.modelValue);

// useImperativeHandle → defineExpose; `codeMirror` is undefined while the lazy
// highlighter branch is mounted (same as upstream's div-only ref there).
defineExpose({
  codeMirror: computed(() => baseRef.value?.codeMirror ?? null),
  el: computed(() => baseRef.value?.el ?? highlighterRef.value?.el ?? null),
});
</script>

<template>
  <!-- PORTING: explicit bindings after v-bind="$attrs" keep upstream's
       {...props}-spread-last override semantics for same-named listeners.
       React's onBlur bubbles (synthetic focusout); native `blur` does not, so
       the blur handler binds as @focusout to catch CodeMirror's inner
       content — the public emit keeps the `blur` name. -->
  <CodeEditorBase
    v-if="editorState.type === 'edit' || !lazy"
    ref="baseRef"
    v-bind="$attrs"
    :value="value"
    :max-rows="maxRows"
    :placeholder="placeholder"
    :type="type"
    :disabled="disabled"
    :lint="lint"
    :strict="strict"
    :full-height="fullHeight"
    :no-style="noStyle"
    :extension="extension"
    :live-preview="livePreview"
    :variable-type="variableType"
    :expected-variable-type="expectedVariableType"
    :initial-selection="editorState.type === 'edit' ? editorState.initialSelection : undefined"
    @change="(v) => emit('update:modelValue', v)"
    @state-change="(state) => emit('stateChange', state)"
    @focusout="handleBlur"
  />
  <CodeHighlighter
    v-else
    ref="highlighterRef"
    v-bind="$attrs"
    :value="value"
    :max-rows="maxRows"
    :placeholder="placeholder"
    :type="type"
    :disabled="disabled"
    :lint="lint"
    :strict="strict"
    :full-height="fullHeight"
    :no-style="noStyle"
    :extension="extension"
    :live-preview="livePreview"
    :variable-type="variableType"
    :expected-variable-type="expectedVariableType"
    @click="handleClick"
    @focus="handleFocus"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
  />
</template>
