<script setup lang="ts">
// Ported from components/autosize-text-area.tsx — contentEditable div with
// CSS-driven max-rows sizing (styles in src/styles.scss, .grl-textarea-input).
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  maxRows?: number;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{ (e: 'change', value: string): void; (e: 'input', value: string): void }>();

const divRef = ref<HTMLDivElement | null>(null);

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
  const value = (e.currentTarget as HTMLDivElement).textContent ?? '';
  emit('input', value);
  emit('change', value);
};
</script>

<template>
  <div
    ref="divRef"
    class="grl-textarea-input"
    :contenteditable="!disabled && !readOnly"
    :data-placeholder="placeholder"
    :aria-disabled="disabled"
    :style="{ '--textarea-max-rows': maxRows }"
    @input="handleInput"
  />
</template>
