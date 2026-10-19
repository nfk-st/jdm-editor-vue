<script setup lang="ts">
import dayjs, { type Dayjs } from 'dayjs';
import { type SegmentPart, TimeFieldInput, TimeFieldRoot, type TimeValue, injectTimeFieldRootContext } from 'reka-ui';
import { defineComponent, onMounted, shallowRef, watch } from 'vue';

// antd TimePicker replacement — reka-ui's TimeField (editable hour/minute
// segments; reka-ui v2 ships TimeField, not a popover TimePicker) behind a
// dayjs public surface, matching how upstream's builders use it
// (`value={dayjs().hour(9).minute(0)} onChange={(t) => t.hour()/t.minute()}`
// with format `HH:mm`, needConfirm={false}).
// New file (no upstream counterpart beyond antd itself), hence PascalCase.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  modelValue?: Dayjs | null;
  disabled?: boolean;
  format?: string;
  needConfirm?: boolean;
  allowClear?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', time: Dayjs | null): void;
  (e: 'change', time: Dayjs | null): void;
}>();

// shallowRef: template auto-unwrap (UnwrapRef) would re-map the class union
// and break its nominal (#private) assignability against reka-ui's props.
const modelValue = shallowRef<TimeValue | undefined>(undefined);

// PORTING(reka): like ui/DatePicker, the reka time model (@internationalized/
// date values) is built from the context's placeholder Time via .set() — no
// direct dependency needed. Hidden child inside TimeFieldRoot.
const TimeValueSync = defineComponent({
  name: 'TimeValueSync',
  setup() {
    const ctx = injectTimeFieldRootContext();
    const sync = (value: Dayjs | null | undefined) => {
      const hour = value ? value.hour() : 0;
      const minute = value ? value.minute() : 0;
      // The context types the placeholder as DateValue; at runtime a
      // TimeFieldRoot placeholder is always a time-capable value.
      const placeholder = ctx.placeholder.value as TimeValue;
      modelValue.value = placeholder.set({ hour, minute });
    };
    // Mirrors React's "props → state" effect timing (first sync after mount).
    onMounted(() => sync(props.modelValue));
    watch(() => props.modelValue, sync);
    return () => null;
  },
});

const onUpdate = (value: TimeValue | undefined) => {
  modelValue.value = value;
  const time = value ? dayjs().hour(value.hour).minute(value.minute) : null;
  emit('update:modelValue', time);
  emit('change', time);
};

// PORTING(reka): TimeFieldInput's `part` prop is a SegmentPart union, not a
// plain string — the fixed hour/minute list is typed accordingly.
const SEGMENTS: { part: SegmentPart }[] = [{ part: 'hour' }, { part: 'minute' }];
</script>

<template>
  <TimeFieldRoot
    class="grl-time-picker"
    v-bind="$attrs"
    :class="{ 'grl-time-picker--disabled': disabled }"
    :model-value="modelValue"
    :disabled="disabled"
    granularity="minute"
    @update:model-value="onUpdate"
  >
    <TimeValueSync />
    <template v-for="(segment, index) in SEGMENTS" :key="segment.part">
      <TimeFieldInput :part="segment.part" class="grl-time-picker__segment" />
      <span v-if="index === 0" class="grl-time-picker__separator">:</span>
    </template>
  </TimeFieldRoot>
</template>

<style lang="scss">
.grl-time-picker {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  min-width: 0;
  height: 32px;
  padding: 4px 11px;
  color: var(--grl-color-text);
  font-size: 14px;
  font-family: var(--grl-font-family);
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  transition: var(--grl-transition);

  &:focus-within {
    outline: none;
    border-color: var(--grl-color-primary-hover);
    box-shadow: 0 0 0 2px var(--grl-control-outline);
  }

  &--disabled {
    cursor: not-allowed;
    color: var(--grl-color-text-disabled);
    background-color: var(--grl-color-bg-container-disabled);
  }

  &__segment {
    min-width: 1.4em;
    padding: 0;
    color: inherit;
    font: inherit;
    text-align: center;
    background: transparent;
    border: none;
    outline: none;

    &[data-invalid] {
      color: var(--grl-color-error);
    }
  }

  &__separator {
    color: var(--grl-color-text-secondary);
  }
}
</style>
