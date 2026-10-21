<script setup lang="ts">
import dayjs, { type Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import {
  DatePickerCalendar,
  DatePickerCell,
  DatePickerCellTrigger,
  DatePickerContent,
  DatePickerGrid,
  DatePickerGridBody,
  DatePickerGridHead,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerHeader,
  DatePickerHeading,
  DatePickerNext,
  DatePickerPrev,
  DatePickerRoot,
  DatePickerTrigger,
  type DateValue,
  injectDatePickerRootContext,
} from 'reka-ui';
// PORTING(reka): reka-ui's date model is @internationalized/date's DateValue
// (not a direct dependency of this package). The root context's placeholder —
// a DateValue reka-ui constructs itself — bootstraps parseStringToDateValue,
// so no constructor import is needed. The hidden child below runs inside
// DatePickerRoot, where that context is available.
import { parseStringToDateValue } from 'reka-ui/date';
import { computed, defineComponent, onMounted, ref, shallowRef, watch } from 'vue';

// antd DatePicker replacement — reka-ui DatePicker primitives (popover +
// calendar) behind a dayjs public surface, which is what upstream's builders
// pass/expect (`value={dayjs(...)} onChange={(d) => d.format('YYYY-MM-DD')}`).
// New file (no upstream counterpart beyond antd itself), hence PascalCase.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  modelValue?: Dayjs | null;
  disabled?: boolean;
  allowClear?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', date: Dayjs | null): void;
  (e: 'change', date: Dayjs | null): void;
}>();

// shallowRef: template auto-unwrap (UnwrapRef) would re-map the class union
// and break its nominal (#private) assignability against reka-ui's props.
const modelValue = shallowRef<DateValue | undefined>(undefined);

const DateValueSync = defineComponent({
  name: 'DateValueSync',
  setup() {
    const ctx = injectDatePickerRootContext();
    const sync = (value: Dayjs | null | undefined) => {
      const iso = value ? value.format('YYYY-MM-DD') : '';
      modelValue.value = iso ? parseStringToDateValue(iso, ctx.placeholder.value) : undefined;
    };
    // Mirrors React's "props → state" effect timing (first sync after mount).
    onMounted(() => sync(props.modelValue));
    watch(() => props.modelValue, sync);
    return () => null;
  },
});

const onUpdate = (value: DateValue | undefined) => {
  modelValue.value = value;
  // CalendarDate's toString() is the ISO `YYYY-MM-DD` form upstream formats.
  const day = value ? dayjs(value.toString()) : null;
  emit('update:modelValue', day);
  emit('change', day);
};

const display = computed(() => (props.modelValue ? props.modelValue.format('YYYY-MM-DD') : ''));
</script>

<template>
  <DatePickerRoot :model-value="modelValue" :disabled="disabled" @update:model-value="onUpdate">
    <DateValueSync />
    <!-- PORTING: attrs land on the trigger (antd spreads consumer props onto
         its wrapping span). antd's calendar suffix icon is dropped — upstream
         CSS hides it anyway (.ant-picker-suffix { display: none }). -->
    <DatePickerTrigger class="grl-date-picker" v-bind="$attrs" :class="{ 'grl-date-picker--disabled': disabled }">
      {{ display }}
    </DatePickerTrigger>
    <DatePickerContent class="grl-date-picker__content" :side-offset="6">
      <DatePickerCalendar v-slot="{ grid, weekDays }" class="grl-date-picker__calendar">
        <DatePickerHeader class="grl-date-picker__header">
          <DatePickerPrev class="grl-date-picker__nav" aria-label="Previous month">
            <ChevronLeft :size="14" />
          </DatePickerPrev>
          <DatePickerHeading class="grl-date-picker__heading" />
          <DatePickerNext class="grl-date-picker__nav" aria-label="Next month">
            <ChevronRight :size="14" />
          </DatePickerNext>
        </DatePickerHeader>
        <DatePickerGrid v-for="month in grid" :key="month.value.toString()" class="grl-date-picker__grid">
          <DatePickerGridHead>
            <DatePickerHeadCell v-for="day in weekDays" :key="day" class="grl-date-picker__head-cell">
              {{ day.slice(0, 2) }}
            </DatePickerHeadCell>
          </DatePickerGridHead>
          <DatePickerGridBody>
            <DatePickerGridRow v-for="(week, weekIndex) in month.rows" :key="weekIndex" class="grl-date-picker__row">
              <DatePickerCell v-for="day in week" :key="day.toString()" :date="day" class="grl-date-picker__cell">
                <DatePickerCellTrigger :day="day" :month="month.value" class="grl-date-picker__cell-trigger" />
              </DatePickerCell>
            </DatePickerGridRow>
          </DatePickerGridBody>
        </DatePickerGrid>
      </DatePickerCalendar>
    </DatePickerContent>
  </DatePickerRoot>
</template>

<style lang="scss">
.grl-date-picker {
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
  cursor: pointer;
  transition: var(--grl-transition);

  &:hover:not(.grl-date-picker--disabled) {
    border-color: var(--grl-color-primary-hover);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--grl-color-primary-hover);
    box-shadow: 0 0 0 2px var(--grl-control-outline);
  }

  &--disabled {
    cursor: not-allowed;
    color: var(--grl-color-text-disabled);
    background-color: var(--grl-color-bg-container-disabled);
  }

  &__content {
    z-index: 1050;
    padding: 8px;
    background-color: var(--grl-color-bg-elevated);
    border: 1px solid var(--grl-color-border);
    border-radius: var(--grl-border-radius);
    box-shadow: var(--grl-box-shadow);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__heading {
    font-size: 13px;
    font-weight: 600;
    color: var(--grl-color-text);
  }

  &__nav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--grl-color-text-secondary);
    border: none;
    border-radius: var(--grl-border-radius);
    background: transparent;
    cursor: pointer;

    &:hover {
      background-color: var(--grl-color-bg-text-hover);
    }
  }

  &__grid {
    border-collapse: collapse;
  }

  &__head-cell {
    padding: 0 2px 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--grl-color-text-secondary);
    text-align: center;
  }

  &__cell {
    padding: 1px;
  }

  &__cell-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    font-size: 12px;
    color: var(--grl-color-text);
    border: none;
    border-radius: var(--grl-border-radius);
    background: transparent;
    cursor: pointer;

    &:hover {
      background-color: var(--grl-color-bg-text-hover);
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--grl-control-outline);
    }

    &[data-selected] {
      background-color: var(--grl-color-primary);
      color: var(--grl-color-text-solid);
    }

    &[data-today] {
      border: 1px solid var(--grl-color-primary);
    }

    &[data-disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
