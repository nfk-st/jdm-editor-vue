<script setup lang="ts">
// Ported from components/code-editor/ce-preview.tsx — live evaluation preview.
// antd Typography → plain elements styled with --grl-* tokens (the .grl-typography
// replacement class, styled below and referenced from ce.scss's .grl-ce-preview).
import { type Variable } from '@gorules/zen-engine-wasm';
import stringifyPretty from 'json-stringify-pretty-compact';
import { BugIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import { isWasmAvailable } from '../../helpers/wasm';
import CodeEditor from './ce.vue';

const props = defineProps<{
  initial?: { expression: string; result: unknown };
  expression: string;
  inputData?: Variable;
  noPreviewText?: string;
}>();

const preview = computed(() => {
  if (!props.inputData) {
    return undefined;
  }

  if (!isWasmAvailable() || props.expression === props.initial?.expression) {
    return { type: 'initial' as const, value: stringifyPretty(props.initial?.result, { maxLength: 30 }) };
  }

  if (!props.expression) {
    return { type: 'none' as const, value: '-' };
  }

  try {
    const value = props.inputData.evaluateExpression(props.expression);
    return { type: 'success' as const, value: stringifyPretty(value, { maxLength: 30 }) };
  } catch (err) {
    return { type: 'error' as const, value: (err as any).toString() };
  }
});

// Upstream destructuring default, hoisted (no withDefaults needed for one prop).
const noPreviewText = computed(() => props.noPreviewText ?? 'Run simulation to see the results');
</script>

<template>
  <div>
    <span class="grl-typography" style="font-size: 12px">
      <!-- PORTING: lucide-vue-next's `size` prop is number-only; upstream's
           '1em' equals the surrounding 12px font size. -->
      Live Preview <BugIcon :size="12" :opacity="0.5" color="#077D16" />
    </span>
    <span class="grl-typography grl-typography--secondary" style="font-size: 12px; display: block">
      {{ preview?.type === 'initial' ? 'Based on simulation data' : 'Based on live calculation' }}
    </span>
    <div class="grl-ce-preview">
      <CodeEditor
        v-if="preview && (preview.type === 'success' || preview.type === 'initial')"
        :model-value="preview.value"
        disabled
        no-style
        :max-rows="3"
      />
      <span
        v-else-if="preview && preview.type === 'none'"
        class="grl-typography grl-typography--secondary grl-typography--ellipsis"
      >
        {{ preview.value }}
      </span>
      <span
        v-else-if="preview && preview.type === 'error'"
        class="grl-typography grl-typography--danger grl-typography--ellipsis"
      >
        {{ preview.value }}
      </span>
      <span v-else class="grl-typography grl-typography--secondary grl-typography--ellipsis">
        {{ noPreviewText }}
      </span>
    </div>
  </div>
</template>

<style lang="scss">
// .grl-typography (+ modifiers) lives in src/styles.scss — shared across
// modules (expression, spaced-text, ce-preview, …).
</style>
