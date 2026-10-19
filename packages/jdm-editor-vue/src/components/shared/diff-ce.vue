<script lang="ts">
// Ported from components/shared/diff-ce.tsx.
// PORTING: swap to barrel import ('../code-editor') when index lands.
import type { CodeEditorProps } from '../code-editor/ce.vue';

// PORTING: upstream `CodeEditorProps & { displayDiff; previousValue; noStyle }`
// with the value/onChange → modelValue swap applied via CodeEditorProps itself.
export type DiffCodeEditorProps = CodeEditorProps & {
  displayDiff?: boolean;
  previousValue?: string;
  noStyle?: boolean;
};
</script>

<script setup lang="ts">
// PORTING(P7): upstream spreads the remaining CodeEditorProps ({...rest}) onto
// each editor; here everything not declared below rides $attrs onto
// CodeEditor (which declares the full prop surface).
import { computed, ref } from 'vue';

// PORTING: swap to barrel import when index lands.
import CodeEditor from '../code-editor/ce.vue';

defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue?: string;
  previousValue?: string;
  displayDiff?: boolean;
  noStyle?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

// PORTING(P2): upstream forwards its ref to the (single) CodeEditor only — in
// diff mode the ref stays null (the branch renders a bare div). Same surface
// as CodeEditorRef via the exposed computed properties.
const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null);
defineExpose({
  codeMirror: computed(() => editorRef.value?.codeMirror ?? null),
  el: computed(() => editorRef.value?.el ?? null),
});
</script>

<template>
  <div v-if="displayDiff" class="diff-code-editor" :class="{ 'no-style': noStyle }">
    <!-- PORTING(P1): upstream strips only the change handler on the previous
         side (value/onChange overridden, disabled + lint=false forced). -->
    <CodeEditor
      v-if="(previousValue || '').length > 0"
      v-bind="$attrs"
      class="previous-input"
      :model-value="previousValue"
      :lint="false"
      disabled
      no-style
    />
    <CodeEditor
      v-if="(modelValue || '').length > 0"
      v-bind="$attrs"
      class="current-input"
      :model-value="modelValue"
      :lint="false"
      disabled
      no-style
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
  </div>
  <CodeEditor
    v-else
    ref="editorRef"
    v-bind="$attrs"
    :model-value="modelValue"
    :no-style="noStyle"
    @update:model-value="(v) => emit('update:modelValue', v)"
  />
</template>
