<script setup lang="ts">
// Ported from components/expression/expression-controller.tsx — renderless
// controller bridging value/onChange props to the store.
import { watch } from 'vue';

import { expressionEqual } from './context/expression-store';
import type { ExpressionEntry, ExpressionPermission } from './context/expression-store';
import { useExpressionStoreRaw } from './context/expression-store';

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

// PORTING: zustand store.subscribe → our listener bridge; watch would also
// work but the (state, prev) shape keeps the equality check literal.
let unsubscribe: (() => void) | undefined;

if (props.modelValue !== undefined) {
  setExpressions(props.modelValue);
} else if (props.defaultValue) {
  setExpressions(props.defaultValue);
}

const syncOnChange = () => {
  unsubscribe?.();
  unsubscribe = store.subscribe((state, prevState) => {
    if (!expressionEqual(state.expressions, prevState.expressions)) {
      emit('update:modelValue', state.expressions);
    }
  });
};

syncOnChange();

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
