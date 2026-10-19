<script setup lang="ts">
// Ported from components/expression/expression-controller.tsx — renderless
// controller bridging value/onChange props to the store.
// PORTING: upstream `value`/`onChange` → `modelValue`/`update:modelValue`
// (v-model) — deliberate exception to the internal-names rule: this
// component's props type is part of the public surface (re-exported via
// ExpressionProps) and it is the v-model bridge.
import { watch } from 'vue';

import { expressionEqual } from './context/expression-store.context';
import type { ExpressionEntry, ExpressionPermission } from './context/expression-store.context';
import { useExpressionStoreRaw } from './context/expression-store.context';

export type ExpressionControllerProps = {
  disabled?: boolean;
  defaultValue?: ExpressionEntry[];
  permission?: ExpressionPermission;
  modelValue?: ExpressionEntry[];
};

const props = withDefaults(defineProps<ExpressionControllerProps>(), {
  defaultValue: () => [],
  disabled: false,
  permission: 'edit:full',
});

const emit = defineEmits<{ (e: 'update:modelValue', value: ExpressionEntry[]): void }>();

const store = useExpressionStoreRaw();
const { setExpressions } = store;

store.setState({
  disabled: props.disabled,
  permission: props.permission,
});

if (props.modelValue !== undefined) {
  setExpressions(props.modelValue);
} else if (props.defaultValue) {
  setExpressions(props.defaultValue);
}

// zustand-shaped subscribe with (state, prev) keeps the equality check literal
const unsubscribe = store.subscribe((state, prevState) => {
  if (!expressionEqual(state.expressions, prevState.expressions)) {
    emit('update:modelValue', state.expressions);
  }
});

watch(
  () => [props.disabled, props.permission] as const,
  ([disabled, permission]) => {
    store.setState({ disabled, permission });
  },
);

watch(
  () => props.modelValue,
  (value) => {
    if (value && !expressionEqual(value, store.expressions)) {
      setExpressions(value);
    }
  },
);
</script>

<template>
  <slot />
</template>
