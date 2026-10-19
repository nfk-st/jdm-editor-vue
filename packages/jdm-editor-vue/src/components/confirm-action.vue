<script setup lang="ts">
import { Trash } from 'lucide-vue-next';
import { P, match } from 'ts-pattern';
import { computed, ref } from 'vue';

import Button from './ui/Button.vue';
import Tooltip from './ui/Tooltip.vue';

// Ported from components/confirm-action.tsx — click-to-confirm button with
// tooltip (antd Button + Tooltip → ui/Button + ui/Tooltip).
// PORTING(P7): unknown attrs pass through to the button.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    iconOnly?: boolean;
    text?: string;
    confirmText?: string;
    disabled?: boolean;
  }>(),
  { iconOnly: false, text: 'Delete', confirmText: 'Really delete?', disabled: false },
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'click', event: MouseEvent): void;
  (e: 'blur', event: FocusEvent): void;
}>();

const isConfirming = ref(false);

// antd `open` semantics: never show for disabled or non-iconOnly (text is
// visible inline there); otherwise hover-driven (undefined).
const tooltipOpen = computed(() =>
  match([props.iconOnly, props.disabled])
    .with([P._, true], () => false)
    .with([false, P._], () => false)
    .otherwise(() => undefined),
);

const onClick = (event: MouseEvent) => {
  emit('click', event);
  if (isConfirming.value) {
    emit('confirm');
    isConfirming.value = false;
    return;
  }
  isConfirming.value = true;
};

const onBlur = (event: FocusEvent) => {
  emit('blur', event);
  isConfirming.value = false;
};

const label = computed(() =>
  match([props.iconOnly, isConfirming.value])
    .with([false, true], () => props.confirmText)
    .with([false, false], () => props.text)
    .otherwise(() => undefined),
);
</script>

<template>
  <Tooltip :open="tooltipOpen" :content="isConfirming ? confirmText : text">
    <Button v-bind="$attrs" type="text" :danger="isConfirming" :disabled="disabled" @click="onClick" @blur="onBlur">
      <template #icon>
        <slot name="icon">
          <!-- PORTING: lucide-vue-next size is number-only; upstream's '1em'
             equals the button's font size. -->
          <Trash :size="14" />
        </slot>
      </template>
      {{ label }}
    </Button>
  </Tooltip>
</template>
