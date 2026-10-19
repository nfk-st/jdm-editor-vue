<script setup lang="ts">
// Ported from components/expression/expression-list.tsx.
// PORTING(DnD): react-dnd per-row drag/drop → vue-draggable-plus on the list:
// handle = the drag grip, swaps flow through the bound list → setExpressions,
// drop-direction indicator (upstream's dropping-up/down classes) is driven
// from Sortable's onMove and threaded into the item; drag opacity via ghost
// class in expression.scss.
import { PlusCircle } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { type UseDraggableOptions, useDraggable } from 'vue-draggable-plus';

import { isWasmAvailable } from '../../helpers/wasm';
import Button from '../ui/Button.vue';
import type { ExpressionEntry } from './context/expression-store.context';
import { useExpressionStoreRaw } from './context/expression-store.context';
import ExpressionItem from './expression-item.vue';

const store = useExpressionStoreRaw();

const variableType = ref<unknown>();

watch(
  () => [store.expressions, store.inputVariableType] as const,
  () => {
    if (!isWasmAvailable() || !store.inputVariableType) {
      return;
    }

    const resultingVariableType = store.inputVariableType.clone();
    store.expressions
      .filter((e) => e.key.length > 0)
      .forEach((expr) => {
        const calculatedType = resultingVariableType.calculateType(expr.value);
        resultingVariableType.set(`$.${expr.key}`, calculatedType);
      });

    variableType.value = resultingVariableType;
  },
  { immediate: true },
);

// Sortable binding: the store stays the source of truth.
const expressions = computed({
  get: () => store.expressions,
  set: (value) => store.setExpressions(value),
});

// Drop-target indicator state (upstream: useDrop collect → dropping-up/down).
const drop = reactive({ id: null as string | null, direction: null as 'up' | 'down' | null });

const listRef = ref<HTMLElement | null>(null);

// Sortable's `disabled` must be reactive through the options object.
const dragOptions = computed<UseDraggableOptions<ExpressionEntry>>(() => ({
  handle: '.expression-list-item__drag',
  animation: 0,
  ghostClass: 'expression-list-item--ghost',
  disabled: store.permission !== 'edit:full' || store.disabled,
  onUpdate: () => {
    drop.id = null;
    drop.direction = null;
  },
  onEnd: () => {
    drop.id = null;
    drop.direction = null;
  },
  onMove: (evt) => {
    const id = (evt.related as HTMLElement | undefined)?.getAttribute('data-expression-id') ?? null;
    drop.id = id;
    drop.direction = evt.willInsertAfter ? 'down' : 'up';
    return true;
  },
}));

useDraggable(listRef, expressions, dragOptions);
</script>

<template>
  <div ref="listRef" class="expression-list">
    <div class="expression-list__item expression-list__item--heading">
      <div class="expression-list__item__th expression-list__item__th--order" />
      <span class="grl-typography grl-typography--secondary expression-list__item__th expression-list__item__th--key">
        Key
      </span>
      <span class="grl-typography grl-typography--secondary expression-list__item__th"> Expression </span>
      <div />
    </div>
    <ExpressionItem
      v-for="(expression, index) in store.expressions || []"
      :key="expression.id"
      :data-expression-id="expression.id"
      :expression="expression"
      :index="index"
      :variable-type="variableType"
      :drop-direction="drop.id === expression.id ? drop.direction : null"
    />
  </div>
  <div v-if="store.permission === 'edit:full' && !store.disabled" class="expression-list__button-wrapper">
    <Button class="expression-list__button" type="link" @click="store.addRowBelow()">
      <template #icon><PlusCircle /></template>
      Add row
    </Button>
  </div>
</template>
