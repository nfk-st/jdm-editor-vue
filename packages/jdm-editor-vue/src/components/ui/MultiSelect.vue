<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui';
import { computed, nextTick, ref, watch } from 'vue';

// antd Select (mode='multiple'/'tags') replacement — chips + search input
// anchored to a reka-ui Popover options list. Upstream's builders use this
// shape of antd Select (mode, tags, tokenSeparators, showSearch+filterOption,
// maxCount). New file (no upstream counterpart beyond antd itself), hence
// PascalCase.
defineOptions({ inheritAttrs: false });

type Option = { label: string; value: string };

const props = withDefaults(
  defineProps<{
    modelValue?: string[];
    options?: Option[];
    /** 'tags' allows arbitrary typed entries, 'multiple' only known options. */
    mode?: 'multiple' | 'tags';
    disabled?: boolean;
    placeholder?: string;
    /** antd tokenSeparators — characters that commit the typed token. */
    tokenSeparators?: string[];
    /** antd filterOption; default matches label or value, case-insensitive. */
    filterOption?: (input: string, option?: { label?: string; value?: string }) => boolean;
    /** antd maxCount — new selections replace older ones beyond the cap. */
    maxCount?: number;
    /** antd popupMatchSelectWidth — dropdown at least as wide as the field. */
    matchWidth?: boolean;
  }>(),
  {
    modelValue: () => [],
    options: () => [],
    mode: 'multiple',
    tokenSeparators: () => [],
    matchWidth: true,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
  (e: 'change', value: string[]): void;
}>();

const open = ref(false);
const query = ref('');
const containerRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const anchorWidth = ref(0);

const values = computed(() => props.modelValue ?? []);

const defaultFilter = (input: string, option?: { label?: string; value?: string }) => {
  const search = input.toLowerCase();
  return (option?.label?.toLowerCase().includes(search) || option?.value?.toLowerCase().includes(search)) ?? false;
};

const filtered = computed(() => {
  const filter = props.filterOption ?? defaultFilter;
  return !query.value ? props.options : props.options.filter((option) => filter(query.value, option));
});

const labelFor = (value: string) => props.options.find((option) => option.value === value)?.label ?? value;

const openDropdown = () => {
  if (props.disabled) {
    return;
  }
  anchorWidth.value = containerRef.value?.clientWidth ?? 0;
  open.value = true;
};

const commit = (next: string[]) => {
  let value = next;
  if (props.maxCount !== undefined && value.length > props.maxCount) {
    value = value.slice(value.length - props.maxCount);
  }
  emit('update:modelValue', value);
  emit('change', value);
};

const toggleValue = (value: string) => {
  if (props.disabled) {
    return;
  }
  const next = values.value.includes(value) ? values.value.filter((v) => v !== value) : [...values.value, value];
  commit(next);
};

const addToken = (raw: string) => {
  const token = raw.trim();
  if (!token || (props.mode !== 'tags' && !props.options.some((o) => o.value === token))) {
    return;
  }
  if (!values.value.includes(token)) {
    commit([...values.value, token]);
  }
  query.value = '';
};

const onInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value;
  const separators = props.tokenSeparators;
  if (separators.length) {
    const last = raw.slice(-1);
    if (separators.includes(last)) {
      addToken(raw.slice(0, -1));
      (e.target as HTMLInputElement).value = '';
      return;
    }
  }
  query.value = raw;
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (query.value) {
      addToken(query.value);
    }
  } else if (e.key === 'Backspace' && !query.value && values.value.length) {
    commit(values.value.slice(0, -1));
  }
};

// antd refocuses the search input while the dropdown is open.
watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    inputRef.value?.focus();
  } else {
    query.value = '';
  }
});

const contentStyle = computed(() =>
  props.matchWidth && anchorWidth.value ? { minWidth: `${anchorWidth.value}px` } : undefined,
);
</script>

<template>
  <PopoverRoot :open="open" @update:open="(v: boolean) => (open = v)">
    <PopoverAnchor as-child>
      <!-- PORTING: reka-ui's PopoverRoot renders no element, so consumer attrs
           are applied to the field div explicitly (inheritAttrs: false). -->
      <div
        ref="containerRef"
        class="grl-multiselect"
        v-bind="$attrs"
        :class="{ 'grl-multiselect--disabled': disabled, 'grl-multiselect--open': open }"
        role="listbox"
        aria-multiselectable="true"
        :aria-disabled="disabled"
        @mousedown="openDropdown"
        @focusin="openDropdown"
      >
        <span v-for="value in values" :key="value" class="grl-multiselect__chip">
          <span class="grl-multiselect__chip-content">{{ labelFor(value) }}</span>
          <button
            v-if="!disabled"
            type="button"
            class="grl-multiselect__chip-remove"
            aria-label="Remove"
            @mousedown.prevent
            @click.stop="toggleValue(value)"
          >
            <X :size="10" />
          </button>
        </span>
        <input
          ref="inputRef"
          class="grl-multiselect__input"
          type="text"
          :placeholder="values.length ? '' : placeholder"
          :disabled="disabled"
          :value="query"
          @input="onInput"
          @keydown="onKeydown"
        />
      </div>
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent class="grl-multiselect__content" :side-offset="4" align="start" :style="contentStyle">
        <div
          v-for="option in filtered"
          :key="option.value"
          class="grl-multiselect__option"
          :class="{ 'grl-multiselect__option--selected': values.includes(option.value) }"
          role="option"
          :aria-selected="values.includes(option.value)"
          @mousedown.prevent
          @click="toggleValue(option.value)"
        >
          <span>{{ option.label }}</span>
        </div>
        <div v-if="!filtered.length" class="grl-multiselect__empty">No matches</div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss">
.grl-multiselect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 32px;
  padding: 2px 4px;
  color: var(--grl-color-text);
  font-size: 14px;
  font-family: var(--grl-font-family);
  background-color: var(--grl-color-bg-container);
  border: 1px solid var(--grl-color-border);
  border-radius: var(--grl-border-radius);
  cursor: text;
  transition: var(--grl-transition);

  &:hover:not(.grl-multiselect--disabled) {
    border-color: var(--grl-color-primary-hover);
  }

  &--open,
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

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    padding: 0 4px;
    font-size: 13px;
    line-height: 1.4;
    background-color: var(--grl-color-bg-text-hover);
    border-radius: 4px;
    white-space: nowrap;
  }

  &__chip-content {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 2px;
    color: var(--grl-color-text-secondary);
    font-size: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    line-height: 1;
    // antd's `.ant-select-selection-item-remove` carries NO opacity rule —
    // the close icon of a multiple-select tag is ALWAYS visible. (The
    // opacity-until-hover rule belongs to the select's CLEAR icon, not the
    // tag's remove icon.) The icon is rendered only when the select is
    // enabled: rc-select computes `closable = !disabled && !itemDisabled`.
    &:hover {
      color: var(--grl-color-text);
    }
  }

  &__input {
    flex: 1;
    min-width: 20px;
    padding: 0;
    color: var(--grl-color-text);
    font: inherit;
    background: transparent;
    border: none;
    outline: none;

    &::placeholder {
      color: var(--grl-color-text-placeholder);
    }
  }

  &__content {
    z-index: 1050;
    max-height: 264px;
    overflow-y: auto;
    padding: 4px;
    background-color: var(--grl-color-bg-elevated);
    border: 1px solid var(--grl-color-border);
    border-radius: var(--grl-border-radius);
    box-shadow: var(--grl-box-shadow);
  }

  &__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 32px;
    padding: 0 8px;
    font-size: 14px;
    color: var(--grl-color-text);
    border-radius: var(--grl-border-radius);
    cursor: pointer;

    &:hover {
      background-color: var(--grl-color-bg-text-hover);
    }

    &--selected {
      color: var(--grl-color-primary);
      font-weight: 600;
    }
  }

  &__empty {
    padding: 8px 12px;
    color: var(--grl-color-text-placeholder);
    font-size: 13px;
    text-align: center;
  }
}
</style>
