<script setup lang="ts">
// Ported from components/autosize-text-area.tsx — contentEditable div with
// CSS-driven max-rows sizing (styles in src/styles.scss, .grl-textarea-input).
// PORTING(P3): emits only `change` (upstream invokes only onChange);
// maxRows is required, as upstream.
defineOptions({ inheritAttrs: false });

import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  maxRows: number;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{ (e: 'change', value: string): void }>();

const divRef = ref<HTMLDivElement | null>(null);

// PORTING(P2): upstream forwards its ref to the div — expose the element.
defineExpose({ el: divRef });

watch(
  () => props.value,
  (value) => {
    if (divRef.value && divRef.value.textContent !== value) {
      divRef.value.textContent = value ?? '';
    }
  },
);

// Mirrors upstream's useEffect timing: initial sync happens after mount.
onMounted(() => {
  if (divRef.value && divRef.value.textContent !== props.value) {
    divRef.value.textContent = props.value ?? '';
  }
});

const handleInput = (e: Event) => {
  emit('change', (e.currentTarget as HTMLDivElement).textContent ?? '');
};
</script>

<template>
  <div
    ref="divRef"
    class="grl-textarea-input"
    v-bind="$attrs"
    :contenteditable="!disabled && !readOnly"
    :data-placeholder="placeholder"
    :aria-disabled="disabled"
    :style="{ '--textarea-max-rows': maxRows }"
    @input="handleInput"
  />
</template>
