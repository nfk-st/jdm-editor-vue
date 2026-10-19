<script setup lang="ts">
// Ported from components/decision-table/components/field-edit-popover.tsx.
// PORTING: antd Popover → ui/Popover (reka; placement bottomLeft →
// side='bottom' align='start', destroyTooltipOnHide is reka's default
// unmount-when-closed, arrow={false} — our popover renders none); antd
// Typography.Text → token-styled span; antd Button → ui/Button; React's
// `trigger` prop and `children` → #trigger and default slots;
// onKeyDownCapture → @keydown.capture.
import { ChevronDownIcon } from 'lucide-vue-next';
import clsx from 'clsx';

import ConfirmAction from '../../confirm-action.vue';
import Stack from '../../stack.vue';
import Button from '../../ui/Button.vue';
import Popover from '../../ui/Popover.vue';

const props = withDefaults(
  defineProps<{
    value?: string;
    disabled?: boolean;
    open: boolean;
    triggerClassName?: string;
    mode?: 'edit' | 'create';
  }>(),
  { mode: 'edit' },
);

const emit = defineEmits<{
  (e: 'update:open', open: boolean): void;
  (e: 'submit'): void;
  (e: 'remove'): void;
}>();

const onKeyDownCapture = (e: KeyboardEvent) => {
  const isSubmit = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
  const isCancel = e.key === 'Escape';
  if (!isSubmit && !isCancel) return;

  e.preventDefault();
  e.stopPropagation();
  emit('update:open', false);
  if (!props.disabled && isSubmit) emit('submit');
};
</script>

<template>
  <Popover :open="open" side="bottom" align="start" @update:open="(o) => emit('update:open', o)">
    <template #trigger>
      <slot name="trigger">
        <span
          :class="clsx('grl-field-edit', !value && 'grl-typography--secondary', triggerClassName)"
          :aria-disabled="disabled"
          @click="emit('update:open', !open)"
        >
          <span class="span-overflow">{{ value || '-' }}</span>
          <ChevronDownIcon :size="12" :style="{ marginLeft: '4px' }" />
        </span>
      </slot>
    </template>
    <div :style="{ width: '300px' }" data-simulation="propagateWithTimeout" @keydown.capture="onKeyDownCapture">
      <slot />
      <div
        class="grl-field-edit__footer"
        :style="{ marginTop: '16px', justifyContent: mode === 'create' ? 'flex-end' : undefined }"
      >
        <ConfirmAction v-if="mode === 'edit'" icon-only :disabled="disabled" @confirm="emit('remove')" />
        <Stack horizontal width="auto" vertical-align="end">
          <Button size="small" type="text" @click="emit('update:open', false)">Cancel</Button>
          <Button size="small" type="primary" :disabled="disabled" @click="emit('submit')">
            {{ mode === 'create' ? 'Create' : 'Update' }}
          </Button>
        </Stack>
      </div>
    </div>
  </Popover>
</template>
